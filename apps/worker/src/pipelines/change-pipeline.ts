import { workerDb } from "../db.js";

interface WatchedDep {
  id: string;
  org_id: string;
  identifier: string;
  kind: string;
  ecosystem: string | undefined;
  current_version: string | undefined;
  last_seen_version: string | undefined;
  repositories: string[] | undefined;
}

export interface RawReleaseData {
  changelog: string | undefined;
  url: string | undefined;
}

function classifyChange(opts: {
  previousVersion: string | undefined;
  newVersion: string;
  changelogText: string | undefined;
}): {
  category: string;
  confidence: string;
  classifierUsed: string;
  reasoning: string;
} {
  const { previousVersion, newVersion, changelogText } = opts;
  const lower = (changelogText ?? "").toLowerCase();

  if (
    lower.includes("cve-") ||
    lower.includes("security") ||
    lower.includes("vulnerability")
  ) {
    return {
      category: "security",
      confidence: "high",
      classifierUsed: "keywords",
      reasoning: "Changelog contains security-related keywords",
    };
  }

  if (
    lower.includes("breaking change") ||
    lower.includes("breaking:") ||
    lower.includes("removed")
  ) {
    return {
      category: "breaking",
      confidence: "high",
      classifierUsed: "keywords",
      reasoning: "Changelog contains breaking change keywords",
    };
  }

  if (lower.includes("deprecated") || lower.includes("deprecation")) {
    return {
      category: "deprecation",
      confidence: "medium",
      classifierUsed: "keywords",
      reasoning: "Changelog contains deprecation keywords",
    };
  }

  if (previousVersion && newVersion) {
    const prevParts = previousVersion
      .replace(/^v/, "")
      .split(".")
      .map(Number);
    const newParts = newVersion.replace(/^v/, "").split(".").map(Number);
    if (
      newParts[0] !== undefined &&
      prevParts[0] !== undefined &&
      newParts[0] > prevParts[0]
    ) {
      return {
        category: "breaking",
        confidence: "medium",
        classifierUsed: "semver",
        reasoning: `Major version bump: ${previousVersion} → ${newVersion}`,
      };
    }
    if (
      newParts[1] !== undefined &&
      prevParts[1] !== undefined &&
      newParts[1] > prevParts[1]
    ) {
      return {
        category: "minor",
        confidence: "high",
        classifierUsed: "semver",
        reasoning: `Minor version bump: ${previousVersion} → ${newVersion}`,
      };
    }
  }

  return {
    category: "patch",
    confidence: "high",
    classifierUsed: "semver",
    reasoning: "Patch-level change",
  };
}

function computePriority(
  category: string,
  usageCount: number,
): { priority: string; score: number } {
  const severityScore: Record<string, number> = {
    breaking: 5,
    security: 5,
    deprecation: 3,
    minor: 2,
    patch: 1,
  };
  const severity = severityScore[category] ?? 1;
  const usageScore = Math.min(Math.log2(usageCount + 1), 5);
  const score = severity * 2 + usageScore;

  if (score >= 10) return { priority: "P0", score };
  if (score >= 7) return { priority: "P1", score };
  if (score >= 4) return { priority: "P2", score };
  if (score >= 2) return { priority: "P3", score };
  return { priority: "P4", score };
}

export async function processNewVersion(
  dependency: WatchedDep,
  newVersion: string,
  releaseData: RawReleaseData,
): Promise<void> {
  // 1. Create change event
  const prevVersion =
    dependency.last_seen_version ?? dependency.current_version;
  const createData: {
    dependencyId: string;
    orgId: string;
    changeType: string;
    previousVersion?: string;
    newVersion?: string;
    title: string;
    body?: string;
    url?: string;
    rawData?: unknown;
  } = {
    dependencyId: dependency.id,
    orgId: dependency.org_id,
    changeType: "informational",
    title: `${dependency.identifier} ${newVersion}`,
    newVersion,
    rawData: releaseData,
  };
  if (prevVersion) createData.previousVersion = prevVersion;
  if (releaseData.changelog) createData.body = releaseData.changelog;
  if (releaseData.url) createData.url = releaseData.url;
  const changeEvent = await workerDb.createChangeEvent(createData);

  // 2. Classify
  const classification = classifyChange({
    previousVersion:
      dependency.last_seen_version ?? dependency.current_version,
    newVersion,
    changelogText: releaseData.changelog,
  });

  await workerDb.updateChangeEvent(changeEvent.id, {
    changeType: classification.category,
    classificationConfidence: classification.confidence,
    classifierUsed: classification.classifierUsed,
    classificationReasoning: classification.reasoning,
  });

  // 3. Impact analysis
  const repos = dependency.repositories ?? [];
  let totalUsages = 0;
  const affectedLocations: Array<{
    file: string;
    line: number;
    context?: string;
    usageType?: string;
  }> = [];

  for (const repo of repos) {
    const tdmUpload = await workerDb.getLatestTDM(dependency.org_id, repo);
    if (!tdmUpload) continue;

    const tdm = tdmUpload.tdm as {
      packages?: Array<{
        name: string;
        ecosystem: string;
        locations?: Array<{
          file: string;
          line: number;
          context?: string;
          type?: string;
        }>;
      }>;
    };
    for (const pkg of tdm.packages ?? []) {
      const pkgIdentifier = `${pkg.name}@${pkg.ecosystem}`;
      if (
        pkgIdentifier === dependency.identifier ||
        pkg.name === dependency.identifier
      ) {
        for (const loc of pkg.locations ?? []) {
          const entry: {
            file: string;
            line: number;
            context?: string;
            usageType?: string;
          } = { file: loc.file, line: loc.line };
          if (loc.context) entry.context = loc.context;
          entry.usageType = loc.type ?? "import";
          affectedLocations.push(entry);
          totalUsages++;
        }
      }
    }
  }

  const { priority, score } = computePriority(
    classification.category,
    totalUsages,
  );
  const uniqueFiles = new Set(affectedLocations.map((l) => l.file)).size;
  const humanSummary = `${dependency.identifier} has a ${classification.category} change (${newVersion}). Found ${totalUsages} usages across ${uniqueFiles} files.`;

  await workerDb.updateChangeEvent(changeEvent.id, {
    priority,
    impactScore: score,
    affectedFiles: uniqueFiles,
    affectedUsages: totalUsages,
    humanSummary,
  });

  if (affectedLocations.length > 0) {
    await workerDb.insertAffectedLocations(
      changeEvent.id,
      affectedLocations,
    );
  }

  // 4. Notify
  const routes = await workerDb.getRoutingRules(dependency.org_id);
  for (const route of routes) {
    const priorities = (route.priority as string[] | null) ?? [];
    if (priorities.length > 0 && !priorities.includes(priority)) continue;
    const categories = (route.change_category as string[] | null) ?? [];
    if (
      categories.length > 0 &&
      !categories.includes(classification.category)
    )
      continue;

    await workerDb.insertNotificationLog({
      orgId: dependency.org_id,
      changeEventId: changeEvent.id,
      channel: route.channel_type as string,
      status: "sent",
    });
  }

  await workerDb.updateChangeEvent(changeEvent.id, {
    notified: true,
    notifiedAt: new Date(),
  });

  // 5. Update dependency's last seen version
  await workerDb.updateWatchedDependency(dependency.id, {
    lastSeenVersion: newVersion,
    latestVersion: newVersion,
    lastCheckedAt: new Date(),
  });
}
