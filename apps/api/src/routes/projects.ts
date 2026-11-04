import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { parseProject } from "@saturn/model";
import { db } from "../db.js";
import { requireUser, PLAN_LIMITS } from "../auth.js";

async function canAccess(userId: string, projectId: string, write: boolean): Promise<boolean> {
  const p = await db.project.findUnique({ where: { id: projectId } }); if (!p) return false;
  if (p.ownerId === userId) return true;
  if (p.orgId) { const m = await db.membership.findUnique({ where: { userId_orgId: { userId, orgId: p.orgId } } }); if (!m) return false; return write ? m.role !== "viewer" : true; }
  return false;
}

export async function projectRoutes(app: FastifyInstance) {
  app.get("/projects", async (req, reply) => {
    const u = await requireUser(req, reply); if (!u) return;
    const orgIds = (await db.membership.findMany({ where: { userId: u.id } })).map((m) => m.orgId);
    const rows = await db.project.findMany({ where: { OR: [{ ownerId: u.id }, { orgId: { in: orgIds } }] }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, updatedAt: true, version: true, orgId: true, ownerId: true } });
    return rows;
  });
  app.post("/projects", async (req, reply) => {
    const u = await requireUser(req, reply); if (!u) return;
    const body = z.object({ document: z.unknown(), orgId: z.string().optional() }).parse(req.body);
    const doc = parseProject(body.document);
    // plan limit on personal projects
    if (!body.orgId) { const n = await db.project.count({ where: { ownerId: u.id, orgId: null } }); if (n >= PLAN_LIMITS.free!.projects && !(await hasPaidPersonalPlan(u.id))) return reply.code(402).send({ error: "project limit reached for free plan", limit: PLAN_LIMITS.free!.projects }); }
    const id = doc.id || nanoid(8);
    const row = await db.project.create({ data: { id, name: doc.name, ownerId: body.orgId ? null : u.id, orgId: body.orgId ?? null, document: JSON.stringify({ ...doc, id }) } });
    return { id: row.id, version: row.version };
  });
  app.get("/projects/:id", async (req, reply) => {
    const u = await requireUser(req, reply); if (!u) return; const { id } = req.params as { id: string };
    if (!(await canAccess(u.id, id, false))) return reply.code(404).send({ error: "not found" });
    const p = await db.project.findUnique({ where: { id } });
    return { id: p!.id, version: p!.version, document: JSON.parse(p!.document), updatedAt: p!.updatedAt };
  });
  /** Optimistic-locking save: client sends the version it loaded; 409 on conflict with the newer document. */
  app.put("/projects/:id", async (req, reply) => {
    const u = await requireUser(req, reply); if (!u) return; const { id } = req.params as { id: string };
    if (!(await canAccess(u.id, id, true))) return reply.code(404).send({ error: "not found" });
    const body = z.object({ document: z.unknown(), version: z.number().int() }).parse(req.body);
    const doc = parseProject(body.document);
    const cur = await db.project.findUnique({ where: { id } });
    if (cur!.version !== body.version) return reply.code(409).send({ error: "conflict", version: cur!.version, document: JSON.parse(cur!.document) });
    const row = await db.project.update({ where: { id }, data: { name: doc.name, document: JSON.stringify(doc), version: { increment: 1 } } });
    return { id: row.id, version: row.version };
  });
  app.delete("/projects/:id", async (req, reply) => { const u = await requireUser(req, reply); if (!u) return; const { id } = req.params as { id: string }; if (!(await canAccess(u.id, id, true))) return reply.code(404).send({ error: "not found" }); await db.comment.deleteMany({ where: { projectId: id } }); await db.project.delete({ where: { id } }); return { ok: true }; });
  /** Share token for read-only viewing without an account. */
  app.post("/projects/:id/share", async (req, reply) => { const u = await requireUser(req, reply); if (!u) return; const { id } = req.params as { id: string }; if (!(await canAccess(u.id, id, true))) return reply.code(404).send({ error: "not found" }); const token = nanoid(16); await db.project.update({ where: { id }, data: { shareToken: token } }); return { token, url: `${process.env.APP_ORIGIN ?? ""}/shared/${token}` }; });
  app.get("/shared/:token", async (req, reply) => { const { token } = req.params as { token: string }; const p = await db.project.findUnique({ where: { shareToken: token } }); if (!p) return reply.code(404).send({ error: "not found" }); return { id: p.id, document: JSON.parse(p.document), version: p.version }; });
  // comments
  app.get("/projects/:id/comments", async (req, reply) => { const u = await requireUser(req, reply); if (!u) return; const { id } = req.params as { id: string }; if (!(await canAccess(u.id, id, false))) return reply.code(404).send({ error: "not found" }); return db.comment.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" }, include: { author: { select: { email: true, name: true } } } }); });
  app.post("/projects/:id/comments", async (req, reply) => { const u = await requireUser(req, reply); if (!u) return; const { id } = req.params as { id: string }; if (!(await canAccess(u.id, id, false))) return reply.code(404).send({ error: "not found" }); const body = z.object({ body: z.string().min(1), anchor: z.unknown().optional() }).parse(req.body); return db.comment.create({ data: { projectId: id, authorId: u.id, body: body.body, anchor: body.anchor ? JSON.stringify(body.anchor) : null } }); });
  app.patch("/comments/:cid", async (req, reply) => { const u = await requireUser(req, reply); if (!u) return; const { cid } = req.params as { cid: string }; const c = await db.comment.findUnique({ where: { id: cid } }); if (!c || !(await canAccess(u.id, c.projectId, false))) return reply.code(404).send({ error: "not found" }); const { resolved } = z.object({ resolved: z.boolean() }).parse(req.body); return db.comment.update({ where: { id: cid }, data: { resolved } }); });
}

async function hasPaidPersonalPlan(userId: string): Promise<boolean> {
  const m = await db.membership.findMany({ where: { userId }, include: { org: true } });
  return m.some((x) => x.org.plan !== "free");
}
