import type { FastifyRequest, FastifyReply } from "fastify";

const APP_URL = process.env["APP_URL"] ?? "https://app.thirdwatch.dev";

export function tierGuard(requiredPlans: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const orgPlan = (req as any).orgPlan as string;

    if (!requiredPlans.includes(orgPlan)) {
      return reply.status(403).send({
        error: "plan_required",
        message: `This feature requires the ${requiredPlans.join(" or ")} plan.`,
        currentPlan: orgPlan,
        upgradeUrl: `${APP_URL}/settings/billing`,
      });
    }
  };
}
