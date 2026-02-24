import { createHmac } from "node:crypto";
import type { ImpactAssessment } from "@thirdwatch/analyzer";
import type { NotifierAdapter, NotificationResult } from "../types.js";

// ---------------------------------------------------------------------------
// Webhook settings
// ---------------------------------------------------------------------------

export interface WebhookSettings {
  url: string;
  /** HMAC secret for signing payloads */
  secret?: string | undefined;
  /** Timeout in milliseconds (default: 10_000) */
  timeoutMs?: number | undefined;
}

// ---------------------------------------------------------------------------
// Webhook payload
// ---------------------------------------------------------------------------

export interface WebhookPayload {
  version: "1";
  event: "change_detected";
  assessment: {
    priority: string;
    changeType: string;
    dependency: string;
    /** Deferred until ImpactAssessment carries version data from Classifier */
    version: {
      from?: string | undefined;
      to?: string | undefined;
    };
    summary: string;
    affectedFiles: number;
    url: string;
  };
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 signature
// ---------------------------------------------------------------------------

export function signPayload(payload: string, secret: string): string {
  return (
    "sha256=" + createHmac("sha256", secret).update(payload).digest("hex")
  );
}

// ---------------------------------------------------------------------------
// Webhook adapter
// ---------------------------------------------------------------------------

export class WebhookAdapter implements NotifierAdapter {
  constructor(private settings: WebhookSettings) {}

  async send(assessment: ImpactAssessment): Promise<NotificationResult> {
    const payload = this.buildPayload(assessment);
    const body = JSON.stringify(payload);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.settings.secret) {
      headers["X-Thirdwatch-Signature"] = signPayload(
        body,
        this.settings.secret,
      );
    }

    const timeoutMs = this.settings.timeoutMs ?? 10_000;

    try {
      const response = await fetch(this.settings.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });

      return {
        channelId: "webhook",
        success: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        channelId: "webhook",
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private buildPayload(assessment: ImpactAssessment): WebhookPayload {
    return {
      version: "1",
      event: "change_detected",
      assessment: {
        priority: assessment.priority,
        changeType: assessment.changeCategory,
        dependency: assessment.dependencyIdentifier,
        version: { from: undefined, to: undefined },
        summary: assessment.humanSummary,
        affectedFiles: new Set(
          assessment.affectedLocations.map((l) => l.file),
        ).size,
        url: `https://app.thirdwatch.dev/changes/${assessment.changeEventId}`,
      },
    };
  }
}
