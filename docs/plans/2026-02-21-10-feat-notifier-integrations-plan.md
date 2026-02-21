---
title: "feat: Notifier — GitHub, Slack, Jira, Email & Webhook Integrations"
type: feat
phase: 2–3 (Slack/Email in Phase 2, GitHub/Jira in Phase 3)
date: 2026-02-21
priority: P0 (Phase 2+)
dependencies: Plan 7 (Watcher), Plan 9 (Analyzer)
package: packages/notifier
---

# feat: Notifier — Integrations (GitHub, Slack, Jira, Email, Webhook)

## Overview

Build `@thirdwatch/notifier` — Layer 4. The Notifier routes prioritized `ImpactAssessment` objects to the right destination: GitHub Issues, Slack messages, Jira tickets, email digests, or arbitrary webhooks. It handles deduplication (don't create a second GitHub Issue for the same change), channel routing (P0 → #incidents, P3 → weekly digest), and delivery guarantees (at-least-once with idempotency).

## Problem Statement

An alert that doesn't reach the right person at the right time in the right format is worthless. Developers live in Slack. Engineering managers live in Jira and email. Platform teams live in GitHub Issues. The Notifier must meet people where they already are, with enough signal in the notification itself that a developer can triage without clicking through.

## Proposed Solution

A `@thirdwatch/notifier` package exposing a unified `notify(assessment)` interface with pluggable adapters per channel. Each adapter handles: message formatting, deduplication, and delivery. The notification configuration lives in `.thirdwatch.yml` or the cloud dashboard.

## Technical Approach

### Core Notifier Interface

```typescript
// packages/notifier/src/types.ts

export interface NotifierConfig {
  channels: ChannelConfig[];
  routing: RoutingRule[];
  deduplicate: boolean;  // Default: true
}

export interface ChannelConfig {
  type: "github" | "slack" | "jira" | "email" | "webhook";
  id: string;           // User-defined name, e.g., "main-slack"
  settings: Record<string, unknown>;
}

export interface RoutingRule {
  channel: string;      // Matches ChannelConfig.id
  priority?: Priority[];        // Route P0/P1 only
  changeCategory?: ChangeCategory[];
  repositories?: string[];
  schedule?: "immediate" | "daily" | "weekly";
}

export interface NotificationResult {
  channelId: string;
  success: boolean;
  externalId?: string;   // e.g., GitHub issue number, Jira ticket key
  url?: string;          // Link to the created issue/message
  error?: string;
  deduplicated?: boolean; // true if skipped because already notified
}
```

### Unified Notifier (`packages/notifier/src/notifier.ts`)

```typescript
// packages/notifier/src/notifier.ts

export class Notifier {
  private adapters: Map<string, NotifierAdapter> = new Map();

  constructor(private config: NotifierConfig) {
    for (const channel of config.channels) {
      this.adapters.set(channel.id, createAdapter(channel));
    }
  }

  async notify(assessment: ImpactAssessment): Promise<NotificationResult[]> {
    const routes = this.resolveRoutes(assessment);
    const results = await Promise.allSettled(
      routes.map(async route => {
        const adapter = this.adapters.get(route.channel)!;

        // Deduplication check
        if (this.config.deduplicate) {
          const existing = await this.checkDedup(assessment, route.channel);
          if (existing) return { channelId: route.channel, success: true, deduplicated: true, url: existing.url };
        }

        const result = await adapter.send(assessment);
        await this.recordDelivery(assessment, route.channel, result);
        return result;
      })
    );
    return results.map(r => r.status === "fulfilled" ? r.value : { channelId: "unknown", success: false });
  }
}
```

---

## GitHub Integration (Phase 3)

### GitHub App Setup
- Permissions: Issues (write), Pull Requests (write), Checks (write)
- Installed at org level — covers all repos in the org
- One GitHub App installation per Thirdwatch org

### GitHub Issues Adapter (`packages/notifier/src/adapters/github-issues.ts`)

```typescript
// packages/notifier/src/adapters/github-issues.ts
import { Octokit } from "@octokit/rest";

export class GitHubIssuesAdapter implements NotifierAdapter {
  constructor(private octokit: Octokit, private settings: GitHubSettings) {}

  async send(assessment: ImpactAssessment): Promise<NotificationResult> {
    const { title, body, labels } = this.formatIssue(assessment);

    const issue = await this.octokit.issues.create({
      owner: this.settings.owner,
      repo: this.settings.repo,
      title,
      body,
      labels,
    });

    return {
      channelId: "github",
      success: true,
      externalId: String(issue.data.number),
      url: issue.data.html_url,
    };
  }

  private formatIssue(assessment: ImpactAssessment): GitHubIssuePayload {
    const dep = assessment.changeEvent.dependency.identifier;
    const priority = assessment.priority;
    const category = assessment.changeEvent.changeType;

    return {
      title: `[${priority}] ${dep}: ${category} detected (${assessment.changeEvent.newVersion})`,
      body: this.buildIssueBody(assessment),
      labels: ["thirdwatch", category, priority, "automated"],
    };
  }

  private buildIssueBody(assessment: ImpactAssessment): string {
    const { changeEvent, affectedLocations, remediationSuggestion } = assessment;
    const dep = changeEvent.dependency.identifier;

    return `## Thirdwatch Alert

**Dependency:** ${dep}
**Change type:** \`${changeEvent.changeType}\`
**Version:** ${changeEvent.previousVersion} → ${changeEvent.newVersion}
**Priority:** ${assessment.priority}

### Summary
${assessment.humanSummary}

${changeEvent.body ? `### What Changed\n${changeEvent.body}\n` : ""}

### Affected Code (${affectedLocations.length} locations)
${affectedLocations.slice(0, 20).map(loc =>
  `- [\`${loc.file}:${loc.line}\`](../../blob/main/${loc.file}#L${loc.line}) — ${loc.context}`
).join("\n")}
${affectedLocations.length > 20 ? `\n*...and ${affectedLocations.length - 20} more*` : ""}

${remediationSuggestion ? `### Suggested Remediation
${remediationSuggestion.description}

${remediationSuggestion.suggestedDiff ? `\`\`\`diff\n${remediationSuggestion.suggestedDiff}\n\`\`\`\n${remediationSuggestion.isAIGenerated ? "*⚠️ AI-generated suggestion — requires human review.*" : ""}` : ""}

${remediationSuggestion.migrationGuideUrl ? `[View migration guide →](${remediationSuggestion.migrationGuideUrl})` : ""}
` : ""}

---
*Detected by [Thirdwatch](https://thirdwatch.dev) · [View in dashboard →](https://app.thirdwatch.dev/changes/${assessment.changeEventId})*`;
  }
}
```

### PR Comment Mode

```typescript
// When a PR modifies files affected by a known change event, post a PR comment
export class GitHubPRCommentAdapter implements NotifierAdapter {
  async commentOnPR(
    prNumber: number,
    assessment: ImpactAssessment,
    affectedPRFiles: string[]
  ): Promise<void> {
    const body = `> ⚠️ **Thirdwatch**: This PR touches files affected by a known breaking change in **${assessment.changeEvent.dependency.identifier}**.
>
> ${assessment.humanSummary}
>
> [View full assessment →](https://app.thirdwatch.dev/changes/${assessment.changeEventId})`;

    await this.octokit.issues.createComment({ owner, repo, issue_number: prNumber, body });
  }
}
```

---

## Slack Integration (Phase 2)

### Slack Adapter (`packages/notifier/src/adapters/slack.ts`)

```typescript
// packages/notifier/src/adapters/slack.ts

export class SlackAdapter implements NotifierAdapter {
  async send(assessment: ImpactAssessment): Promise<NotificationResult> {
    const blocks = this.buildBlocks(assessment);
    const response = await this.client.chat.postMessage({
      channel: this.settings.channel,
      text: assessment.humanSummary, // Fallback for notifications
      blocks,
    });
    return { channelId: "slack", success: response.ok, url: response.message?.permalink };
  }

  private buildBlocks(assessment: ImpactAssessment): Block[] {
    const { changeEvent, priority, affectedLocations } = assessment;
    const dep = changeEvent.dependency.identifier;
    const fileCount = new Set(affectedLocations.map(l => l.file)).size;

    // Slack Block Kit structure
    return [
      {
        type: "header",
        text: { type: "plain_text", text: `${priorityEmoji(priority)} ${dep} — ${changeEvent.changeType}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Priority:*\n${priority}` },
          { type: "mrkdwn", text: `*Version:*\n${changeEvent.previousVersion} → ${changeEvent.newVersion}` },
          { type: "mrkdwn", text: `*Affected files:*\n${fileCount}` },
          { type: "mrkdwn", text: `*Usages:*\n${affectedLocations.length}` },
        ],
      },
      { type: "section", text: { type: "mrkdwn", text: assessment.humanSummary } },
      {
        type: "actions",
        elements: [
          { type: "button", text: { type: "plain_text", text: "View Full Report" }, url: `https://app.thirdwatch.dev/changes/${assessment.changeEventId}` },
        ],
      },
    ];
  }
}

function priorityEmoji(priority: Priority): string {
  return { P0: "🚨", P1: "🔴", P2: "🟠", P3: "🟡", P4: "⚪" }[priority];
}
```

### Slack Channel Routing

```yaml
# .thirdwatch.yml
notifications:
  slack:
    channels:
      - id: incidents
        webhook_url_env: SLACK_INCIDENTS_WEBHOOK
      - id: engineering-alerts
        webhook_url_env: SLACK_ENGINEERING_WEBHOOK
    routing:
      - priority: [P0]
        channel: incidents
        schedule: immediate
      - priority: [P1, P2]
        channel: engineering-alerts
        schedule: immediate
      - priority: [P3, P4]
        channel: engineering-alerts
        schedule: weekly
```

---

## Jira Integration (Phase 3)

### Jira Adapter (`packages/notifier/src/adapters/jira.ts`)

```typescript
// packages/notifier/src/adapters/jira.ts

export class JiraAdapter implements NotifierAdapter {
  async send(assessment: ImpactAssessment): Promise<NotificationResult> {
    // Deduplication: check for existing open tickets with same label
    const existingIssue = await this.findExistingIssue(assessment);
    if (existingIssue) {
      return { channelId: "jira", success: true, externalId: existingIssue.key, deduplicated: true };
    }

    const issue = await this.client.issues.createIssue({
      fields: {
        project: { key: this.settings.projectKey },
        summary: `[Thirdwatch ${assessment.priority}] ${assessment.humanSummary}`,
        description: { type: "doc", version: 1, content: this.buildADF(assessment) },
        issuetype: { name: this.priorityToIssueType(assessment.priority) },
        priority: { name: this.priorityToJiraPriority(assessment.priority) },
        labels: ["thirdwatch", assessment.changeEvent.changeType],
      },
    });
    return { channelId: "jira", success: true, externalId: issue.key, url: `${this.settings.baseUrl}/browse/${issue.key}` };
  }

  private priorityToJiraPriority(priority: Priority): string {
    return { P0: "Blocker", P1: "Critical", P2: "Major", P3: "Minor", P4: "Trivial" }[priority];
  }
}
```

---

## Email Digest (Phase 2)

### Email Digest (`packages/notifier/src/adapters/email.ts`)

```typescript
// packages/notifier/src/adapters/email.ts
// Sends a daily/weekly digest via Resend (or SMTP)

export class EmailDigestAdapter {
  async sendDigest(
    changes: ImpactAssessment[],
    recipients: string[],
    period: "daily" | "weekly"
  ): Promise<void> {
    const html = this.renderDigestHtml(changes, period);
    await this.resend.emails.send({
      from: "alerts@thirdwatch.dev",
      to: recipients,
      subject: `Thirdwatch ${period} digest — ${changes.length} changes across your repos`,
      html,
    });
  }

  private renderDigestHtml(changes: ImpactAssessment[], period: string): string {
    // Group by priority: P0/P1 first, then P2+
    // Table format: Dependency | Type | Priority | Files Affected | Action
    // Plain HTML — no dependencies, works in all email clients
  }
}
```

---

## Generic Webhook Integration

```typescript
// packages/notifier/src/adapters/webhook.ts
export class WebhookAdapter implements NotifierAdapter {
  async send(assessment: ImpactAssessment): Promise<NotificationResult> {
    const payload = {
      version: "1",
      event: "change_detected",
      assessment: {
        priority: assessment.priority,
        changeType: assessment.changeEvent.changeType,
        dependency: assessment.changeEvent.dependency.identifier,
        version: { from: assessment.changeEvent.previousVersion, to: assessment.changeEvent.newVersion },
        summary: assessment.humanSummary,
        affectedFiles: assessment.affectedLocations.length,
        url: `https://app.thirdwatch.dev/changes/${assessment.changeEventId}`,
      },
    };

    const response = await fetch(this.settings.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Thirdwatch-Signature": sign(payload) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    return { channelId: "webhook", success: response.ok };
  }
}
```

### Webhook Signature Verification

```typescript
// HMAC-SHA256 signature for webhook consumers to verify authenticity
// Header: X-Thirdwatch-Signature: sha256=<hex>
export function sign(payload: object): string {
  return "sha256=" + createHmac("sha256", process.env.WEBHOOK_SECRET!)
    .update(JSON.stringify(payload))
    .digest("hex");
}
```

## Implementation Phases

### Phase 10.1: Core Notifier + Webhook
- Implement `Notifier` class with routing and deduplication
- Implement `WebhookAdapter` (simplest adapter, good for integration testing)
- Write integration test: assessment → webhook → verify payload

### Phase 10.2: Slack (Phase 2)
- Implement `SlackAdapter` with Block Kit formatting
- Implement channel routing rules
- Test: P0 goes to #incidents, P3 goes to weekly queue

### Phase 10.3: Email Digest (Phase 2)
- Implement `EmailDigestAdapter` using Resend
- Implement digest scheduler (BullMQ cron: daily at 9am, weekly on Monday)
- Test: digest contains correct changes grouped by priority

### Phase 10.4: GitHub Issues (Phase 3)
- Implement GitHub App OAuth and installation flow
- Implement `GitHubIssuesAdapter` with full body formatting
- Implement deduplication (check existing open issues with `thirdwatch` label)
- Test: two identical assessments → only one GitHub Issue created

### Phase 10.5: GitHub PR Comments (Phase 3)
- Implement PR comment detection: on PR webhook, check if changed files overlap with affected locations
- Implement `GitHubPRCommentAdapter`
- Register GitHub App webhook for `pull_request.opened` events

### Phase 10.6: Jira (Phase 3)
- Implement `JiraAdapter` with ADF body formatting
- Implement priority → Jira priority mapping
- Implement deduplication by label check

## Acceptance Criteria

- [ ] A P0 assessment triggers immediate Slack notification to #incidents
- [ ] A P4 assessment is queued for weekly email digest, not immediate Slack
- [ ] GitHub Issues are created with correct labels (`thirdwatch`, `breaking`, `P0`)
- [ ] Second identical assessment does NOT create a duplicate GitHub Issue
- [ ] Jira tickets map P0 → Blocker, P1 → Critical correctly
- [ ] Webhook payload is signed with HMAC-SHA256
- [ ] Webhook consumer can verify signature
- [ ] Email digest renders correctly in Gmail, Outlook, Apple Mail (test with Litmus/manual)
- [ ] All adapters handle network failures gracefully (retry or fail silently with log)

## File Inventory

| File | Description |
|---|---|
| `packages/notifier/src/types.ts` | NotifierConfig, RoutingRule, NotificationResult |
| `packages/notifier/src/notifier.ts` | Unified Notifier class |
| `packages/notifier/src/adapters/github-issues.ts` | GitHub Issues adapter |
| `packages/notifier/src/adapters/github-pr.ts` | GitHub PR comment adapter |
| `packages/notifier/src/adapters/slack.ts` | Slack adapter |
| `packages/notifier/src/adapters/jira.ts` | Jira adapter |
| `packages/notifier/src/adapters/email.ts` | Email digest adapter |
| `packages/notifier/src/adapters/webhook.ts` | Generic webhook adapter |
| `packages/notifier/src/dedup.ts` | Deduplication logic |
| `packages/notifier/src/routing.ts` | Routing rule engine |
| `packages/notifier/src/__tests__/notifier.test.ts` | Integration tests |
| `apps/api/src/routes/webhooks.ts` | GitHub App webhook receiver |
| `migrations/004_notification_log.sql` | Delivery log table |

## References

- [Slack Block Kit Builder](https://api.slack.com/block-kit/building)
- [GitHub Apps documentation](https://docs.github.com/en/apps)
- [Jira REST API — Create Issue](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post)
- [Resend Email API](https://resend.com/docs)
- PRD FR-4.1 through FR-4.6
