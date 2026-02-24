export type {
  ChannelType,
  ChannelConfig,
  Schedule,
  RoutingRule,
  NotifierConfig,
  NotificationResult,
  NotifierAdapter,
  DeliveryRecord,
  DeduplicationStore,
} from "./types.js";

export { Notifier } from "./notifier.js";

export { resolveRoutes } from "./routing.js";

export { InMemoryDeduplicationStore } from "./dedup.js";

export { WebhookAdapter, signPayload } from "./adapters/webhook.js";
export type { WebhookSettings, WebhookPayload } from "./adapters/webhook.js";
