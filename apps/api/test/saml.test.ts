import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { buildServer } from "../src/server";

let app: Awaited<ReturnType<typeof buildServer>>;
beforeAll(async () => { const root = new URL("..", import.meta.url).pathname; for (const f of ["test.db", "test.db-journal"]) rmSync(`${root}prisma/${f}`, { force: true }); execSync("npx prisma db push --skip-generate", { cwd: root, env: { ...process.env }, stdio: "ignore" }); app = await buildServer(); });
afterAll(async () => { await app.close(); });

describe("saml", () => {
  it("is disabled without configuration", async () => {
    expect((await app.inject({ method: "GET", url: "/auth/saml/config" })).json().enabled).toBe(false);
    expect((await app.inject({ method: "GET", url: "/auth/saml/start" })).statusCode).toBe(501);
  });
  it("serves SP metadata and redirects to the IdP when configured", async () => {
    process.env.SAML_ENTRY_POINT = "https://idp.example.com/sso/saml"; process.env.SAML_IDP_CERT = "MIIBkTCB+wIJAKHBfpegPeVzMA0GCSqGSIb3DQEBBQUAMBAxDjAMBgNVBAMMBXRlc3Qw"; process.env.API_ORIGIN = "https://api.example.com";
    const md = await app.inject({ method: "GET", url: "/auth/saml/metadata" }); expect(md.statusCode).toBe(200); expect(md.body).toContain("EntityDescriptor"); expect(md.body).toContain("https://api.example.com/auth/saml/callback");
    const st = await app.inject({ method: "GET", url: "/auth/saml/start" }); expect(st.statusCode).toBe(302); expect(st.headers.location).toMatch(/^https:\/\/idp\.example\.com\/sso\/saml\?SAMLRequest=/);
    const bad = await app.inject({ method: "POST", url: "/auth/saml/callback", payload: "SAMLResponse=bm90LXhtbA==", headers: { "content-type": "application/x-www-form-urlencoded" } }); expect(bad.statusCode).toBeGreaterThanOrEqual(400);
    delete process.env.SAML_ENTRY_POINT; delete process.env.SAML_IDP_CERT;
  });
});
