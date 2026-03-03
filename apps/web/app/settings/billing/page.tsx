import { DashboardShell } from "@/components/dashboard-shell";

export const metadata = { title: "Billing — Thirdwatch" };

export default function BillingPage() {
  return (
    <DashboardShell>
      <div>
        <h1 className="mb-8 text-2xl font-bold text-white">Billing</h1>

        <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-zinc-200">
            Current Plan
          </h2>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-zinc-700 px-3 py-1 text-sm font-medium text-zinc-200">
              Free
            </span>
            <span className="text-sm text-zinc-400">
              3 repos · 24h polling · Email digest
            </span>
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-3">
          <PlanCard
            name="Free"
            price="$0"
            current
            features={[
              "3 monitored repos",
              "24h polling interval",
              "7-day change history",
              "Email digest notifications",
              "Basic impact scoring",
            ]}
          />
          <PlanCard
            name="Team"
            price="$29"
            features={[
              "Unlimited repos",
              "6h polling interval",
              "90-day change history",
              "Slack + GitHub + Webhook",
              "Full impact scoring",
              "10 team members",
            ]}
          />
          <PlanCard
            name="Enterprise"
            price="$99"
            features={[
              "Unlimited repos",
              "1h polling interval",
              "1-year change history",
              "+ Jira integration",
              "Custom criticality paths",
              "Unlimited members",
              "SSO/SAML",
              "Self-hosted option",
              "99.9% SLA",
            ]}
          />
        </div>
      </div>
    </DashboardShell>
  );
}

function PlanCard({
  name,
  price,
  features,
  current = false,
}: {
  name: string;
  price: string;
  features: string[];
  current?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-6 ${current ? "border-brand-500 bg-brand-950/20" : "border-zinc-800 bg-zinc-900/50"}`}
    >
      <h3 className="text-lg font-semibold text-white">{name}</h3>
      <p className="mb-4 mt-1">
        <span className="text-3xl font-bold text-white">{price}</span>
        {price !== "$0" && (
          <span className="text-sm text-zinc-400">/mo</span>
        )}
      </p>
      <ul className="space-y-2 text-sm text-zinc-300">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-0.5 text-brand-400">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <button
        className={`mt-6 w-full rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          current
            ? "cursor-default border border-zinc-600 text-zinc-400"
            : "bg-brand-600 text-white hover:bg-brand-500"
        }`}
        disabled={current}
      >
        {current ? "Current Plan" : "Upgrade"}
      </button>
    </div>
  );
}
