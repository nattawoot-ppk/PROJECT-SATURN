import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { requireUser, PLAN_LIMITS } from "../auth.js";

export async function orgRoutes(app: FastifyInstance) {
  app.post("/orgs", async (req, reply) => {
    const u = await requireUser(req, reply); if (!u) return;
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const org = await db.organisation.create({ data: { name, members: { create: { userId: u.id, role: "owner" } } } });
    return org;
  });
  app.post("/orgs/:id/members", async (req, reply) => {
    const u = await requireUser(req, reply); if (!u) return;
    const { id } = req.params as { id: string }; const { email, role } = z.object({ email: z.string().email(), role: z.enum(["admin", "member", "viewer"]).default("member") }).parse(req.body);
    const me = await db.membership.findUnique({ where: { userId_orgId: { userId: u.id, orgId: id } } });
    if (!me || !["owner", "admin"].includes(me.role)) return reply.code(403).send({ error: "forbidden" });
    const member = await db.user.upsert({ where: { email }, update: {}, create: { email } });
    return db.membership.upsert({ where: { userId_orgId: { userId: member.id, orgId: id } }, update: { role }, create: { userId: member.id, orgId: id, role } });
  });
  /** Floating seats: acquire a lease; released on logout or after 30 min idle. */
  app.post("/orgs/:id/seats/acquire", async (req, reply) => {
    const u = await requireUser(req, reply); if (!u) return;
    const { id } = req.params as { id: string };
    const org = await db.organisation.findUnique({ where: { id } }); if (!org) return reply.code(404).send({ error: "no org" });
    const limit = org.plan === "business" ? org.seats : PLAN_LIMITS[org.plan]?.seats ?? 1;
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    await db.seatLease.deleteMany({ where: { orgId: id, lastSeen: { lt: cutoff } } });
    const mine = await db.seatLease.findUnique({ where: { orgId_userId: { orgId: id, userId: u.id } } });
    if (mine) { await db.seatLease.update({ where: { id: mine.id }, data: { lastSeen: new Date() } }); return { ok: true, held: true }; }
    const active = await db.seatLease.count({ where: { orgId: id } });
    if (active >= limit) return reply.code(409).send({ error: "no free seat", active, limit });
    await db.seatLease.create({ data: { orgId: id, userId: u.id } });
    return { ok: true, held: true, active: active + 1, limit };
  });
  app.post("/orgs/:id/seats/release", async (req, reply) => { const u = await requireUser(req, reply); if (!u) return; const { id } = req.params as { id: string }; await db.seatLease.deleteMany({ where: { orgId: id, userId: u.id } }); return { ok: true }; });
}
