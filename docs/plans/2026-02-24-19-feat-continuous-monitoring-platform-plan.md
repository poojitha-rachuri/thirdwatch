---
title: "feat: Continuous Monitoring Platform — Cloud Service & Monetization"
type: feat
phase: 2–3 (The Pulse → The Brain)
date: 2026-02-24
priority: P0
dependencies: Plan 7 (Watcher), Plan 8 (Classification), Plan 9 (Analyzer), Plan 10 (Notifier)
package: apps/api, apps/worker, apps/web
---

# feat: Continuous Monitoring Platform — Cloud Service & Monetization

## Overview

This plan integrates the Watcher (Plan 7), Classification Engine (Plan 8), Analyzer (Plan 9), and Notifier (Plan 10) into a coherent cloud product that monitors every external dependency in your codebase and alerts you before breaking changes reach production. This is the monetization layer of Thirdwatch.

**Core business principle**: The CLI scanner is free forever, runs locally, requires no account, and produces a complete dependency map (TDM). The cloud service watches that map continuously and is the paid product.

## Product Boundary

```
┌─────────────────────────────────────────────────────────┐
│                    FREE (Apache 2.0)                     │
│                                                         │
│  thirdwatch scan .  →  thirdwatch.json (TDM)            │
│                                                         │
│  • Full dependency map: packages, APIs, SDKs, infra     │
│  • All languages: Python, JS/TS, Go, Java, Rust, PHP    │
│  • AST-based scanning with tree-sitter                  │
│  • SDK registry with 500+ providers                     │
│  • Runs 100% locally, zero network calls                │
│  • No account, no login, no telemetry                   │
│  • CI gate (GitHub Action) for diff + PR comments        │
│                                                         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │  thirdwatch push (opt-in)
                      ▼
┌─────────────────────────────────────────────────────────┐
│              PAID CLOUD (BSL 1.1 → Apache)              │
│                                                         │
│  • Continuous monitoring: polls registries every 6h     │
│  • Change classification: breaking / deprecation / CVE  │
│  • Impact analysis: P0–P4 scoring per YOUR codebase     │
│  • Notifications: Slack, GitHub Issues, Jira, email     │
│  • Dashboard: dependency map, change feed, remediation  │
│  • API: query changes, dependencies, assessments        │
│  • Team management: org-based access, API keys          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Pricing & Tiers

| | Free | Team ($29/mo) | Enterprise ($99/mo) |
|---|---|---|---|
| CLI scanner | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| CI gate (PR comments) | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| Monitored repos | 3 | Unlimited | Unlimited |
| Polling interval | 24h | 6h | 1h |
| Change history | 7 days | 90 days | 1 year |
| Notifications | Email digest | Slack + GitHub + Webhook | + Jira |
| Classification | Semver + Keywords | + OpenAPI diff | + LLM classifier |
| Impact scoring | Basic (usage count) | Full (usage × spread × path) | + Custom criticality paths |
| Remediation | Link to changelog | + Registry suggestions | + AI code suggestions |
| Team members | 1 | 10 | Unlimited |
| SSO/SAML | — | — | ✅ |
| Self-hosted | — | — | ✅ (Docker) |
| SLA | — | — | 99.9% uptime |

## Onboarding Flow

### Step 1: Local Scan (No Account)

```bash
npm install -g thirdwatch
thirdwatch scan .
# → Produces thirdwatch.json with full dependency map
# → No account, no network, no telemetry
```

### Step 2: Login (GitHub OAuth)

```bash
thirdwatch login
# → Opens browser to https://app.thirdwatch.dev/login
# → GitHub OAuth → creates Thirdwatch org from GitHub org
# → Stores API key in ~/.config/thirdwatch/credentials.json
```

### Step 3: Push TDM

```bash
thirdwatch push
# → Uploads thirdwatch.json to cloud
# → Dashboard: "42 dependencies registered for monitoring"
# → Watcher starts polling within 1 hour
```

### Step 4: First Alert (Automated)

```
Within 6 hours, if any dependency has a new version:
→ Change detected → Classified → Impact scored → Notification sent
→ User sees Slack message or email with affected files and remediation
```

### Step 5: Connect Integrations

```
Dashboard → Settings → Integrations
→ Connect Slack workspace → Select channels
→ Connect GitHub App → Enable PR comments + Issue creation
→ Configure routing: P0 → #incidents, P3 → weekly digest
```

## System Architecture

```
                    ┌──────────────────┐
                    │   apps/web       │
                    │   Dashboard      │
                    │   (Next.js 15)   │
                    └────────┬─────────┘
                             │ REST API calls
                             ▼
┌──────────┐  POST   ┌──────────────┐         ┌──────────────┐
│ CLI user │ ──────→ │  apps/api    │ ──────→ │  PostgreSQL  │
│ thirdwatch│  /tdm   │  (Fastify)   │         │  (primary)   │
│ push     │         │              │         └──────┬───────┘
└──────────┘         │  Auth: x-api │                │
                     │  -key header │                │ read
┌──────────┐  GitHub │              │         ┌──────▼───────┐
│ GitHub   │  OAuth  │  Rate limit  │         │  apps/worker │
│ Actions  │ ──────→ │  CORS        │         │  (BullMQ)    │
│ CI gate  │         └──────────────┘         │              │
└──────────┘                                  │  Jobs:       │
                                              │  • check-dep │
                                              │  • classify  │
                                              │  • analyze   │
                                              │  • notify    │
                                              └──────┬───────┘
                                                     │
                              ┌───────────┬──────────┼───────────┐
                              ▼           ▼          ▼           ▼
                        ┌─────────┐ ┌─────────┐ ┌────────┐ ┌────────┐
                        │   npm   │ │  PyPI   │ │ GitHub │ │ crates │
                        │registry │ │  JSON   │ │Releases│ │  .io   │
                        └─────────┘ └─────────┘ └────────┘ └────────┘
                                                     │
                                              ┌──────▼───────┐
                                              │   Notifier   │
                                              │ Slack/GitHub/ │
                                              │ Jira/Email   │
                                              └──────────────┘
```

## Cloud API Specification

### Authentication

All API calls use `x-api-key` header (matches CLI push):

```
x-api-key: tw_live_xxxxxxxxxxxxxxxxxxxxx
```

API keys are scoped to an org and have configurable permissions (read, write, admin).

### Endpoints

#### `POST /api/v1/auth/github`

Exchange GitHub OAuth code for Thirdwatch session:

```typescript
// Request
{ code: string; state: string }

// Response 200
{
  token: "tw_live_xxx...",
  org: { id: "uuid", name: "acme-corp", plan: "free" },
  user: { id: "uuid", login: "alice", avatar_url: "..." }
}
```

#### `POST /api/v1/tdm`

Upload a TDM for monitoring:

```typescript
// Request: TDM JSON body (validated by @thirdwatch/tdm)
// Headers: x-api-key, Content-Type: application/json

// Response 201
{
  tdmId: "uuid",
  repository: "acme-corp/payments",
  dependenciesRegistered: 42,
  newDependencies: 3,
  removedDependencies: 1,
  monitoringStarted: true
}
```

#### `GET /api/v1/tdm/baseline`

Download latest TDM for a repository (used by CI gate):

```typescript
// Query: ?repository=acme-corp/payments
// Response 200: TDM JSON
// Response 404: No baseline exists
```

#### `GET /api/v1/changes`

List change events for the org:

```typescript
// Query params:
//   since: ISO date (default: 7 days ago)
//   priority: P0,P1 (comma-separated filter)
//   dependency: stripe (filter by provider)
//   repository: acme-corp/payments
//   limit: 50 (default)
//   offset: 0

// Response 200
{
  changes: [
    {
      id: "uuid",
      dependency: { identifier: "stripe@pypi", provider: "stripe", currentVersion: "7.0.0" },
      detectedAt: "2026-02-24T10:00:00Z",
      changeType: "breaking",
      previousVersion: "7.0.0",
      newVersion: "8.0.0",
      title: "Stripe Python SDK v8.0.0 — breaking changes",
      priority: "P0",
      impactScore: 45.0,
      affectedFiles: 12,
      affectedUsages: 47,
      humanSummary: "stripe has a breaking change (8.0.0). Found 47 usages across 12 files.",
      notified: true,
      url: "https://github.com/stripe/stripe-python/releases/tag/v8.0.0"
    }
  ],
  total: 156,
  hasMore: true
}
```

#### `GET /api/v1/changes/:id`

Get full change event with impact assessment:

```typescript
// Response 200
{
  ...changeEvent,
  assessment: {
    priority: "P0",
    score: 45.0,
    components: { severity: 5, usage: 3, spread: 3, path: 1 },
    affectedLocations: [
      { file: "payments/stripe_client.py", line: 47, context: "stripe.Charge.create(...)", usageType: "method_call" },
      { file: "checkout/handler.py", line: 112, context: "stripe.PaymentIntent.create(...)", usageType: "method_call" }
    ],
    remediation: {
      type: "update-import",
      description: "The `source` parameter was removed. Use `payment_method` instead.",
      suggestedDiff: "- stripe.Charge.create(amount=amount, source=token)\n+ stripe.PaymentIntent.create(amount=amount, payment_method=token)",
      migrationGuideUrl: "https://stripe.com/docs/upgrades#2023-10-16",
      isAIGenerated: false
    }
  },
  classification: {
    category: "breaking",
    confidence: "high",
    reasoning: "Changelog contains 'BREAKING CHANGE: removed source parameter'",
    classifierUsed: "keywords"
  }
}
```

#### `GET /api/v1/dependencies`

List all monitored dependencies for the org:

```typescript
// Response 200
{
  dependencies: [
    {
      id: "uuid",
      identifier: "stripe@pypi",
      kind: "package",
      provider: "stripe",
      ecosystem: "pypi",
      currentVersion: "7.0.0",
      latestVersion: "8.0.0",
      repositories: ["acme-corp/payments", "acme-corp/billing"],
      totalUsages: 47,
      totalFiles: 12,
      lastCheckedAt: "2026-02-24T10:00:00Z",
      status: "outdated"
    }
  ]
}
```

#### `GET /api/v1/org/usage`

Usage metrics for billing enforcement:

```typescript
// Response 200
{
  plan: "team",
  repositories: { used: 8, limit: null },
  dependencies: { monitored: 342 },
  changes: { last30Days: 47 },
  notifications: { sent: 23, failed: 1 },
  storage: { tdmsStored: 24, oldestTdm: "2025-12-01T..." }
}
```

## Database Schema

```sql
-- migrations/001_initial.sql

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  github_org TEXT,
  plan TEXT NOT NULL DEFAULT 'free',        -- free, team, enterprise
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  github_login TEXT NOT NULL,
  github_id INTEGER NOT NULL UNIQUE,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',      -- admin, member
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  key_hash TEXT NOT NULL UNIQUE,            -- SHA-256 of the key
  key_prefix TEXT NOT NULL,                 -- "tw_live_xxx..." for display
  name TEXT,
  permissions TEXT[] DEFAULT '{read,write}',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tdm_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  repository TEXT NOT NULL,
  scanner_version TEXT,
  languages TEXT[],
  dependency_count INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  tdm JSONB NOT NULL,
  is_baseline BOOLEAN DEFAULT false
);

CREATE INDEX idx_tdm_uploads_repo ON tdm_uploads (org_id, repository, uploaded_at DESC);

CREATE TABLE watched_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  identifier TEXT NOT NULL,                 -- "stripe@pypi"
  kind TEXT NOT NULL,                       -- package, api, sdk
  ecosystem TEXT,
  provider TEXT,
  current_version TEXT,
  latest_version TEXT,
  github_repo TEXT,
  changelog_url TEXT,
  last_checked_at TIMESTAMPTZ,
  last_seen_version TEXT,
  etag TEXT,                                -- For conditional requests
  last_modified TEXT,                       -- For conditional requests
  repositories TEXT[],                      -- Which repos use this dep
  total_usages INTEGER DEFAULT 0,
  total_files INTEGER DEFAULT 0,
  UNIQUE (org_id, identifier)
);

CREATE INDEX idx_watched_deps_check ON watched_dependencies (last_checked_at ASC);

CREATE TABLE change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  dependency_id UUID REFERENCES watched_dependencies(id),
  detected_at TIMESTAMPTZ DEFAULT now(),
  change_type TEXT NOT NULL,                -- breaking, deprecation, etc.
  previous_version TEXT,
  new_version TEXT,
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  semver_type TEXT,                         -- major, minor, patch
  raw_data JSONB,
  -- Classification fields
  classification_confidence TEXT,
  classifier_used TEXT,
  classification_reasoning TEXT,
  -- Impact assessment fields
  priority TEXT,
  impact_score FLOAT,
  affected_files INTEGER,
  affected_usages INTEGER,
  human_summary TEXT,
  suppressed BOOLEAN DEFAULT false,
  suppression_rule TEXT,
  -- Notification tracking
  notified BOOLEAN DEFAULT false,
  notified_at TIMESTAMPTZ
);

CREATE INDEX idx_change_events_org ON change_events (org_id, detected_at DESC);
CREATE INDEX idx_change_events_priority ON change_events (org_id, priority, detected_at DESC);

CREATE TABLE affected_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_event_id UUID REFERENCES change_events(id),
  file TEXT NOT NULL,
  line INTEGER NOT NULL,
  context TEXT,
  usage_type TEXT
);

CREATE TABLE remediation_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_event_id UUID REFERENCES change_events(id),
  suggestion_type TEXT NOT NULL,
  description TEXT NOT NULL,
  suggested_diff TEXT,
  migration_guide_url TEXT,
  is_ai_generated BOOLEAN DEFAULT false
);

CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  change_event_id UUID REFERENCES change_events(id),
  channel TEXT NOT NULL,                    -- slack, github, jira, email, webhook
  status TEXT NOT NULL,                     -- sent, failed, deduplicated
  external_id TEXT,                         -- GitHub issue number, Jira key, etc.
  external_url TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  type TEXT NOT NULL,                       -- slack, github, jira, email, webhook
  name TEXT NOT NULL,
  config JSONB NOT NULL,                    -- Channel-specific config (encrypted)
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  channel_id UUID REFERENCES notification_channels(id),
  priority TEXT[],                          -- ["P0", "P1"]
  change_category TEXT[],                   -- ["breaking", "security"]
  repositories TEXT[],
  schedule TEXT DEFAULT 'immediate',        -- immediate, daily, weekly
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Worker Job Pipeline

The worker processes a chain of jobs for each detected change:

```
[check-dependency] → [classify-change] → [analyze-impact] → [send-notifications]
      (Plan 7)            (Plan 8)            (Plan 9)           (Plan 10)
```

```typescript
// apps/worker/src/pipelines/change-pipeline.ts

export async function processNewVersion(
  dependency: WatchedDependency,
  newVersion: string,
  releaseData: RawReleaseData,
): Promise<void> {
  // 1. Create change event
  const changeEvent = await db.createChangeEvent({
    dependencyId: dependency.id,
    orgId: dependency.orgId,
    changeType: "informational", // Will be updated by classifier
    previousVersion: dependency.lastSeenVersion,
    newVersion,
    title: `${dependency.identifier} ${newVersion}`,
    body: releaseData.changelog,
    url: releaseData.url,
    rawData: releaseData,
  });

  // 2. Classify
  const classification = await classifyChange({
    dependency,
    previousVersion: dependency.lastSeenVersion,
    newVersion,
    changelogText: releaseData.changelog,
  });

  await db.updateChangeEvent(changeEvent.id, {
    changeType: classification.category,
    classificationConfidence: classification.confidence,
    classifierUsed: classification.classifierUsed,
    classificationReasoning: classification.reasoning,
  });

  // 3. Impact analysis (needs the org's latest TDM)
  const tdm = await db.getLatestTDM(dependency.orgId, dependency.repositories[0]);
  if (tdm) {
    const assessment = computeImpactAssessment(changeEvent, dependency, tdm);
    await db.updateChangeEvent(changeEvent.id, {
      priority: assessment.priority,
      impactScore: assessment.score,
      affectedFiles: assessment.affectedLocations.length,
      humanSummary: assessment.humanSummary,
    });

    // Store affected locations
    await db.insertAffectedLocations(changeEvent.id, assessment.affectedLocations);

    // Store remediation if available
    if (assessment.remediation) {
      await db.insertRemediation(changeEvent.id, assessment.remediation);
    }
  }

  // 4. Notify (respects routing rules and suppression)
  const org = await db.getOrg(dependency.orgId);
  if (!changeEvent.suppressed) {
    const routes = await db.getRoutingRules(org.id);
    await notifyAllChannels(changeEvent, routes);
  }

  // 5. Update dependency's last seen version
  await db.updateWatchedDependency(dependency.id, {
    lastSeenVersion: newVersion,
    latestVersion: newVersion,
    lastCheckedAt: new Date(),
  });
}
```

## Dashboard (app.thirdwatch.dev)

### Overview Page

```
┌─────────────────────────────────────────────────────────┐
│  Thirdwatch Dashboard                    [acme-corp ▾]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │   342   │ │   47    │ │    3    │ │    8    │      │
│  │  deps   │ │ changes │ │  P0/P1  │ │  repos  │      │
│  │monitored│ │ (30d)   │ │  open   │ │  active │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
│                                                         │
│  Recent Changes                          [View all →]   │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🚨 P0  stripe@pypi 7.0.0 → 8.0.0  breaking    │    │
│  │        47 usages across 12 files    2h ago      │    │
│  │ 🔴 P1  openai@npm 4.0 → 5.0       breaking     │    │
│  │        12 usages across 4 files     1d ago      │    │
│  │ 🟠 P2  boto3@pypi 1.34 → 1.35     minor        │    │
│  │        89 usages across 23 files    2d ago      │    │
│  │ ⚪ P4  eslint@npm 8.56 → 8.57     patch        │    │
│  │        1 usage in 1 file (suppressed)           │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Dependency Map Page

Visual breakdown of all external dependencies grouped by type:

- **Packages**: Grouped by ecosystem (npm, pypi, go, maven, cargo, packagist)
- **External APIs**: Grouped by provider (stripe.com, openai.com, etc.)
- **SDKs**: Grouped by provider with services_used
- **Infrastructure**: Grouped by type (postgresql, redis, mongodb, etc.)
- **Webhooks**: Grouped by direction (inbound, outbound)

### Change Detail Page

Shows full impact assessment with affected code locations, remediation suggestion, and links to the changelog/release notes.

## Billing Integration (Stripe)

```typescript
// apps/api/src/billing/stripe.ts

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createCheckoutSession(
  orgId: string,
  plan: "team" | "enterprise",
): Promise<string> {
  const priceId = plan === "team"
    ? process.env.STRIPE_TEAM_PRICE_ID!
    : process.env.STRIPE_ENTERPRISE_PRICE_ID!;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/settings/billing?success=true`,
    cancel_url: `${APP_URL}/settings/billing?canceled=true`,
    metadata: { orgId },
  });

  return session.url!;
}

// Webhook handler for subscription lifecycle
export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await db.updateOrgPlan(session.metadata!.orgId!, determinePlan(session));
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await db.downgradeOrg(sub.metadata.orgId!, "free");
      break;
    }
  }
}
```

### Tier Enforcement

```typescript
// apps/api/src/middleware/tier-guard.ts

export function tierGuard(requiredPlan: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const org = await db.getOrg(req.orgId);

    if (!requiredPlan.includes(org.plan)) {
      return reply.status(403).send({
        error: "plan_required",
        message: `This feature requires the ${requiredPlan.join(" or ")} plan.`,
        currentPlan: org.plan,
        upgradeUrl: `${APP_URL}/settings/billing`,
      });
    }
  };
}

// Usage:
fastify.post("/api/v1/notifications/channels",
  { preHandler: tierGuard(["team", "enterprise"]) },
  createChannelHandler,
);
```

### Repository Limit Enforcement

```typescript
export async function enforceRepoLimit(orgId: string): Promise<void> {
  const org = await db.getOrg(orgId);
  const repoCount = await db.countDistinctRepos(orgId);
  const limit = PLAN_LIMITS[org.plan].repositories;

  if (limit !== null && repoCount >= limit) {
    throw new PlanLimitError(
      `Your ${org.plan} plan allows ${limit} repositories. ` +
      `Upgrade to monitor more: ${APP_URL}/settings/billing`,
    );
  }
}
```

## Self-Hosted Option (Enterprise)

```yaml
# docker/compose.yml — self-hosted stack
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: thirdwatch
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    secrets:
      - db_password

  redis:
    image: redis:7-alpine

  api:
    image: ghcr.io/thirdwatch/api:latest
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgres://postgres:@postgres/thirdwatch
      REDIS_URL: redis://redis:6379
      JWT_SECRET_FILE: /run/secrets/jwt_secret
    depends_on: [postgres, redis]
    secrets:
      - db_password
      - jwt_secret

  worker:
    image: ghcr.io/thirdwatch/worker:latest
    environment:
      DATABASE_URL: postgres://postgres:@postgres/thirdwatch
      REDIS_URL: redis://redis:6379
      GITHUB_TOKEN_FILE: /run/secrets/github_token
      CHECK_INTERVAL_HOURS: 6
    depends_on: [postgres, redis]
    secrets:
      - db_password
      - github_token

  web:
    image: ghcr.io/thirdwatch/web:latest
    ports: ["8080:3000"]
    environment:
      API_URL: http://api:3000
    depends_on: [api]

secrets:
  db_password:
    file: ./secrets/db_password
  jwt_secret:
    file: ./secrets/jwt_secret
  github_token:
    file: ./secrets/github_token

volumes:
  postgres_data:
```

Self-hosted operates identically to cloud. No feature restrictions. No phone-home. Licensed under BSL 1.1 (converts to Apache 2.0 after 3 years).

## Security & Compliance

### What Data Is Stored

| Data | Stored | Notes |
|---|---|---|
| Package names + versions | ✅ | From TDM |
| File paths + line numbers | ✅ | From TDM locations |
| Code snippets (context) | ✅ | Short snippets (~80 chars) |
| Source code | ❌ | Never uploaded |
| Environment variables | ❌ | Only names, never values |
| Secrets/tokens | ❌ | Never captured by scanner |

### Encryption

- **At rest**: PostgreSQL encryption (AES-256, managed by provider)
- **In transit**: TLS 1.3 for all API calls
- **API keys**: Stored as SHA-256 hashes, never in plaintext
- **Notification configs**: Encrypted with org-specific key (Slack tokens, webhook URLs)

### Authentication

- GitHub OAuth 2.0 for user login
- API keys (`tw_live_xxx`) for programmatic access (CLI, CI)
- API keys are org-scoped with configurable permissions

### GDPR Compliance

- Personal data: GitHub username, email (from OAuth profile)
- Deletion: `DELETE /api/v1/org` removes all org data, TDMs, change events, API keys
- Data export: `GET /api/v1/org/export` returns complete data archive (JSON)
- No third-party analytics or tracking beyond Stripe billing

## Operational Metrics

### Key Metrics to Track

| Metric | Target | Alert Threshold |
|---|---|---|
| TDMs uploaded / day | — | — (growth metric) |
| Change events / day | — | — (growth metric) |
| Worker job latency p99 | <10s | >30s |
| Notification delivery rate | >99% | <95% |
| API response time p99 | <500ms | >2s |
| Watcher poll success rate | >99.5% | <98% |
| Registry API error rate | <1% | >5% |

### Business Metrics

| Metric | Description |
|---|---|
| MAU | Monthly active users (at least 1 API call) |
| Repos monitored | Total across all orgs |
| Free → Team conversion | % of free orgs that upgrade within 30 days |
| Time to first alert | Hours from first push to first notification |
| Churn signals | No TDM push in 30 days, notifications disabled |

## Implementation Phases

### Phase 19.1: Cloud API + Auth + TDM Storage (MVP)
- Fastify app in `apps/api`
- GitHub OAuth flow
- API key generation and validation
- `POST /api/v1/tdm` endpoint with TDM validation
- `GET /api/v1/tdm/baseline` endpoint
- PostgreSQL schema (organizations, users, api_keys, tdm_uploads)
- Deploy to Railway

### Phase 19.2: Dashboard MVP
- Next.js 15 app at `app.thirdwatch.dev`
- Login with GitHub OAuth
- Overview page: dependency count, recent TDM uploads
- Dependency list page: all dependencies from latest TDM
- Settings: API key management

### Phase 19.3: Watcher Integration
- Wire Plan 7 worker to cloud API
- Schedule polling jobs per dependency from uploaded TDMs
- Store change events in database
- Dashboard: change feed page with priority badges

### Phase 19.4: Classification + Impact Analysis
- Wire Plan 8 classifier into worker pipeline
- Wire Plan 9 analyzer into worker pipeline
- Dashboard: change detail page with affected code locations
- Dashboard: remediation suggestions

### Phase 19.5: Notification Integrations
- Wire Plan 10 notifier into worker pipeline
- Dashboard: notification channel management
- Dashboard: routing rule configuration
- Notification log with delivery status

### Phase 19.6: Billing + Tier Enforcement
- Stripe Billing integration (checkout, webhooks, portal)
- Tier guard middleware on all paid-tier endpoints
- Repository limit enforcement
- Polling interval enforcement per tier
- Billing page in dashboard

### Phase 19.7: Self-Hosted Docker
- Build Docker images for api, worker, web
- Publish to ghcr.io
- Write docker-compose.yml with secrets management
- Document setup in `docs/self-hosted.md`

## Acceptance Criteria

- [ ] `thirdwatch login` opens browser, completes GitHub OAuth, stores API key locally
- [ ] `thirdwatch push` uploads TDM, returns dependency count, starts monitoring
- [ ] Dashboard shows all dependencies from uploaded TDM
- [ ] Worker polls npm/PyPI every 6h for team-tier orgs, 24h for free-tier
- [ ] New npm version triggers change event → classification → impact scoring → notification
- [ ] Slack notification arrives within 5 minutes of change detection
- [ ] P0 alert routes to #incidents channel, P4 goes to weekly digest
- [ ] Free tier enforces 3-repo limit (returns 403 on 4th push)
- [ ] Team upgrade via Stripe checkout works end-to-end
- [ ] Self-hosted Docker stack starts with `docker compose up` and is fully functional
- [ ] `DELETE /api/v1/org` removes all org data (GDPR compliance)
- [ ] API key hashing prevents plaintext key exposure in database
- [ ] No source code is ever transmitted to or stored in the cloud
- [ ] Dashboard loads in <2s, API responses in <500ms p99

## File Inventory

| File | Description |
|---|---|
| `apps/api/src/index.ts` | Fastify server entry |
| `apps/api/src/routes/auth.ts` | GitHub OAuth flow |
| `apps/api/src/routes/tdm.ts` | TDM upload + baseline endpoints |
| `apps/api/src/routes/changes.ts` | Change event query endpoints |
| `apps/api/src/routes/dependencies.ts` | Dependency listing |
| `apps/api/src/routes/notifications.ts` | Channel + routing management |
| `apps/api/src/routes/org.ts` | Org settings, usage, export, delete |
| `apps/api/src/routes/billing.ts` | Stripe checkout + webhook |
| `apps/api/src/middleware/auth.ts` | API key + session validation |
| `apps/api/src/middleware/tier-guard.ts` | Plan-based access control |
| `apps/api/src/billing/stripe.ts` | Stripe integration |
| `apps/worker/src/index.ts` | Worker entry point |
| `apps/worker/src/pipelines/change-pipeline.ts` | Full change processing pipeline |
| `apps/worker/src/scheduler.ts` | BullMQ job scheduling |
| `apps/web/app/dashboard/page.tsx` | Dashboard overview |
| `apps/web/app/changes/page.tsx` | Change feed |
| `apps/web/app/changes/[id]/page.tsx` | Change detail + assessment |
| `apps/web/app/dependencies/page.tsx` | Dependency map |
| `apps/web/app/settings/page.tsx` | Settings + integrations |
| `apps/web/app/settings/billing/page.tsx` | Billing + plan management |
| `migrations/001_initial.sql` | Full database schema |
| `docker/compose.yml` | Self-hosted stack |
| `docker/api.Dockerfile` | API Docker image |
| `docker/worker.Dockerfile` | Worker Docker image |
| `docker/web.Dockerfile` | Dashboard Docker image |
| `docs/self-hosted.md` | Self-hosted setup guide |

## References

- [Fastify](https://fastify.dev/)
- [BullMQ](https://docs.bullmq.io/)
- [Stripe Billing](https://stripe.com/docs/billing)
- [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps)
- [Railway deployment](https://railway.app/)
- Plans 7, 8, 9, 10 (component plans)
- PRD FR-2.x, FR-3.x, FR-4.x
