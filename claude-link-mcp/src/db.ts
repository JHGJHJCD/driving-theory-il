import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const LIMITS = {
  maxRooms: 20_000,
  maxParticipantsPerRoom: 50,
  maxMessagesPerRoom: 300,
  maxTextLength: 4_000,
  roomIdleDays: 14,
  /** a name last seen longer ago than this can be taken over by a re-join (new session of the same person) */
  nameReuseAfterMs: 10 * 60_000,
};

export type MessageKind = "chat" | "help_request" | "answer" | "system";

export interface Message {
  id: number;
  author: string;
  kind: MessageKind;
  text: string;
  reply_to: number | null;
  created_at: number;
}

export interface Participant {
  name: string;
  about: string;
  last_seen: number;
}

export class UserError extends Error {}

const dbPath = process.env.DB_PATH ?? "./data/rooms.db";
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,            -- sha256 of the secret code; the code itself is never stored
    created_at INTEGER NOT NULL,
    last_active INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS participants (
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    about TEXT NOT NULL DEFAULT '',
    joined_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    PRIMARY KEY (room_id, name)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    author TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    reply_to INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS messages_room ON messages (room_id, id);
`);

const q = {
  roomCount: db.prepare("SELECT COUNT(*) AS n FROM rooms"),
  insertRoom: db.prepare("INSERT INTO rooms (id, created_at, last_active) VALUES (?, ?, ?)"),
  getRoom: db.prepare("SELECT id FROM rooms WHERE id = ?"),
  touchRoom: db.prepare("UPDATE rooms SET last_active = ? WHERE id = ?"),
  getPart: db.prepare("SELECT name, about, last_seen FROM participants WHERE room_id = ? AND name = ?"),
  countParts: db.prepare("SELECT COUNT(*) AS n FROM participants WHERE room_id = ?"),
  insertPart: db.prepare(
    "INSERT INTO participants (room_id, name, about, joined_at, last_seen) VALUES (?, ?, ?, ?, ?)",
  ),
  updatePart: db.prepare("UPDATE participants SET about = ?, last_seen = ? WHERE room_id = ? AND name = ?"),
  seen: db.prepare("UPDATE participants SET last_seen = ? WHERE room_id = ? AND name = ?"),
  listParts: db.prepare(
    "SELECT name, about, last_seen FROM participants WHERE room_id = ? ORDER BY last_seen DESC",
  ),
  insertMsg: db.prepare(
    "INSERT INTO messages (room_id, author, kind, text, reply_to, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ),
  getMsg: db.prepare(
    "SELECT id, author, kind, text, reply_to, created_at FROM messages WHERE room_id = ? AND id = ?",
  ),
  after: db.prepare(
    "SELECT id, author, kind, text, reply_to, created_at FROM messages WHERE room_id = ? AND id > ? ORDER BY id ASC LIMIT ?",
  ),
  lastN: db.prepare(
    "SELECT id, author, kind, text, reply_to, created_at FROM messages WHERE room_id = ? ORDER BY id DESC LIMIT ?",
  ),
  trim: db.prepare(
    `DELETE FROM messages WHERE room_id = ? AND id <= (
       SELECT id FROM messages WHERE room_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?)`,
  ),
  staleRooms: db.prepare("SELECT id FROM rooms WHERE last_active < ?"),
  delRoom: db.prepare("DELETE FROM rooms WHERE id = ?"),
  delRoomParts: db.prepare("DELETE FROM participants WHERE room_id = ?"),
  delRoomMsgs: db.prepare("DELETE FROM messages WHERE room_id = ?"),
};

/** In-process wakeups so wait_for_messages can return immediately when something is posted. */
const bus = new EventEmitter();
bus.setMaxListeners(0);

export const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

/** Create a room and return its secret code (shown once, never stored in clear). */
export function createRoom(): string {
  const { n } = q.roomCount.get() as { n: number };
  if (n >= LIMITS.maxRooms) throw new UserError("The server is full right now. Try again later.");
  const code = randomBytes(24).toString("base64url"); // 192 bits
  const now = Date.now();
  q.insertRoom.run(hashCode(code), now, now);
  return code;
}

/** Returns the internal room id for a secret code, or null when no such room exists. */
export function findRoom(code: string): string | null {
  const id = hashCode(code);
  return q.getRoom.get(id) ? id : null;
}

export function cleanName(raw: string): string {
  // letters (any language), digits, space, dot, dash, underscore; collapse whitespace
  const name = raw.replace(/[^\p{L}\p{N} ._-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!name) throw new UserError("Pick a short display name (letters/digits), e.g. your first name.");
  return name;
}

export function joinRoom(roomId: string, rawName: string, about: string): string {
  const base = cleanName(rawName);
  const now = Date.now();
  const cleanAbout = about.replace(/\s+/g, " ").trim().slice(0, 300);
  let name = base;
  for (let i = 2; ; i++) {
    const existing = q.getPart.get(roomId, name) as unknown as Participant | undefined;
    if (!existing) break;
    if (now - existing.last_seen > LIMITS.nameReuseAfterMs) {
      q.updatePart.run(cleanAbout, now, roomId, name);
      q.touchRoom.run(now, roomId);
      return name;
    }
    name = `${base}-${i}`;
    if (i > 20) throw new UserError("Too many participants with that name. Choose another name.");
  }
  const { n } = q.countParts.get(roomId) as { n: number };
  if (n >= LIMITS.maxParticipantsPerRoom) throw new UserError("The room is full.");
  q.insertPart.run(roomId, name, cleanAbout, now, now);
  q.touchRoom.run(now, roomId);
  addMessage(roomId, name, "system", `${name} joined${cleanAbout ? ` — ${cleanAbout}` : ""}`, null);
  return name;
}

export function requireParticipant(roomId: string, name: string): string {
  const exact = q.getPart.get(roomId, name.trim()) as unknown as Participant | undefined;
  if (!exact) throw new UserError(`"${name}" is not in this room. Call join_room first and use the exact name it returns.`);
  q.seen.run(Date.now(), roomId, exact.name);
  return exact.name;
}

export function addMessage(
  roomId: string,
  author: string,
  kind: MessageKind,
  text: string,
  replyTo: number | null,
): number {
  if (text.length > LIMITS.maxTextLength * 1.5) throw new UserError("Message too long. Summarize it.");
  const now = Date.now();
  if (replyTo !== null && !q.getMsg.get(roomId, replyTo)) throw new UserError(`No message #${replyTo} in this room.`);
  const res = q.insertMsg.run(roomId, author, kind, text, replyTo, now);
  q.touchRoom.run(now, roomId);
  q.trim.run(roomId, roomId, LIMITS.maxMessagesPerRoom);
  const id = Number(res.lastInsertRowid);
  bus.emit(roomId);
  return id;
}

export function getMessage(roomId: string, id: number): Message | undefined {
  return q.getMsg.get(roomId, id) as unknown as Message | undefined;
}

export function messagesAfter(roomId: string, afterId: number, limit: number): Message[] {
  return q.after.all(roomId, afterId, limit) as unknown as Message[];
}

export function lastMessages(roomId: string, limit: number): Message[] {
  return (q.lastN.all(roomId, limit) as unknown as Message[]).reverse();
}

export function listParticipants(roomId: string): Participant[] {
  return q.listParts.all(roomId) as unknown as Participant[];
}

/** Resolves true as soon as a message is posted in the room, or false after timeoutMs. */
export function waitForActivity(roomId: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (v: boolean) => {
      clearTimeout(timer);
      bus.off(roomId, onMsg);
      signal?.removeEventListener("abort", onAbort);
      resolve(v);
    };
    const onMsg = () => done(true);
    const onAbort = () => done(false);
    const timer = setTimeout(() => done(false), timeoutMs);
    bus.on(roomId, onMsg);
    signal?.addEventListener("abort", onAbort);
  });
}

/** Delete rooms nobody touched for roomIdleDays. */
export function cleanupStaleRooms(): number {
  const cutoff = Date.now() - LIMITS.roomIdleDays * 86_400_000;
  const stale = q.staleRooms.all(cutoff) as unknown as { id: string }[];
  for (const { id } of stale) {
    q.delRoomMsgs.run(id);
    q.delRoomParts.run(id);
    q.delRoom.run(id);
  }
  return stale.length;
}
