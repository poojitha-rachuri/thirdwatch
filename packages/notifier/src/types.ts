import type { Priority, ChangeCategory } from "@thirdwatch/tdm";
import type { ImpactAssessment } from "@thirdwatch/analyzer";

// ---------------------------------------------------------------------------
// Channel configuration
// ---------------------------------------------------------------------------

export type ChannelType = "github" | "slack" | "jira" | "email" | "webhook";

export interface ChannelConfig {
  type: ChannelType;
  /** User-defined name, e.g. "main-slack" */
  id: string;
  settings: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Routing rules
// ---------------------------------------------------------------------------

export type Schedule = "immediate" | "daily" | "weekly";

export interface RoutingRule {
  /** Matches ChannelConfig.id */
  channel: string;
  priority?: Priority[] | undefined;
  changeCategory?: ChangeCategory[] | undefined;
  repositories?: string[] | undefined;
  schedule?: Schedule | undefined;
}

// ---------------------------------------------------------------------------
// Notifier configuration
// ---------------------------------------------------------------------------

export interface NotifierConfig {
  channels: ChannelConfig[];
  routing: RoutingRule[];
  /** Default: true */
  deduplicate?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Notification result
// ---------------------------------------------------------------------------

export interface NotificationResult {
  channelId: string;
  success: boolean;
  /** e.g. GitHub issue number, Jira ticket key */
  externalId?: string | undefined;
  /** Link to the created issue/message */
  url?: string | undefined;
  error?: string | undefined;
  /** true if skipped because already notified */
  deduplicated?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Adapter interface — implemented by each channel
// ---------------------------------------------------------------------------

export interface NotifierAdapter {
  send(assessment: ImpactAssessment): Promise<NotificationResult>;
}

// ---------------------------------------------------------------------------
// Deduplication store
// ---------------------------------------------------------------------------

export interface DeliveryRecord {
  changeEventId: string;
  channelId: string;
  externalId?: string | undefined;
  url?: string | undefined;
  deliveredAt: Date;
}

export interface DeduplicationStore {
  find(changeEventId: string, channelId: string): Promise<DeliveryRecord | undefined>;
  record(delivery: DeliveryRecord): Promise<void>;
}
