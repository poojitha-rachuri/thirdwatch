import { DashboardShell } from "@/components/dashboard-shell";

export const metadata = { title: "Change Detail — Thirdwatch" };

export default async function ChangeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <DashboardShell>
      <div>
        <a
          href="/changes"
          className="mb-4 inline-block text-sm text-brand-400 hover:text-brand-300"
        >
          ← Back to Changes
        </a>
        <h1 className="mb-6 text-2xl font-bold text-white">
          Change Detail
        </h1>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-zinc-200">
                Classification
              </h2>
              <p className="text-sm text-zinc-400">
                Change {id} details will appear here once loaded.
              </p>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-zinc-200">
                Affected Code Locations
              </h2>
              <p className="text-sm text-zinc-400">
                No affected locations recorded.
              </p>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-zinc-200">
                Remediation
              </h2>
              <p className="text-sm text-zinc-400">
                No remediation suggestions available.
              </p>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-zinc-200">
                Impact
              </h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-zinc-500">Priority</dt>
                  <dd className="text-zinc-200">—</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Impact Score</dt>
                  <dd className="text-zinc-200">—</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Affected Files</dt>
                  <dd className="text-zinc-200">—</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Affected Usages</dt>
                  <dd className="text-zinc-200">—</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
