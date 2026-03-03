import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { db } from "../db.js";

export async function dependenciesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    "/api/v1/dependencies",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const dependencies = await db.listWatchedDependencies(orgId);
      return reply.send({ dependencies });
    },
  );
}
