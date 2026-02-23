ALTER TABLE change_events
  ADD COLUMN impact_score FLOAT,
  ADD COLUMN human_summary TEXT,
  ADD COLUMN suppressed BOOLEAN DEFAULT false,
  ADD COLUMN suppression_rule TEXT;

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
