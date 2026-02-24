import type { DeliveryRecord, DeduplicationStore } from "./types.js";

// ---------------------------------------------------------------------------
// In-memory deduplication store — suitable for CLI and testing
// ---------------------------------------------------------------------------

export class InMemoryDeduplicationStore implements DeduplicationStore {
  private records: DeliveryRecord[] = [];

  async find(
    changeEventId: string,
    channelId: string,
  ): Promise<DeliveryRecord | undefined> {
    return this.records.find(
      (r) => r.changeEventId === changeEventId && r.channelId === channelId,
    );
  }

  async record(delivery: DeliveryRecord): Promise<void> {
    this.records.push(delivery);
  }
}
