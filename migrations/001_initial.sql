CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tdm_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  repository TEXT,
  scanner_version TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  tdm JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS watched_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  tdm_id UUID REFERENCES tdm_uploads(id),
  kind TEXT NOT NULL,
  identifier TEXT NOT NULL,
  ecosystem TEXT,
  github_repo TEXT,
  current_version TEXT,
  last_seen_version TEXT,
  last_checked_at TIMESTAMPTZ,
  UNIQUE (org_id, identifier)
);

CREATE TABLE IF NOT EXISTS change_events (
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
  priority TEXT,
  notified BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_change_events_org_detected ON change_events (org_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_watched_deps_last_checked ON watched_dependencies (last_checked_at);
