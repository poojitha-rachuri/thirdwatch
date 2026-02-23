import type { FastifyInstance } from "fastify";
import { Queue } from "bullmq";
import { parseTDM } from "@thirdwatch/tdm";
import type { TDM, TDMPackage, TDMSdk } from "@thirdwatch/tdm";
import type { WatchedDependency } from "@thirdwatch/watcher";
import { DEFAULT_CHECK_INTERVAL_MS } from "@thirdwatch/watcher";

function extractWatchedDependencies(
  tdm: TDM,
  tdmId: string,
): WatchedDependency[] {
  const deps: WatchedDependency[] = [];

  for (const pkg of tdm.packages) {
    deps.push({
      tdmId,
      kind: "package",
      identifier: pkg.name,
      currentVersion: pkg.current_version,
      ecosystem: pkg.ecosystem,
    });
  }

  for (const sdk of tdm.sdks) {
    deps.push({
      tdmId,
      kind: "sdk",
      identifier: sdk.sdk_package,
      currentVersion: undefined,
    });
  }

  return deps;
}

export async function tdmRoutes(
  app: FastifyInstance,
  opts: { queue: Queue },
): Promise<void> {
  const { queue } = opts;

  app.post<{ Body: unknown }>("/api/v1/tdm", async (req, reply) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || typeof apiKey !== "string") {
      return reply.status(401).send({ error: "Missing x-api-key header" });
    }

    let tdm: TDM;
    try {
      tdm = parseTDM(req.body);
    } catch (err) {
      return reply.status(400).send({
        error: "Invalid TDM",
        details: err instanceof Error ? err.message : String(err),
      });
    }

    const tdmId = crypto.randomUUID();
    const dependencies = extractWatchedDependencies(tdm, tdmId);

    for (const dep of dependencies) {
      await queue.add(
        "check-dependency",
        { dependency: dep },
        {
          jobId: `${tdmId}:${dep.identifier}`,
          repeat: { every: DEFAULT_CHECK_INTERVAL_MS },
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
        },
      );
    }

    return reply.send({
      tdmId,
      dependenciesRegistered: dependencies.length,
    });
  });

  app.get<{
    Querystring: {
      since?: string;
      limit?: string;
    };
  }>("/api/v1/changes", async (req, reply) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || typeof apiKey !== "string") {
      return reply.status(401).send({ error: "Missing x-api-key header" });
    }

    // In-memory placeholder — real implementation uses Postgres
    return reply.send({ changes: [] });
  });
}
