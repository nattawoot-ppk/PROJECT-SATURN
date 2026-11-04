import { WebSocketServer, type WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { jwtVerify } from "jose";
import { db } from "./db.js";
import { projectToDoc, docToProject } from "@saturn/realtime";

/**
 * Real-time co-editing rooms: one Yjs document per project, synced over WebSocket with the y-protocols sync and
 * awareness messages (compatible with y-websocket clients). Rooms load the latest saved project into the doc on first
 * join and persist the merged document back to the database every few seconds and when the last client leaves.
 */
const MSG_SYNC = 0, MSG_AWARENESS = 1;
interface Room { doc: Y.Doc; awareness: awarenessProtocol.Awareness; conns: Set<WebSocket>; projectId: string; dirty: boolean; timer?: NodeJS.Timeout }
const rooms = new Map<string, Room>();
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-change-me");

async function canJoin(token: string | null, projectId: string): Promise<{ userId: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret()); const userId = String(payload.sub);
    const p = await db.project.findUnique({ where: { id: projectId } }); if (!p) return null;
    if (p.ownerId === userId) return { userId };
    if (p.orgId) { const m = await db.membership.findUnique({ where: { userId_orgId: { userId, orgId: p.orgId } } }); if (m && m.role !== "viewer") return { userId }; }
    return null;
  } catch { return null; }
}

async function getRoom(projectId: string): Promise<Room> {
  let room = rooms.get(projectId); if (room) return room;
  const doc = new Y.Doc(); const awareness = new awarenessProtocol.Awareness(doc);
  const row = await db.project.findUnique({ where: { id: projectId } });
  if (row) projectToDoc(doc, JSON.parse(row.document));
  room = { doc, awareness, conns: new Set(), projectId, dirty: false };
  doc.on("update", (_u: Uint8Array, origin: unknown) => { if (origin !== "server") room!.dirty = true; });
  room.timer = setInterval(() => persist(room!), 5000);
  rooms.set(projectId, room); return room;
}
async function persist(room: Room) {
  if (!room.dirty) return; room.dirty = false;
  const project = docToProject(room.doc); if (!project) return;
  try { await db.project.update({ where: { id: room.projectId }, data: { document: JSON.stringify(project), name: String(project.name ?? ""), version: { increment: 1 } } }); } catch (e) { console.error("persist failed", e); }
}

export function attachRealtime(server: import("node:http").Server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", async (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? "/", "http://x"); if (!url.pathname.startsWith("/rt/")) return;
    const projectId = url.pathname.slice(4); const token = url.searchParams.get("token") ?? (req.headers.cookie?.match(/saturn_session=([^;]+)/)?.[1] ?? null);
    const auth = await canJoin(token, projectId);
    if (!auth) { socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => handle(ws, projectId));
  });
  async function handle(ws: WebSocket, projectId: string) {
    const room = await getRoom(projectId); room.conns.add(ws);
    const send = (buf: Uint8Array) => { if (ws.readyState === ws.OPEN) ws.send(buf); };
    const onDocUpdate = (update: Uint8Array, origin: unknown) => { if (origin === ws) return; const enc = encoding.createEncoder(); encoding.writeVarUint(enc, MSG_SYNC); syncProtocol.writeUpdate(enc, update); send(encoding.toUint8Array(enc)); };
    const onAwareness = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => { const enc = encoding.createEncoder(); encoding.writeVarUint(enc, MSG_AWARENESS); encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(room.awareness, [...added, ...updated, ...removed])); send(encoding.toUint8Array(enc)); };
    room.doc.on("update", onDocUpdate); room.awareness.on("update", onAwareness);
    // initial sync step 1
    { const enc = encoding.createEncoder(); encoding.writeVarUint(enc, MSG_SYNC); syncProtocol.writeSyncStep1(enc, room.doc); send(encoding.toUint8Array(enc)); }
    { const states = room.awareness.getStates(); if (states.size) { const enc = encoding.createEncoder(); encoding.writeVarUint(enc, MSG_AWARENESS); encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(states.keys()))); send(encoding.toUint8Array(enc)); } }
    ws.on("message", (data: Buffer) => {
      const dec = decoding.createDecoder(new Uint8Array(data)); const enc = encoding.createEncoder(); const type = decoding.readVarUint(dec);
      if (type === MSG_SYNC) { encoding.writeVarUint(enc, MSG_SYNC); syncProtocol.readSyncMessage(dec, enc, room.doc, ws); if (encoding.length(enc) > 1) send(encoding.toUint8Array(enc)); }
      else if (type === MSG_AWARENESS) awarenessProtocol.applyAwarenessUpdate(room.awareness, decoding.readVarUint8Array(dec), ws);
    });
    ws.on("close", async () => {
      room.doc.off("update", onDocUpdate); room.awareness.off("update", onAwareness); room.conns.delete(ws);
      awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(room.awareness.getStates().keys()).filter((id) => room.awareness.meta.get(id)?.clock !== undefined && false), null);
      if (room.conns.size === 0) { await persist(room); clearInterval(room.timer); room.doc.destroy(); rooms.delete(projectId); }
    });
  }
  return wss;
}
