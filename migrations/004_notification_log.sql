CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_event_id UUID REFERENCES change_events(id),
  channel_id TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  external_id TEXT,
  url TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  deduplicated BOOLEAN NOT NULL DEFAULT false,
  delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_log_change_event ON notification_log(change_event_id);
CREATE INDEX idx_notification_log_channel ON notification_log(channel_id);
