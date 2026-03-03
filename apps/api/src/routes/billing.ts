import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import {
  createCheckoutSession,
  handleStripeWebhook,
  stripe,
} from "../billing/stripe.js";

const STRIPE_WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { plan: "team" | "enterprise" } }>(
    "/api/v1/billing/checkout",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const { plan } = req.body;
      if (plan !== "team" && plan !== "enterprise") {
        return reply
          .status(400)
          .send({ error: "Invalid plan. Must be 'team' or 'enterprise'." });
      }
      const url = await createCheckoutSession(orgId, plan);
      if (!url) {
        return reply
          .status(503)
          .send({ error: "Billing not configured" });
      }
      return reply.send({ url });
    },
  );

  app.post("/api/v1/billing/webhook", async (req, reply) => {
    if (!stripe) {
      return reply
        .status(503)
        .send({ error: "Billing not configured" });
    }
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      return reply.status(400).send({ error: "Missing signature" });
    }
    try {
      const body =
        typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body);
      const event = stripe.webhooks.constructEvent(
        body,
        sig,
        STRIPE_WEBHOOK_SECRET,
      );
      await handleStripeWebhook(event);
      return reply.send({ received: true });
    } catch {
      return reply
        .status(400)
        .send({ error: "Webhook signature verification failed" });
    }
  });
}
