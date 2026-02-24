import type { ImpactAssessment } from "@thirdwatch/analyzer";
import type {
  ChannelConfig,
  DeduplicationStore,
  NotifierAdapter,
  NotifierConfig,
  NotificationResult,
} from "./types.js";
import { resolveRoutes } from "./routing.js";
import { InMemoryDeduplicationStore } from "./dedup.js";
import { WebhookAdapter } from "./adapters/webhook.js";
import type { WebhookSettings } from "./adapters/webhook.js";

// ---------------------------------------------------------------------------
// Adapter factory — creates adapters from channel configuration
// ---------------------------------------------------------------------------

function createAdapter(channel: ChannelConfig): NotifierAdapter {
  switch (channel.type) {
    case "webhook":
      return new WebhookAdapter(channel.settings as unknown as WebhookSettings);
    default:
      throw new Error(`Unsupported channel type: ${channel.type}`);
  }
}

// ---------------------------------------------------------------------------
// Notifier — routes assessments to configured channels
// ---------------------------------------------------------------------------

export class Notifier {
  private adapters: Map<string, NotifierAdapter> = new Map();
  private dedupStore: DeduplicationStore;

  constructor(
    private config: NotifierConfig,
    dedupStore?: DeduplicationStore | undefined,
  ) {
    this.dedupStore = dedupStore ?? new InMemoryDeduplicationStore();

    for (const channel of config.channels) {
      this.adapters.set(channel.id, createAdapter(channel));
    }
  }

  async notify(assessment: ImpactAssessment): Promise<NotificationResult[]> {
    const routes = resolveRoutes(assessment, this.config.routing);

    if (routes.length === 0) {
      return [];
    }

    const deduplicate = this.config.deduplicate !== false;

    const settled = await Promise.allSettled(
      routes.map(async (route): Promise<NotificationResult> => {
        const adapter = this.adapters.get(route.channel);
        if (!adapter) {
          return {
            channelId: route.channel,
            success: false,
            error: `No adapter registered for channel "${route.channel}"`,
          };
        }

        if (deduplicate) {
          const existing = await this.dedupStore.find(
            assessment.changeEventId,
            route.channel,
          );
          if (existing) {
            return {
              channelId: route.channel,
              success: true,
              deduplicated: true,
              url: existing.url,
            };
          }
        }

        const result = await adapter.send(assessment);

        if (result.success) {
          await this.dedupStore.record({
            changeEventId: assessment.changeEventId,
            channelId: route.channel,
            externalId: result.externalId,
            url: result.url,
            deliveredAt: new Date(),
          });
        }

        return result;
      }),
    );

    return settled.map((s) =>
      s.status === "fulfilled"
        ? s.value
        : {
            channelId: "unknown",
            success: false,
            error: s.reason instanceof Error ? s.reason.message : String(s.reason),
          },
    );
  }
}
