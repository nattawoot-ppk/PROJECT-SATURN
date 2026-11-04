import type { FastifyInstance } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { nanoid } from "nanoid";
import { db } from "../db.js";
import { issueSession, COOKIE } from "../auth.js";

/**
 * Single sign-on via OpenID Connect (Google Workspace, Microsoft Entra ID, Okta, Auth0, Keycloak…).
 * Configure OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET; optional OIDC_ALLOWED_DOMAINS (comma list) and OIDC_ORG_ID
 * to auto-join an organisation. Authorization-code flow with state cookie; ID token verified against the issuer JWKS.
 */
interface Discovery { authorization_endpoint: string; token_endpoint: string; jwks_uri: string; issuer: string }
let discovery: Discovery | null = null;
async function discover(): Promise<Discovery> {
  if (discovery) return discovery;
  const issuer = process.env.OIDC_ISSUER!.replace(/\/$/, "");
  const res = await fetch(`${issuer}/.well-known/openid-configuration`); if (!res.ok) throw new Error("OIDC discovery failed");
  discovery = await res.json() as Discovery; return discovery;
}
export const oidcConfigured = () => !!(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET);

export async function oidcRoutes(app: FastifyInstance) {
  app.get("/auth/sso/config", async () => ({ enabled: oidcConfigured(), label: process.env.OIDC_LABEL ?? "Single sign-on" }));
  app.get("/auth/sso/start", async (req, reply) => {
    if (!oidcConfigured()) return reply.code(501).send({ error: "sso not configured" });
    const d = await discover(); const state = nanoid(24); const nonce = nanoid(24);
    reply.setCookie("saturn_oidc", JSON.stringify({ state, nonce }), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 600 });
    const redirect = `${process.env.API_ORIGIN ?? `http://localhost:${process.env.PORT ?? 4000}`}/auth/sso/callback`;
    const url = new URL(d.authorization_endpoint);
    for (const [k, v] of Object.entries({ response_type: "code", client_id: process.env.OIDC_CLIENT_ID!, redirect_uri: redirect, scope: "openid email profile", state, nonce })) url.searchParams.set(k, v);
    return reply.redirect(url.toString());
  });
  app.get("/auth/sso/callback", async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string };
    if (q.error || !q.code) return reply.code(400).send({ error: q.error ?? "missing code" });
    let st: { state: string; nonce: string } | null = null; try { st = JSON.parse(req.cookies["saturn_oidc"] ?? "null"); } catch { /* ignore */ }
    if (!st || st.state !== q.state) return reply.code(400).send({ error: "state mismatch" });
    const d = await discover();
    const redirect = `${process.env.API_ORIGIN ?? `http://localhost:${process.env.PORT ?? 4000}`}/auth/sso/callback`;
    const tok = await fetch(d.token_endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: q.code, redirect_uri: redirect, client_id: process.env.OIDC_CLIENT_ID!, client_secret: process.env.OIDC_CLIENT_SECRET! }) });
    if (!tok.ok) return reply.code(502).send({ error: "token exchange failed" });
    const { id_token } = await tok.json() as { id_token: string };
    const jwks = createRemoteJWKSet(new URL(d.jwks_uri));
    const { payload } = await jwtVerify(id_token, jwks, { issuer: d.issuer, audience: process.env.OIDC_CLIENT_ID });
    if (payload.nonce !== st.nonce) return reply.code(400).send({ error: "nonce mismatch" });
    const email = String(payload.email ?? "").toLowerCase(); if (!email) return reply.code(400).send({ error: "no email claim" });
    const allowed = (process.env.OIDC_ALLOWED_DOMAINS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (allowed.length && !allowed.includes(email.split("@")[1] ?? "")) return reply.code(403).send({ error: "domain not allowed" });
    const user = await db.user.upsert({ where: { email }, update: { name: typeof payload.name === "string" ? payload.name : undefined }, create: { email, name: typeof payload.name === "string" ? payload.name : null } });
    if (process.env.OIDC_ORG_ID) await db.membership.upsert({ where: { userId_orgId: { userId: user.id, orgId: process.env.OIDC_ORG_ID } }, update: {}, create: { userId: user.id, orgId: process.env.OIDC_ORG_ID, role: "member" } });
    const session = await issueSession(user.id);
    reply.setCookie(COOKIE, session, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 3600 });
    reply.clearCookie("saturn_oidc", { path: "/" });
    return reply.redirect(`${process.env.APP_ORIGIN ?? "http://localhost:3000"}/auth/callback?session=${session}`);
  });
}
