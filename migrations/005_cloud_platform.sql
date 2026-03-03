-- 005_cloud_platform.sql — Cloud monitoring platform schema additions

-- Extend organizations with billing and GitHub org info
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS github_org TEXT,
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Users table (GitHub OAuth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  github_login TEXT NOT NULL,
  github_id INTEGER NOT NULL UNIQUE,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API keys (hashed, never stored in plaintext)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT,
  permissions TEXT[] DEFAULT '{read,write}',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Extend tdm_uploads
ALTER TABLE tdm_uploads
  ADD COLUMN IF NOT EXISTS languages TEXT[],
  ADD COLUMN IF NOT EXISTS dependency_count INTEGER,
  ADD COLUMN IF NOT EXISTS is_baseline BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tdm_uploads_repo
  ON tdm_uploads (org_id, repository, uploaded_at DESC);

-- Extend watched_dependencies
ALTER TABLE watched_dependencies
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS latest_version TEXT,
  ADD COLUMN IF NOT EXISTS changelog_url TEXT,
  ADD COLUMN IF NOT EXISTS etag TEXT,
  ADD COLUMN IF NOT EXISTS last_modified TEXT,
  ADD COLUMN IF NOT EXISTS repositories TEXT[],
  ADD COLUMN IF NOT EXISTS total_usages INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_files INTEGER DEFAULT 0;

-- Extend change_events with classification + impact fields
ALTER TABLE change_events
  ADD COLUMN IF NOT EXISTS classification_confidence TEXT,
  ADD COLUMN IF NOT EXISTS classifier_used TEXT,
  ADD COLUMN IF NOT EXISTS classification_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS affected_files INTEGER,
  ADD COLUMN IF NOT EXISTS affected_usages INTEGER,
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_change_events_priority
  ON change_events (org_id, priority, detected_at DESC);

-- Notification channels
CREATE TABLE IF NOT EXISTS notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Routing rules
CREATE TABLE IF NOT EXISTS routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  channel_id UUID REFERENCES notification_channels(id),
  priority TEXT[],
  change_category TEXT[],
  repositories TEXT[],
  schedule TEXT DEFAULT 'immediate',
  created_at TIMESTAMPTZ DEFAULT now()
);
