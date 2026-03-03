import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { tierGuard } from "../middleware/tier-guard.js";
import { db } from "../db.js";

export async function notificationsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    "/api/v1/notifications/channels",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const channels = await db.listNotificationChannels(orgId);
      return reply.send({ channels });
    },
  );

  app.post<{ Body: { type: string; name: string; config: unknown } }>(
    "/api/v1/notifications/channels",
    { preHandler: [authMiddleware, tierGuard(["team", "enterprise"])] },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const { type, name, config } = req.body;
      if (!type || !name) {
        return reply
          .status(400)
          .send({ error: "type and name are required" });
      }
      const channel = await db.createNotificationChannel(
        orgId,
        type,
        name,
        config,
      );
      return reply.status(201).send(channel);
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { name?: string; config?: unknown; enabled?: boolean };
  }>(
    "/api/v1/notifications/channels/:id",
    { preHandler: [authMiddleware, tierGuard(["team", "enterprise"])] },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const updated = await db.updateNotificationChannel(
        req.params.id,
        orgId,
        req.body,
      );
      if (!updated) return reply.status(404).send({ error: "not_found" });
      return reply.send(updated);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/notifications/channels/:id",
    { preHandler: [authMiddleware, tierGuard(["team", "enterprise"])] },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      await db.deleteNotificationChannel(req.params.id, orgId);
      return reply.status(204).send();
    },
  );

  app.get(
    "/api/v1/notifications/routing",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const rules = await db.listRoutingRules(orgId);
      return reply.send({ rules });
    },
  );

  app.post<{
    Body: {
      channelId: string;
      priority?: string[];
      changeCategory?: string[];
      repositories?: string[];
      schedule?: string;
    };
  }>(
    "/api/v1/notifications/routing",
    { preHandler: [authMiddleware, tierGuard(["team", "enterprise"])] },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const { channelId, ...rule } = req.body;
      if (!channelId) {
        return reply
          .status(400)
          .send({ error: "channelId is required" });
      }
      const created = await db.createRoutingRule(orgId, channelId, rule);
      return reply.status(201).send(created);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/notifications/routing/:id",
    { preHandler: [authMiddleware, tierGuard(["team", "enterprise"])] },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      await db.deleteRoutingRule(req.params.id, orgId);
      return reply.status(204).send();
    },
  );
}
