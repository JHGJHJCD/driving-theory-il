import express, { type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./mcp.js";
import { cleanupStaleRooms, createRoom, findRoom, UserError } from "./db.js";
import { homePage, roomPage } from "./pages.js";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_URL = process.env.PUBLIC_URL?.replace(/\/+$/, ""); // e.g. https://claude-link.example.com
const CODE_RE = /^[A-Za-z0-9_-]{20,64}$/;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // behind Caddy
app.use(express.json({ limit: "64kb" }));

const baseUrl = (req: Request) => PUBLIC_URL ?? `${req.protocol}://${req.get("host")}`;
const mcpUrl = (req: Request, code: string) => `${baseUrl(req)}/r/${code}/mcp`;

const createLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many rooms created from your address. Try again later." },
});
const mcpLimiter = rateLimit({
  windowMs: 60_000,
  limit: 240,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { jsonrpc: "2.0", error: { code: -32000, message: "Rate limit exceeded." }, id: null },
});

app.get("/healthz", (_req, res) => void res.type("text").send("ok"));
app.get("/", (req, res) => void res.type("html").send(homePage(baseUrl(req))));

app.post("/api/rooms", createLimiter, (req, res) => {
  try {
    const code = createRoom();
    res.status(201).json({ url: mcpUrl(req, code), page: `${baseUrl(req)}/r/${code}` });
  } catch (e) {
    if (e instanceof UserError) return void res.status(503).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
});

// Human-friendly page for a room link (instructions on how to connect).
app.get("/r/:code", (req, res) => {
  const { code } = req.params as { code: string };
  if (!CODE_RE.test(code) || !findRoom(code)) return void res.status(404).type("html").send(homePage(baseUrl(req), true));
  res.set("Referrer-Policy", "no-referrer").type("html").send(roomPage(mcpUrl(req, code)));
});

// The MCP endpoint itself. Stateless streamable HTTP: a fresh server+transport per request.
async function handleMcp(req: Request, res: Response) {
  const { code } = req.params as { code: string };
  const roomId = CODE_RE.test(code) ? findRoom(code) : null;
  if (!roomId) {
    return void res.status(404).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Room not found. Ask the room creator for a fresh link." },
      id: null,
    });
  }
  const server = buildServer(roomId);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("mcp error:", e);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
}
app.post("/r/:code/mcp", mcpLimiter, handleMcp);
const notAllowed = (_req: Request, res: Response) =>
  void res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. This server is stateless: use POST." },
    id: null,
  });
app.get("/r/:code/mcp", notAllowed);
app.delete("/r/:code/mcp", notAllowed);

app.listen(PORT, () => console.log(`claude-link listening on :${PORT}`));

// housekeeping: drop rooms idle for two weeks
const sweep = () => {
  try {
    const n = cleanupStaleRooms();
    if (n) console.log(`cleaned ${n} idle rooms`);
  } catch (e) {
    console.error("cleanup failed", e);
  }
};
sweep();
setInterval(sweep, 6 * 3600_000).unref();
