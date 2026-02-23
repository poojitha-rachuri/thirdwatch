import Fastify from "fastify";
import { Queue } from "bullmq";
import { tdmRoutes } from "./routes/tdm.js";

const PORT = Number(process.env["PORT"] ?? "3001");
const HOST = process.env["HOST"] ?? "0.0.0.0";
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const queue = new Queue("dependency-checks", {
  connection: { url: REDIS_URL },
});

const app = Fastify({ logger: true });

app.get("/healthz", async () => ({ status: "ok" }));

await tdmRoutes(app, { queue });

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`[api] Listening on ${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
