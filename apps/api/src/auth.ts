import { SignJWT, jwtVerify } from "jose";
import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "./db.js";

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-change-me");
export const COOKIE = "saturn_session";

export async function issueSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret());
}
export async function userFromRequest(req: FastifyRequest): Promise<{ id: string; email: string; name: string | null } | null> {
  const token = req.cookies?.[COOKIE] ?? (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined);
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret()); const u = await db.user.findUnique({ where: { id: String(payload.sub) } }); return u ? { id: u.id, email: u.email, name: u.name } : null; } catch { return null; }
}
export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const u = await userFromRequest(req); if (!u) { reply.code(401).send({ error: "unauthenticated" }); return null; } return u;
}

/** Plan limits mirroring the PRD pricing table. */
export const PLAN_LIMITS: Record<string, { projects: number; exports: boolean; simulations: "basic" | "all"; imports: boolean; seats: number }> = {
  free: { projects: 3, exports: false, simulations: "basic", imports: false, seats: 1 },
  starter: { projects: 10, exports: false, simulations: "all", imports: true, seats: 1 },
  pro: { projects: Infinity, exports: true, simulations: "all", imports: true, seats: 1 },
  business: { projects: Infinity, exports: true, simulations: "all", imports: true, seats: 2 },
};
