import { Worker } from "bullmq";
import {
  DependencyChecker,
  InMemoryETagCache,
  DEFAULT_CHECK_INTERVAL_MS,
} from "@thirdwatch/watcher";
import type { WatchedDependency } from "@thirdwatch/watcher";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const GITHUB_TOKEN = process.env["GITHUB_TOKEN"];
const CHECK_INTERVAL_HOURS = Number(process.env["CHECK_INTERVAL_HOURS"] ?? "6");
const checkIntervalMs = CHECK_INTERVAL_HOURS * 60 * 60 * 1000 || DEFAULT_CHECK_INTERVAL_MS;

const etagCache = new InMemoryETagCache();
const checker = new DependencyChecker(etagCache, GITHUB_TOKEN);

const worker = new Worker<{ dependency: WatchedDependency }>(
  "dependency-checks",
  async (job) => {
    const { dependency } = job.data;
    console.log(`[worker] Checking ${dependency.identifier}…`);
    const events = await checker.check(dependency);
    if (events.length > 0) {
      for (const event of events) {
        console.log(
          `[worker] Change detected: ${event.title} (${event.changeType})`,
        );
      }
    } else {
      console.log(`[worker] No changes for ${dependency.identifier}`);
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

function shutdown() {
  console.log("[worker] Shutting down…");
  void worker.close().then(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
