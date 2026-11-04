import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { authRoutes } from "./routes/auth.js";
import { orgRoutes } from "./routes/orgs.js";
import { projectRoutes } from "./routes/projects.js";
import { billingRoutes } from "./routes/billing.js";

export async function buildServer() {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test", bodyLimit: 25 * 1024 * 1024 });
  await app.register(cors, { origin: process.env.APP_ORIGIN ?? true, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] });
  await app.register(cookie);
  app.get("/health", async () => ({ ok: true, service: "saturn-api", time: new Date().toISOString() }));
  await app.register(authRoutes); await app.register(orgRoutes); await app.register(projectRoutes); await app.register(billingRoutes);
  app.setErrorHandler((err, _req, reply) => { const e = err as { validation?: unknown; name?: string; message?: string; statusCode?: number }; if (e.name === "ZodError") return reply.code(400).send({ error: "validation", detail: e.message }); reply.code(e.statusCode ?? 500).send({ error: e.message ?? "error" }); });
  return app;
}

const isMain = process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js");
if (isMain) {
  buildServer().then((app) => app.listen({ port: Number(process.env.PORT ?? 4000), host: "0.0.0.0" })).catch((e) => { console.error(e); process.exit(1); });
}
