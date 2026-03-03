import Fastify from "fastify";
import cors from "@fastify/cors";
import { Queue } from "bullmq";
import { tdmRoutes } from "./routes/tdm.js";
import { authRoutes } from "./routes/auth.js";
import { changesRoutes } from "./routes/changes.js";
import { dependenciesRoutes } from "./routes/dependencies.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { orgRoutes } from "./routes/org.js";
import { billingRoutes } from "./routes/billing.js";

const PORT = Number(process.env["PORT"] ?? "3001");
const HOST = process.env["HOST"] ?? "0.0.0.0";
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const queue = new Queue("dependency-checks", {
  connection: { url: REDIS_URL },
});

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/healthz", async () => ({ status: "ok" }));

await authRoutes(app);
await tdmRoutes(app, { queue });
await changesRoutes(app);
await dependenciesRoutes(app);
await notificationsRoutes(app);
await orgRoutes(app);
await billingRoutes(app);

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`[api] Listening on ${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
