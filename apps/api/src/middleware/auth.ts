import type { FastifyRequest, FastifyReply } from "fastify";
import { createHash } from "node:crypto";
import { db } from "../db.js";

export async function authMiddleware(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || typeof apiKey !== "string") {
    return reply
      .status(401)
      .send({ error: "unauthorized", message: "Missing x-api-key header" });
  }

  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const result = await db.getOrgByApiKeyHash(keyHash);
  if (!result) {
    return reply
      .status(401)
      .send({ error: "unauthorized", message: "Invalid API key" });
  }

  (req as any).orgId = result.org_id;
  (req as any).orgPlan = result.plan;
  (req as any).keyPermissions = result.permissions;
}
