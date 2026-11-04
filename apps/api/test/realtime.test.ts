import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import WebSocket from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { buildServer } from "../src/server";
import { attachRealtime } from "../src/realtime";
import { projectToDoc, docToProject } from "@saturn/realtime";
import { sampleProject } from "@saturn/model";
import { db } from "../src/db";

let app: Awaited<ReturnType<typeof buildServer>>; let port = 0;
beforeAll(async () => { const root = new URL("..", import.meta.url).pathname; for (const f of ["test.db", "test.db-journal"]) rmSync(`${root}prisma/${f}`, { force: true }); execSync("npx prisma db push --skip-generate", { cwd: root, env: { ...process.env }, stdio: "ignore" }); app = await buildServer(); await app.listen({ port: 0, host: "127.0.0.1" }); attachRealtime(app.server); port = (app.server.address() as { port: number }).port; });
afterAll(async () => { await app.close(); });

/** Minimal y-websocket-compatible client: connects, completes sync, returns a doc that mirrors the room. */
function connect(projectId: string, token: string): Promise<{ doc: Y.Doc; ws: WebSocket; close: () => void }> {
  return new Promise((resolve, reject) => {
    const doc = new Y.Doc(); const ws = new WebSocket(`ws://127.0.0.1:${port}/rt/${projectId}?token=${token}`);
    ws.binaryType = "arraybuffer";
    const send = (enc: encoding.Encoder) => ws.send(encoding.toUint8Array(enc));
    let synced = false;
    doc.on("update", (u: Uint8Array, origin: unknown) => { if (origin === "remote") return; const enc = encoding.createEncoder(); encoding.writeVarUint(enc, 0); syncProtocol.writeUpdate(enc, u); if (ws.readyState === ws.OPEN) send(enc); });
    ws.on("open", () => { const enc = encoding.createEncoder(); encoding.writeVarUint(enc, 0); syncProtocol.writeSyncStep1(enc, doc); send(enc); });
    ws.on("message", (data: ArrayBuffer) => { const dec = decoding.createDecoder(new Uint8Array(data)); const type = decoding.readVarUint(dec); if (type !== 0) return; const enc = encoding.createEncoder(); encoding.writeVarUint(enc, 0); const t = syncProtocol.readSyncMessage(dec, enc, doc, "remote"); if (encoding.length(enc) > 1) send(enc); if (t === syncProtocol.messageYjsSyncStep2 && !synced) { synced = true; setTimeout(() => resolve({ doc, ws, close: () => ws.close() }), 50); } });
    ws.on("error", reject); ws.on("unexpected-response", (_r, res) => reject(new Error(`HTTP ${res.statusCode}`)));
  });
}

describe("realtime rooms", () => {
  it("rejects without a session, syncs two clients, persists to the database", async () => {
    const ml = await app.inject({ method: "POST", url: "/auth/magic-link", payload: { email: "rt@example.com" } });
    const token = new URL(ml.json().dev_link).searchParams.get("token")!;
    const session = (await app.inject({ method: "POST", url: "/auth/verify", payload: { token } })).json().token as string;
    const auth = { authorization: `Bearer ${session}` };
    const doc0 = sampleProject(); const id = (await app.inject({ method: "POST", url: "/projects", headers: auth, payload: { document: doc0 } })).json().id as string;
    await expect(connect(id, "bad-token")).rejects.toThrow(/401/);
    const a = await connect(id, session); const b = await connect(id, session);
    expect((docToProject(a.doc) as { name: string }).name).toBe(doc0.name);
    // client A renames a building and adds storeys; client B should see it
    const pa = docToProject(a.doc) as ReturnType<typeof sampleProject>; pa.options[0]!.buildings[0]!.name = "Live Tower"; pa.options[0]!.buildings[0]!.storeys.push({ id: "x", level: 6, height_m: 3.2, use: "residential", units: [], cores: [] });
    projectToDoc(a.doc, pa as unknown as Record<string, unknown>, "local");
    await new Promise((r) => setTimeout(r, 300));
    const pb = docToProject(b.doc) as ReturnType<typeof sampleProject>;
    expect(pb.options[0]!.buildings[0]!.name).toBe("Live Tower"); expect(pb.options[0]!.buildings[0]!.storeys.length).toBe(7);
    a.close(); b.close();
    await new Promise((r) => setTimeout(r, 400));
    const row = await db.project.findUnique({ where: { id } });
    expect(JSON.parse(row!.document).options[0].buildings[0].name).toBe("Live Tower");
    expect(row!.version).toBeGreaterThan(1);
  }, 30000);
});
