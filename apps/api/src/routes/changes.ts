import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { db } from "../db.js";

export async function changesRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      since?: string;
      priority?: string;
      dependency?: string;
      repository?: string;
      limit?: string;
      offset?: string;
    };
  }>(
    "/api/v1/changes",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const { since, priority, dependency, repository, limit, offset } =
        req.query;
      const opts: {
        since?: string;
        priority?: string;
        dependency?: string;
        repository?: string;
        limit?: number;
        offset?: number;
      } = {
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0,
      };
      if (since) opts.since = since;
      if (priority) opts.priority = priority;
      if (dependency) opts.dependency = dependency;
      if (repository) opts.repository = repository;
      const result = await db.listChangeEvents(orgId, opts);
      return reply.send(result);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/v1/changes/:id",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const change = await db.getChangeEvent(req.params.id, orgId);
      if (!change) return reply.status(404).send({ error: "not_found" });
      return reply.send(change);
    },
  );
}
