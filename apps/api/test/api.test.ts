import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { buildServer } from "../src/server";
import { sampleProject } from "@saturn/model";

let app: Awaited<ReturnType<typeof buildServer>>;
beforeAll(async () => { const root = new URL("..", import.meta.url).pathname; for (const f of ["test.db", "test.db-journal"]) rmSync(`${root}prisma/${f}`, { force: true }); execSync("npx prisma db push --skip-generate", { cwd: root, env: { ...process.env }, stdio: "ignore" }); app = await buildServer(); });
afterAll(async () => { await app.close(); });

describe("api", () => {
  it("health", async () => { const r = await app.inject({ method: "GET", url: "/health" }); expect(r.json().ok).toBe(true); });
  it("magic link login, project CRUD with optimistic locking, share, comments, org seats", async () => {
    const ml = await app.inject({ method: "POST", url: "/auth/magic-link", payload: { email: "a@example.com" } });
    const link: string = ml.json().dev_link; const token = new URL(link).searchParams.get("token")!;
    const v = await app.inject({ method: "POST", url: "/auth/verify", payload: { token } });
    expect(v.statusCode).toBe(200); const session = v.json().token as string; const auth = { authorization: `Bearer ${session}` };
    expect((await app.inject({ method: "POST", url: "/auth/verify", payload: { token } })).statusCode).toBe(400); // single use
    const me = await app.inject({ method: "GET", url: "/auth/me", headers: auth }); expect(me.json().user.email).toBe("a@example.com");
    const doc = sampleProject();
    const c = await app.inject({ method: "POST", url: "/projects", headers: auth, payload: { document: doc } }); expect(c.statusCode).toBe(200);
    const id = c.json().id as string;
    const g = await app.inject({ method: "GET", url: `/projects/${id}`, headers: auth }); expect(g.json().document.name).toBe(doc.name); expect(g.json().version).toBe(1);
    const upd = { ...g.json().document, name: "Renamed" };
    const p1 = await app.inject({ method: "PUT", url: `/projects/${id}`, headers: auth, payload: { document: upd, version: 1 } }); expect(p1.json().version).toBe(2);
    const p2 = await app.inject({ method: "PUT", url: `/projects/${id}`, headers: auth, payload: { document: upd, version: 1 } }); expect(p2.statusCode).toBe(409); expect(p2.json().version).toBe(2);
    const list = await app.inject({ method: "GET", url: "/projects", headers: auth }); expect(list.json().length).toBe(1);
    const sh = await app.inject({ method: "POST", url: `/projects/${id}/share`, headers: auth }); const st = sh.json().token as string;
    const shared = await app.inject({ method: "GET", url: `/shared/${st}` }); expect(shared.statusCode).toBe(200); expect(shared.json().document.name).toBe("Renamed");
    const cm = await app.inject({ method: "POST", url: `/projects/${id}/comments`, headers: auth, payload: { body: "Too tall", anchor: { buildingId: "b1" } } }); expect(cm.statusCode).toBe(200);
    const cms = await app.inject({ method: "GET", url: `/projects/${id}/comments`, headers: auth }); expect(cms.json().length).toBe(1);
    // free plan limit: 3 personal projects
    for (let i = 0; i < 2; i++) expect((await app.inject({ method: "POST", url: "/projects", headers: auth, payload: { document: { ...doc, id: `p${i}` } } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/projects", headers: auth, payload: { document: { ...doc, id: "p9" } } })).statusCode).toBe(402);
    // org + seats
    const org = await app.inject({ method: "POST", url: "/orgs", headers: auth, payload: { name: "Studio" } }); const orgId = org.json().id as string;
    const s1 = await app.inject({ method: "POST", url: `/orgs/${orgId}/seats/acquire`, headers: auth }); expect(s1.json().held).toBe(true);
    const unauth = await app.inject({ method: "GET", url: `/projects/${id}` }); expect(unauth.statusCode).toBe(401);
    const plans = await app.inject({ method: "GET", url: "/billing/plans" }); expect(plans.json().length).toBe(4);
    const co = await app.inject({ method: "POST", url: "/billing/checkout", headers: auth, payload: { orgId, plan: "pro" } }); expect(co.statusCode).toBe(501);
    const ent = await app.inject({ method: "GET", url: `/billing/entitlements/${orgId}`, headers: auth }); expect(ent.json().exports).toBe(false); expect(ent.json().plan).toBe("free");
    await app.inject({ method: "POST", url: "/billing/webhook", payload: { type: "checkout.session.completed", data: { object: { metadata: { orgId, daypass: "1" } } } } });
    const ent2 = await app.inject({ method: "GET", url: `/billing/entitlements/${orgId}`, headers: auth }); expect(ent2.json().exports).toBe(true);
    await app.inject({ method: "POST", url: "/billing/webhook", payload: { type: "checkout.session.completed", data: { object: { metadata: { orgId, plan: "pro" } } } } });
    expect((await app.inject({ method: "GET", url: `/billing/entitlements/${orgId}`, headers: auth })).json().plan).toBe("pro");
  });
});

describe("sso and mail", () => {
  it("reports SSO as disabled without configuration and keeps dev-mode links", async () => {
    const c = await app.inject({ method: "GET", url: "/auth/sso/config" }); expect(c.json().enabled).toBe(false);
    const s = await app.inject({ method: "GET", url: "/auth/sso/start" }); expect(s.statusCode).toBe(501);
    const ml = await app.inject({ method: "POST", url: "/auth/magic-link", payload: { email: "b@example.com" } }); expect(ml.json().provider).toBe("dev"); expect(ml.json().dev_link).toContain("/auth/callback?token=");
  });
});
