import type { FastifyInstance } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { authMiddleware } from "../middleware/auth.js";
import { db } from "../db.js";

export async function orgRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/org",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const org = await db.getOrg(orgId);
      if (!org) return reply.status(404).send({ error: "not_found" });
      return reply.send(org);
    },
  );

  app.get(
    "/api/v1/org/usage",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const usage = await db.getOrgUsage(orgId);
      return reply.send(usage);
    },
  );

  app.get(
    "/api/v1/org/export",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const data = await db.exportOrgData(orgId);
      return reply.send(data);
    },
  );

  app.delete(
    "/api/v1/org",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      await db.deleteOrg(orgId);
      return reply.status(204).send();
    },
  );

  app.get(
    "/api/v1/org/api-keys",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const keys = await db.listApiKeys(orgId);
      return reply.send({ keys });
    },
  );

  app.post<{ Body: { name?: string } }>(
    "/api/v1/org/api-keys",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const rawKey = `tw_live_${randomBytes(24).toString("hex")}`;
      const keyHash = createHash("sha256").update(rawKey).digest("hex");
      const keyPrefix = rawKey.slice(0, 15) + "...";
      const key = await db.createApiKey(
        orgId,
        keyHash,
        keyPrefix,
        req.body?.name ?? null,
      );
      return reply.status(201).send({ ...key, token: rawKey });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/org/api-keys/:id",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      await db.deleteApiKey(req.params.id, orgId);
      return reply.status(204).send();
    },
  );
}
