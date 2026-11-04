import type { FastifyInstance } from "fastify";
import { SAML } from "@node-saml/node-saml";
import { db } from "../db.js";
import { issueSession, COOKIE } from "../auth.js";

/**
 * SAML 2.0 service provider (SP-initiated, HTTP-Redirect request, HTTP-POST response) for enterprise identity providers
 * (Okta, Entra ID, ADFS, OneLogin…). Configure SAML_ENTRY_POINT (IdP SSO URL), SAML_ISSUER (our entity id),
 * SAML_IDP_CERT (IdP signing certificate, PEM or base64), optional SAML_ALLOWED_DOMAINS and SAML_ORG_ID.
 * Metadata for the IdP is served at /auth/saml/metadata.
 */
export const samlConfigured = () => !!(process.env.SAML_ENTRY_POINT && process.env.SAML_IDP_CERT);
function saml() {
  const apiOrigin = process.env.API_ORIGIN ?? `http://localhost:${process.env.PORT ?? 4000}`;
  return new SAML({ entryPoint: process.env.SAML_ENTRY_POINT!, issuer: process.env.SAML_ISSUER ?? `${apiOrigin}/auth/saml/metadata`, callbackUrl: `${apiOrigin}/auth/saml/callback`, idpCert: process.env.SAML_IDP_CERT!, wantAssertionsSigned: true, wantAuthnResponseSigned: false, identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" });
}

export async function samlRoutes(app: FastifyInstance) {
  app.get("/auth/saml/config", async () => ({ enabled: samlConfigured(), label: process.env.SAML_LABEL ?? "Enterprise SSO (SAML)" }));
  app.get("/auth/saml/metadata", async (_req, reply) => { if (!samlConfigured()) return reply.code(501).send({ error: "saml not configured" }); reply.type("application/xml"); return saml().generateServiceProviderMetadata(null, null); });
  app.get("/auth/saml/start", async (req, reply) => {
    if (!samlConfigured()) return reply.code(501).send({ error: "saml not configured" });
    const url = await saml().getAuthorizeUrlAsync("", req.headers.host ?? "", {});
    return reply.redirect(url);
  });
  app.post("/auth/saml/callback", async (req, reply) => {
    if (!samlConfigured()) return reply.code(501).send({ error: "saml not configured" });
    const body = req.body as { SAMLResponse?: string };
    if (!body?.SAMLResponse) return reply.code(400).send({ error: "missing SAMLResponse" });
    const { profile } = await saml().validatePostResponseAsync({ SAMLResponse: body.SAMLResponse });
    const email = String(profile?.email ?? profile?.nameID ?? "").toLowerCase(); if (!email.includes("@")) return reply.code(400).send({ error: "no email in assertion" });
    const allowed = (process.env.SAML_ALLOWED_DOMAINS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (allowed.length && !allowed.includes(email.split("@")[1] ?? "")) return reply.code(403).send({ error: "domain not allowed" });
    const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || (typeof profile?.displayName === "string" ? profile.displayName : null);
    const user = await db.user.upsert({ where: { email }, update: { name: name ?? undefined }, create: { email, name } });
    if (process.env.SAML_ORG_ID) await db.membership.upsert({ where: { userId_orgId: { userId: user.id, orgId: process.env.SAML_ORG_ID } }, update: {}, create: { userId: user.id, orgId: process.env.SAML_ORG_ID, role: "member" } });
    const session = await issueSession(user.id);
    reply.setCookie(COOKIE, session, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 3600 });
    return reply.redirect(`${process.env.APP_ORIGIN ?? "http://localhost:3000"}/auth/callback?session=${session}`);
  });
}
