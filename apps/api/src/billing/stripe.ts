import Stripe from "stripe";
import { db } from "../db.js";

const STRIPE_SECRET_KEY = process.env["STRIPE_SECRET_KEY"] ?? "";
const STRIPE_TEAM_PRICE_ID = process.env["STRIPE_TEAM_PRICE_ID"] ?? "";
const STRIPE_ENTERPRISE_PRICE_ID =
  process.env["STRIPE_ENTERPRISE_PRICE_ID"] ?? "";
const APP_URL = process.env["APP_URL"] ?? "https://app.thirdwatch.dev";

export const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

export async function createCheckoutSession(
  orgId: string,
  plan: "team" | "enterprise",
): Promise<string | null> {
  if (!stripe) return null;

  const priceId =
    plan === "team" ? STRIPE_TEAM_PRICE_ID : STRIPE_ENTERPRISE_PRICE_ID;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/settings/billing?success=true`,
    cancel_url: `${APP_URL}/settings/billing?canceled=true`,
    metadata: { orgId },
  });

  return session.url ?? null;
}

export async function handleStripeWebhook(
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.["orgId"];
      if (!orgId) break;
      const plan =
        session.amount_total && session.amount_total >= 9900
          ? "enterprise"
          : "team";
      await db.updateOrgPlan(orgId, plan);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.["orgId"];
      if (orgId) await db.downgradeOrg(orgId, "free");
      break;
    }
  }
}
