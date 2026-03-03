import { Worker } from "bullmq";
import {
  DependencyChecker,
  InMemoryETagCache,
  DEFAULT_CHECK_INTERVAL_MS,
} from "@thirdwatch/watcher";
import type { WatchedDependency } from "@thirdwatch/watcher";
import { processNewVersion } from "./pipelines/change-pipeline.js";
import { startScheduler } from "./scheduler.js";
import { workerDb } from "./db.js";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const GITHUB_TOKEN = process.env["GITHUB_TOKEN"];
const CHECK_INTERVAL_HOURS = Number(
  process.env["CHECK_INTERVAL_HOURS"] ?? "6",
);
const checkIntervalMs =
  CHECK_INTERVAL_HOURS * 60 * 60 * 1000 || DEFAULT_CHECK_INTERVAL_MS;

const etagCache = new InMemoryETagCache();
const checker = new DependencyChecker(etagCache, GITHUB_TOKEN);

const worker = new Worker<{
  orgId?: string;
  dependency: WatchedDependency & {
    id?: string;
    org_id?: string;
    repositories?: string[];
    lastSeenVersion?: string;
  };
}>(
  "dependency-checks",
  async (job) => {
    const { dependency, orgId } = job.data;
    console.log(`[worker] Checking ${dependency.identifier}…`);
    const events = await checker.check(dependency);

    if (events.length > 0) {
      for (const event of events) {
        console.log(
          `[worker] Change detected: ${event.title} (${event.changeType})`,
        );

        if (dependency.id && (orgId ?? dependency.org_id)) {
          try {
            await processNewVersion(
              {
                id: dependency.id,
                org_id: (orgId ?? dependency.org_id)!,
                identifier: dependency.identifier,
                kind: dependency.kind,
                ecosystem: dependency.ecosystem,
                current_version: dependency.currentVersion,
                last_seen_version: dependency.lastSeenVersion,
                repositories: dependency.repositories,
              },
              event.newVersion ?? event.title,
              { changelog: event.body, url: event.url },
            );
          } catch (err) {
            console.error(
              `[worker] Pipeline error for ${dependency.identifier}:`,
              err,
            );
          }
        }
      }
    } else {
      console.log(`[worker] No changes for ${dependency.identifier}`);
      if (dependency.id) {
        await workerDb.updateWatchedDependency(dependency.id, {
          lastCheckedAt: new Date(),
        });
      }
    }
    return { events };
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 5,
  },
);

worker.on("failed", (job, err) => {
  console.error(
    `[worker] Job ${job?.id ?? "unknown"} failed: ${err.message}`,
  );
});

worker.on("ready", () => {
  console.log(
    `[worker] Ready — polling interval: ${CHECK_INTERVAL_HOURS}h (${checkIntervalMs}ms)`,
  );
});

const schedulerTimer = startScheduler();

function shutdown() {
  console.log("[worker] Shutting down…");
  clearInterval(schedulerTimer);
  void worker.close().then(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
