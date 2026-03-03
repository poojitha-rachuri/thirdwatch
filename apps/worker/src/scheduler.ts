import { Queue } from "bullmq";
import { workerDb } from "./db.js";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const PLAN_INTERVALS: Record<string, number> = {
  free: 24 * 60 * 60 * 1000,
  team: 6 * 60 * 60 * 1000,
  enterprise: 1 * 60 * 60 * 1000,
};

const queue = new Queue("dependency-checks", {
  connection: { url: REDIS_URL },
});

export async function scheduleChecks(): Promise<void> {
  const deps = await workerDb.getWatchedDependenciesToCheck(100);

  for (const dep of deps) {
    const interval =
      PLAN_INTERVALS[dep.plan as string] ?? PLAN_INTERVALS["free"]!;
    const lastChecked = dep.last_checked_at
      ? new Date(dep.last_checked_at as string).getTime()
      : 0;
    const now = Date.now();

    if (now - lastChecked >= interval) {
      await queue.add(
        "check-dependency",
        {
          orgId: dep.org_id,
          dependency: {
            id: dep.id,
            org_id: dep.org_id,
            identifier: dep.identifier,
            kind: dep.kind,
            ecosystem: dep.ecosystem,
            currentVersion: dep.current_version,
            lastSeenVersion: dep.last_seen_version,
            repositories: dep.repositories,
          },
        },
        {
          jobId: `scheduled:${dep.id as string}:${now}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
        },
      );
    }
  }
}

export function startScheduler(): ReturnType<typeof setInterval> {
  console.log(
    "[scheduler] Starting periodic dependency check scheduler",
  );
  const timer = setInterval(() => {
    scheduleChecks().catch((err: unknown) => {
      console.error("[scheduler] Error scheduling checks:", err);
    });
  }, 5 * 60 * 1000);

  scheduleChecks().catch((err: unknown) => {
    console.error("[scheduler] Error on initial schedule:", err);
  });

  return timer;
}
