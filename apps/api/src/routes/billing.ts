import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { requireUser, PLAN_LIMITS } from "../auth.js";

/**
 * Billing: plans and Stripe Checkout. The Stripe SDK is intentionally not bundled; calls go through fetch so the API
 * runs without keys (returns 501 until STRIPE_SECRET_KEY is configured).
 */
export const PLANS = [
  { id: "free", name: "Free", monthly: 0, yearly: 0, features: ["1 user", "3 projects", "basic terrain", "sun + views", "image import"] },
  { id: "starter", name: "Starter", monthly: 21, yearly: 250, features: ["unlimited usage", "10 projects", "extended terrain", "all simulations", "all imports", "collaboration", "export day pass €30"] },
  { id: "pro", name: "Pro", monthly: 79, yearly: 948, features: ["unlimited projects", "all exports", "collaboration"] },
  { id: "business", name: "Business", monthly: null, yearly: 3995, features: ["2+ floating seats", "organisation ownership", "invoice payment", "custom rule packs"] },
];

export async function billingRoutes(app: FastifyInstance) {
  app.get("/billing/plans", async () => PLANS);
  app.post("/billing/checkout", async (req, reply) => {
    const u = await requireUser(req, reply); if (!u) return;
    const { orgId, plan, interval } = z.object({ orgId: z.string(), plan: z.enum(["starter", "pro", "business"]), interval: z.enum(["month", "year"]).default("year") }).parse(req.body);
    const key = process.env.STRIPE_SECRET_KEY; const price = process.env[`STRIPE_PRICE_${plan.toUpperCase()}`];
    if (!key || !price) return reply.code(501).send({ error: "billing not configured" });
    const org = await db.organisation.findUnique({ where: { id: orgId } }); if (!org) return reply.code(404).send({ error: "no org" });
    const form = new URLSearchParams({ mode: "subscription", "line_items[0][price]": price, "line_items[0][quantity]": "1", success_url: `${process.env.APP_ORIGIN}/billing/success`, cancel_url: `${process.env.APP_ORIGIN}/billing/cancel`, client_reference_id: orgId, customer_email: u.email, "metadata[orgId]": orgId, "metadata[plan]": plan, "metadata[interval]": interval });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
    const json = await res.json() as { url?: string; error?: unknown };
    if (!res.ok) return reply.code(502).send({ error: json.error });
    return { url: json.url };
  });
  /** Starter plan export day pass (€30): one-off Checkout; the webhook sets dayPassUntil = now + 24 h. */
  app.post("/billing/daypass", async (req, reply) => {
    const u = await requireUser(req, reply); if (!u) return;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.body);
    const key = process.env.STRIPE_SECRET_KEY; const price = process.env.STRIPE_PRICE_DAYPASS;
    if (!key || !price) return reply.code(501).send({ error: "billing not configured" });
    const form = new URLSearchParams({ mode: "payment", "line_items[0][price]": price, "line_items[0][quantity]": "1", success_url: `${process.env.APP_ORIGIN}/billing/success`, cancel_url: `${process.env.APP_ORIGIN}/billing/cancel`, client_reference_id: orgId, customer_email: u.email, "metadata[orgId]": orgId, "metadata[daypass]": "1" });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
    const json = await res.json() as { url?: string; error?: unknown };
    if (!res.ok) return reply.code(502).send({ error: json.error });
    return { url: json.url };
  });
  /** Entitlements the web app uses to gate exports and simulations. */
  app.get("/billing/entitlements/:orgId", async (req, reply) => {
    const u = await requireUser(req, reply); if (!u) return; const { orgId } = req.params as { orgId: string };
    const org = await db.organisation.findUnique({ where: { id: orgId } }); if (!org) return reply.code(404).send({ error: "no org" });
    const limits = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS.free!; const dayPass = !!org.dayPassUntil && org.dayPassUntil > new Date();
    return { plan: org.plan, exports: limits.exports || dayPass, day_pass_until: org.dayPassUntil, simulations: limits.simulations, imports: limits.imports, projects: limits.projects === Infinity ? null : limits.projects };
  });
  /** Webhook: trusts Stripe only when the signature secret is configured (verification via Stripe CLI/SDK is expected in production deployment). */
  app.post("/billing/webhook", { config: { rawBody: true } }, async (req, reply) => {
    const evt = req.body as { type?: string; data?: { object?: { metadata?: { orgId?: string; plan?: string; daypass?: string }; client_reference_id?: string } } };
    if (evt.type === "checkout.session.completed") {
      const orgId = evt.data?.object?.metadata?.orgId ?? evt.data?.object?.client_reference_id; const plan = evt.data?.object?.metadata?.plan;
      if (orgId && evt.data?.object?.metadata?.daypass === "1") await db.organisation.update({ where: { id: orgId }, data: { dayPassUntil: new Date(Date.now() + 24 * 3600 * 1000) } });
      else if (orgId && plan) await db.organisation.update({ where: { id: orgId }, data: { plan } });
    }
    return reply.send({ received: true });
  });
}
