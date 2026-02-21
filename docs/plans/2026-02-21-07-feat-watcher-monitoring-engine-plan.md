---
title: "feat: Watcher — Package Registry & GitHub Release Monitoring"
type: feat
phase: 2 — The Pulse
date: 2026-02-21
priority: P0 (Phase 2)
dependencies: Plan 2 (TDM Schema), Plan 1 (Repo Setup)
packages: packages/watcher, apps/worker, apps/api
---

# feat: Watcher — Package Registry & GitHub Release Monitoring

## Overview

Build the Watcher service — Layer 2 of the Thirdwatch system. The Watcher consumes a TDM (produced by the CLI scanner), continuously polls the relevant package registries and GitHub Releases for each discovered dependency, and emits structured change events when new versions or releases are detected. Phase 2 covers: npm, PyPI, and GitHub release monitoring. The Watcher ships as both a **self-hosted Docker container** and a **free cloud beta service**.

## Problem Statement

The CLI scanner (Phase 1) is valuable but passive — it gives you a map at a point in time. Phase 2 answers "What's changed since I last scanned?" The Watcher turns the TDM into a living, monitored inventory. Without it, teams must manually check each dependency for updates — the exact painful workflow Thirdwatch is designed to eliminate.

## Proposed Solution

A TypeScript service (`packages/watcher`) with:
1. A scheduler that polls registries on a configurable interval (default: 6 hours)
2. Registry adapters for npm, PyPI, and GitHub (ETag-based conditional requests)
3. A change event emitter that outputs structured events to a configurable sink
4. A REST API (`apps/api`) to upload TDMs and configure watches
5. A background worker (`apps/worker`) that runs the polling loop

## Technical Approach

### Architecture Overview

```
┌──────────────┐     POST /tdm     ┌─────────────┐
│   CLI user   │ ─────────────────▶│   apps/api  │
│  thirdwatch  │                   │  (Fastify)  │
│  scan + push │                   └──────┬──────┘
└──────────────┘                          │ store TDM
                                          │
                                   ┌──────▼──────┐
                                   │  Database   │
                                   │ (Postgres)  │
                                   └──────┬──────┘
                                          │ poll every 6h
                                   ┌──────▼──────┐
                                   │ apps/worker │
                                   │ (BullMQ)    │
                                   └──────┬──────┘
                                          │
                              ┌───────────┼───────────┐
                              │           │           │
                    ┌─────────▼──┐  ┌─────▼────┐  ┌──▼──────────┐
                    │ npm adapter│  │PyPI adpt │  │GitHub adpt  │
                    └─────────┬──┘  └─────┬────┘  └──┬──────────┘
                              └───────────┼───────────┘
                                          │ change events
                                   ┌──────▼──────┐
                                   │  packages/  │
                                   │  notifier   │  ← Plan 10
                                   └─────────────┘
```

### Core `packages/watcher` Types

```typescript
// packages/watcher/src/types.ts

export interface WatchedDependency {
  tdmId: string;          // Reference to the source TDM
  kind: "package" | "api" | "sdk";
  identifier: string;     // e.g., "stripe@pypi", "github.com/stripe/stripe-python"
  currentVersion?: string;
  ecosystem?: string;
  githubRepo?: string;    // e.g., "stripe/stripe-python" — for GitHub monitoring
  changelogUrl?: string;  // From registry
  lastCheckedAt?: Date;
  lastSeenVersion?: string;
}

export interface ChangeEvent {
  id: string;             // UUID
  dependency: WatchedDependency;
  detectedAt: Date;
  changeType: ChangeCategory; // From @thirdwatch/tdm
  previousVersion?: string;
  newVersion?: string;
  title: string;          // Human-readable summary
  body?: string;          // Full changelog entry
  url?: string;           // Link to release/changelog
  semverType?: "major" | "minor" | "patch";
  rawData: Record<string, unknown>; // Raw response from registry
}
```

### Registry Adapters

#### npm Adapter (`packages/watcher/src/adapters/npm.ts`)

```typescript
// packages/watcher/src/adapters/npm.ts
export class NpmAdapter {
  async getLatestVersion(packageName: string): Promise<NpmVersionInfo> {
    // GET https://registry.npmjs.org/{package}
    // Use ETag caching — store ETag per package, use If-None-Match header
    // Parse dist-tags.latest for current version
    // Parse time.{version} for release date
    // Follow "repository" field to find GitHub repo for Plan 7b
  }

  async getVersionHistory(
    packageName: string,
    since: string // semver — get all versions after this
  ): Promise<NpmVersionInfo[]> {
    // Returns all published versions newer than `since`
    // Useful for detecting missed versions during polling gaps
  }
}
```

#### PyPI Adapter (`packages/watcher/src/adapters/pypi.ts`)

```typescript
// packages/watcher/src/adapters/pypi.ts
export class PyPIAdapter {
  async getLatestVersion(packageName: string): Promise<PyPIVersionInfo> {
    // GET https://pypi.org/pypi/{package}/json
    // Parse info.version for latest
    // Parse releases object for all version dates
    // Follow project_urls.Homepage or Source for GitHub repo link
  }
}
```

#### GitHub Releases Adapter (`packages/watcher/src/adapters/github.ts`)

```typescript
// packages/watcher/src/adapters/github.ts
export class GitHubAdapter {
  constructor(private readonly octokit: Octokit) {}

  async getLatestRelease(owner: string, repo: string): Promise<GitHubRelease | null> {
    // GET /repos/{owner}/{repo}/releases/latest
    // Use If-Modified-Since header with stored Last-Modified value
    // Returns null if 304 Not Modified (no rate limit cost)
  }

  async getRecentReleases(
    owner: string,
    repo: string,
    since: Date
  ): Promise<GitHubRelease[]> {
    // GET /repos/{owner}/{repo}/releases?per_page=20
    // Filter to releases after `since`
  }

  async getChangelog(owner: string, repo: string): Promise<string | null> {
    // GET /repos/{owner}/{repo}/contents/CHANGELOG.md
    // Returns raw content for classification in Plan 8
  }
}
```

### Scheduler & Job Queue (`apps/worker/src/scheduler.ts`)

```typescript
// apps/worker/src/scheduler.ts using BullMQ
import { Queue, Worker, QueueScheduler } from "bullmq";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours default

export function createWatcherQueue(redis: Redis) {
  const queue = new Queue("dependency-checks", { connection: redis });

  // Add a recurring job for every watched dependency
  async function scheduleChecks(dependencies: WatchedDependency[]) {
    for (const dep of dependencies) {
      await queue.add(
        "check-dependency",
        { dependency: dep },
        {
          jobId: dep.identifier,
          repeat: { every: CHECK_INTERVAL_MS },
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
        }
      );
    }
  }

  return { queue, scheduleChecks };
}

// Worker processes jobs
new Worker("dependency-checks", async (job) => {
  const { dependency } = job.data as { dependency: WatchedDependency };
  const events = await checkDependency(dependency);
  if (events.length > 0) {
    await emitChangeEvents(events);
  }
}, { connection: redis });
```

### REST API (`apps/api/src/routes/tdm.ts`)

```typescript
// apps/api/src/routes/tdm.ts
// POST /api/v1/tdm — Upload a TDM to register dependencies for monitoring
fastify.post("/api/v1/tdm", async (req, reply) => {
  const tdm = parseTDM(req.body); // Validates using @thirdwatch/tdm
  const tdmId = await db.storeTDM(tdm, req.user.orgId);
  const dependencies = extractWatchedDependencies(tdm, tdmId);
  await scheduleChecks(dependencies);
  return reply.send({ tdmId, dependenciesRegistered: dependencies.length });
});

// GET /api/v1/changes — Get recent change events for the org
fastify.get("/api/v1/changes", async (req, reply) => {
  const changes = await db.getRecentChanges(req.user.orgId, {
    since: req.query.since,
    priority: req.query.priority,
    limit: req.query.limit ?? 50,
  });
  return reply.send({ changes });
});
```

### CLI Push Command (extends `apps/cli`)

```typescript
// apps/cli/src/commands/push.ts
// thirdwatch push [tdm-file] — Upload TDM to cloud for monitoring
export const pushCommand = new Command("push")
  .description("Upload a TDM to Thirdwatch cloud for continuous monitoring.")
  .argument("[file]", "Path to TDM file", "./thirdwatch.json")
  .option("--token <token>", "API token (or set THIRDWATCH_TOKEN env var)")
  .action(async (file, opts) => {
    const token = opts.token ?? process.env.THIRDWATCH_TOKEN;
    // POST to https://api.thirdwatch.dev/v1/tdm
  });
```

### Database Schema

```sql
-- migrations/001_initial.sql

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tdm_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  repository TEXT,
  scanner_version TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  tdm JSONB NOT NULL
);

CREATE TABLE watched_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  tdm_id UUID REFERENCES tdm_uploads(id),
  kind TEXT NOT NULL,  -- 'package', 'api', 'sdk'
  identifier TEXT NOT NULL,
  ecosystem TEXT,
  github_repo TEXT,
  current_version TEXT,
  last_seen_version TEXT,
  last_checked_at TIMESTAMPTZ,
  UNIQUE (org_id, identifier)
);

CREATE TABLE change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  dependency_id UUID REFERENCES watched_dependencies(id),
  detected_at TIMESTAMPTZ DEFAULT now(),
  change_type TEXT NOT NULL,
  previous_version TEXT,
  new_version TEXT,
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  semver_type TEXT,
  raw_data JSONB,
  priority TEXT,  -- Computed by Analyzer in Plan 9
  notified BOOLEAN DEFAULT false
);

CREATE INDEX ON change_events (org_id, detected_at DESC);
CREATE INDEX ON watched_dependencies (last_checked_at);
```

### Self-Hosted Docker Mode

```dockerfile
# docker/watcher.Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/watcher ./packages/watcher
COPY packages/tdm ./packages/tdm
RUN corepack enable && pnpm install --frozen-lockfile --filter @thirdwatch/watcher...
CMD ["node", "packages/watcher/dist/self-hosted.js"]
```

```yaml
# docker/compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: thirdwatch
      POSTGRES_PASSWORD: thirdwatch
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  api:
    build: { context: .., dockerfile: docker/api.Dockerfile }
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgres://postgres:thirdwatch@postgres/thirdwatch
      REDIS_URL: redis://redis:6379

  worker:
    build: { context: .., dockerfile: docker/watcher.Dockerfile }
    environment:
      DATABASE_URL: postgres://postgres:thirdwatch@postgres/thirdwatch
      REDIS_URL: redis://redis:6379
      GITHUB_TOKEN: ${GITHUB_TOKEN}
      CHECK_INTERVAL_HOURS: 6
      TDM_SOURCE: file  # or "s3"
      TDM_PATH: /data/thirdwatch.json

volumes:
  postgres_data:
```

For self-hosted mode: `docker compose up` → mounts a directory with TDM files → polls continuously → writes change events to stdout or a webhook.

### ETag Rate Limit Strategy

For GitHub API (5000 req/hour authenticated):
- Store ETag + Last-Modified per dependency per repo
- Use `If-None-Match` / `If-Modified-Since` on repeat requests
- 304 Not Modified responses don't count toward quota
- With ETag caching, 1000 packages × 4/day = 4000 requests → well within limits

## Implementation Phases

### Phase 7.1: Core Types & Adapters
- Define `WatchedDependency`, `ChangeEvent` types
- Implement npm adapter with ETag caching
- Implement PyPI adapter
- Unit test against npm + PyPI fixtures (recorded HTTP responses)

### Phase 7.2: GitHub Releases Adapter
- Implement GitHub Releases adapter using Octokit
- Implement CHANGELOG.md fetcher
- ETag caching for all GitHub calls
- Test: verify 304 responses are handled correctly

### Phase 7.3: Database & Worker
- Set up Postgres schema (migrations with `node-pg-migrate`)
- Set up BullMQ queue and worker
- Implement scheduler to add repeat jobs per dependency

### Phase 7.4: REST API
- Initialize Fastify app in `apps/api`
- Implement `POST /api/v1/tdm` upload endpoint
- Implement `GET /api/v1/changes` query endpoint
- Basic API key auth

### Phase 7.5: CLI Push Command
- Add `thirdwatch push` command to `apps/cli`
- Test end-to-end: scan → push → verify jobs scheduled

### Phase 7.6: Self-Hosted Docker
- Write Dockerfiles for api and worker
- Write `docker/compose.yml`
- Document self-hosted setup in `README.md`
- Test: `docker compose up` → push a TDM → verify polling starts

## Acceptance Criteria

- [ ] `thirdwatch push ./thirdwatch.json --token $TOKEN` uploads TDM and returns dependency count
- [ ] Worker polls npm registry every 6 hours for each package in the TDM
- [ ] New npm version triggers a `ChangeEvent` record in the database
- [ ] ETag caching means repeated polls for unchanged packages cost zero rate-limit quota
- [ ] Self-hosted Docker mode works with `docker compose up` and a mounted TDM file
- [ ] `GET /api/v1/changes` returns events sorted by `detected_at` descending
- [ ] Worker retries on transient errors (3 attempts with exponential backoff)
- [ ] Polling gaps are handled: if worker was down for 12h, it catches up on missed versions

## File Inventory

| File | Description |
|---|---|
| `packages/watcher/src/types.ts` | WatchedDependency, ChangeEvent types |
| `packages/watcher/src/adapters/npm.ts` | npm registry adapter |
| `packages/watcher/src/adapters/pypi.ts` | PyPI registry adapter |
| `packages/watcher/src/adapters/github.ts` | GitHub Releases adapter |
| `packages/watcher/src/scheduler.ts` | BullMQ job scheduling |
| `packages/watcher/src/self-hosted.ts` | Self-hosted entry point |
| `apps/api/src/index.ts` | Fastify server |
| `apps/api/src/routes/tdm.ts` | TDM upload + query routes |
| `apps/worker/src/index.ts` | Worker entry point |
| `apps/worker/src/check-dependency.ts` | Job handler |
| `apps/cli/src/commands/push.ts` | CLI push command |
| `docker/watcher.Dockerfile` | Watcher Docker image |
| `docker/api.Dockerfile` | API Docker image |
| `docker/compose.yml` | Local stack |
| `migrations/001_initial.sql` | Initial DB schema |
| `migrations/002_change_events.sql` | Change events table |

## References

- [BullMQ](https://docs.bullmq.io/)
- [Octokit — GitHub API client](https://github.com/octokit/octokit.js)
- [Fastify](https://fastify.dev/)
- [node-pg-migrate](https://github.com/salsita/node-pg-migrate)
- PRD FR-2.1 through FR-2.5
