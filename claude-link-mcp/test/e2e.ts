import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const PORT = 3999;
const base = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), "cl-"));
const srv = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
  env: { ...process.env, PORT: String(PORT), DB_PATH: join(dir, "t.db") },
  stdio: ["ignore", "inherit", "inherit"],
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function up() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/healthz`)).ok) return; } catch {}
    await sleep(200);
  }
  throw new Error("server did not start");
}
const connect = async (url: string) => {
  const c = new Client({ name: "test", version: "1" });
  await c.connect(new StreamableHTTPClientTransport(new URL(url)));
  return c;
};
const call = async (c: Client, name: string, args: Record<string, unknown>) => {
  const r = (await c.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  return { err: !!r.isError, text: r.content[0].text };
};

try {
  await up();
  const created = await (await fetch(`${base}/api/rooms`, { method: "POST" })).json() as { url: string; page: string };
  console.log("room:", created.url.replace(/\/r\/.+\//, "/r/<secret>/"));

  const bad = await fetch(`${base}/r/${"x".repeat(32)}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(bad.status, 404, "unknown room must 404");
  assert.equal((await fetch(created.page)).status, 200, "room page");

  const dana = await connect(created.url);
  const yossi = await connect(created.url);
  const tools = (await dana.listTools()).tools.map((t) => t.name);
  console.log("tools:", tools.join(", "));
  assert.equal(tools.length, 7);

  const j1 = await call(dana, "join_room", { name: "Dana", about: "python" });
  assert.match(j1.text, /joined as "Dana"/);
  const j2 = await call(yossi, "join_room", { name: "Dana", about: "other person same name" });
  assert.match(j2.text, /joined as "Dana-2"/, "name collision gets suffix");
  const j3 = await call(yossi, "join_room", { name: "Yossi" });
  assert.match(j3.text, /joined as "Yossi"/);

  assert.ok((await call(dana, "post_message", { name: "Nobody", text: "hi" })).err, "must join first");

  const ask = await call(dana, "ask_for_help", { name: "Dana", problem: "build fails", error: "ModuleNotFoundError: foo" });
  const askId = Number(/#(\d+)/.exec(ask.text)![1]);
  console.log(ask.text);

  // Yossi is waiting while Dana asks (long-poll wakeup), then answers.
  const seen = await call(yossi, "wait_for_messages", { name: "Yossi", after_id: askId - 1, timeout_seconds: 5 });
  assert.match(seen.text, /ModuleNotFoundError/);
  assert.match(seen.text, /untrusted/);

  const waiting = call(dana, "wait_for_messages", { name: "Dana", after_id: askId, timeout_seconds: 10 });
  await sleep(300);
  const t0 = Date.now();
  await call(yossi, "answer_help", { name: "Yossi", request_id: askId, text: "pip install foo in the venv" });
  const got = await waiting;
  assert.match(got.text, /pip install foo/);
  assert.ok(Date.now() - t0 < 2000, "wait should wake immediately, not time out");

  assert.ok((await call(yossi, "answer_help", { name: "Yossi", request_id: 1, text: "x" })).err, "can't answer a non-request");

  const empty = await call(dana, "wait_for_messages", { name: "Dana", after_id: 9999, timeout_seconds: 1 });
  assert.match(empty.text, /no new messages/);

  const who = await call(dana, "who_is_here", {});
  assert.match(who.text, /Yossi/);
  console.log("ALL OK");
} finally {
  srv.kill();
}
