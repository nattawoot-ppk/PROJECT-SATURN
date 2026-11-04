import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db.js";
import { issueSession, userFromRequest, COOKIE } from "../auth.js";
import { sendMail, magicLinkMail } from "../mail.js";

/** Passwordless email login. Without an email provider configured, the magic link is returned in the response (dev mode) and logged. */
export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/magic-link", async (req, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await db.user.upsert({ where: { email }, update: {}, create: { email } });
    const token = nanoid(32);
    await db.magicToken.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
    const link = `${process.env.APP_ORIGIN ?? "http://localhost:3000"}/auth/callback?token=${token}`;
    const sent = await sendMail(magicLinkMail(email, link), (o, m) => app.log.info(o, m));
    if (!sent.ok) return reply.code(502).send({ error: `email delivery failed (${sent.provider})` });
    if (sent.provider === "dev") app.log.info({ email, link }, "magic link (dev mode)");
    return reply.send({ ok: true, provider: sent.provider, ...(sent.provider === "dev" ? { dev_link: link } : {}) });
  });
  app.post("/auth/verify", async (req, reply) => {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    const t = await db.magicToken.findUnique({ where: { token } });
    if (!t || t.usedAt || t.expiresAt < new Date()) return reply.code(400).send({ error: "invalid or expired token" });
    await db.magicToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
    const session = await issueSession(t.userId);
    reply.setCookie(COOKIE, session, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 3600 });
    const user = await db.user.findUnique({ where: { id: t.userId } });
    return reply.send({ ok: true, token: session, user: { id: user!.id, email: user!.email, name: user!.name } });
  });
  app.get("/auth/me", async (req, reply) => { const u = await userFromRequest(req); if (!u) return reply.code(401).send({ error: "unauthenticated" }); const orgs = await db.membership.findMany({ where: { userId: u.id }, include: { org: true } }); return { user: u, orgs: orgs.map((m) => ({ id: m.org.id, name: m.org.name, plan: m.org.plan, role: m.role, seats: m.org.seats })) }; });
  app.post("/auth/logout", async (_req, reply) => { reply.clearCookie(COOKIE, { path: "/" }); return { ok: true }; });
}
