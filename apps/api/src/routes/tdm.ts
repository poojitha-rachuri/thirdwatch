import type { FastifyInstance } from "fastify";
import { Queue } from "bullmq";
import { parseTDM } from "@thirdwatch/tdm";
import type { TDM } from "@thirdwatch/tdm";
import { authMiddleware } from "../middleware/auth.js";
import { db } from "../db.js";

const PLAN_LIMITS: Record<string, { repositories: number | null }> = {
  free: { repositories: 3 },
  team: { repositories: null },
  enterprise: { repositories: null },
};

export async function tdmRoutes(
  app: FastifyInstance,
  opts: { queue: Queue },
): Promise<void> {
  const { queue } = opts;

  app.post<{ Body: unknown }>(
    "/api/v1/tdm",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const orgPlan = (req as any).orgPlan as string;

      let tdm: TDM;
      try {
        tdm = parseTDM(req.body);
      } catch (err) {
        return reply.status(400).send({
          error: "Invalid TDM",
          details: err instanceof Error ? err.message : String(err),
        });
      }

      const repository = tdm.metadata.repository ?? "unknown";

      // Enforce repo limit
      const repoCount = await db.countDistinctRepos(orgId);
      const limit = PLAN_LIMITS[orgPlan]?.repositories ?? null;
      if (limit !== null) {
        const existingTdm = await db.getLatestTDM(orgId, repository);
        if (!existingTdm && repoCount >= limit) {
          return reply.status(403).send({
            error: "plan_limit",
            message: `Your ${orgPlan} plan allows ${limit} repositories. Upgrade to monitor more.`,
          });
        }
      }

      const languages = tdm.metadata.languages_detected;
      const dependencyCount =
        tdm.packages.length +
        tdm.sdks.length +
        tdm.apis.length;

      const upload = await db.insertTdmUpload(
        orgId,
        repository,
        tdm.metadata.scanner_version,
        languages,
        dependencyCount,
        tdm,
        true,
      );

      const deps: Array<{
        identifier: string;
        kind: string;
        ecosystem?: string;
        currentVersion?: string;
      }> = [];

      for (const pkg of tdm.packages) {
        const dep = {
          identifier: `${pkg.name}@${pkg.ecosystem}`,
          kind: "package",
          ecosystem: pkg.ecosystem,
          currentVersion: pkg.current_version,
        };
        deps.push(dep);
        await db.upsertWatchedDependency(orgId, {
          ...dep,
          provider: pkg.name,
          repositories: [repository],
          totalUsages: pkg.locations.length,
          totalFiles: new Set(pkg.locations.map((l) => l.file)).size,
        });
      }

      for (const sdk of tdm.sdks) {
        const dep = { identifier: sdk.sdk_package, kind: "sdk" };
        deps.push(dep);
        await db.upsertWatchedDependency(orgId, {
          ...dep,
          provider: sdk.provider,
          repositories: [repository],
        });
      }

      for (const dep of deps) {
        await queue.add(
          "check-dependency",
          { orgId, dependency: dep },
          {
            jobId: `${orgId}:${dep.identifier}`,
            attempts: 3,
            backoff: { type: "exponential", delay: 1000 },
          },
        );
      }

      return reply.status(201).send({
        tdmId: upload.id,
        repository,
        dependenciesRegistered: deps.length,
        monitoringStarted: true,
      });
    },
  );

  app.get<{ Querystring: { repository?: string } }>(
    "/api/v1/tdm/baseline",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const orgId = (req as any).orgId as string;
      const repository = req.query.repository;
      if (!repository) {
        return reply
          .status(400)
          .send({ error: "repository query param required" });
      }
      const tdm = await db.getLatestTDM(orgId, repository);
      if (!tdm) {
        return reply.status(404).send({ error: "No baseline exists" });
      }
      return reply.send(tdm.tdm);
    },
  );
}
