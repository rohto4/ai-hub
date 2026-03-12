CREATE TABLE IF NOT EXISTS source_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  fetch_kind text NOT NULL CHECK (fetch_kind IN ('rss', 'api', 'alerts', 'manual')),
  source_category text NOT NULL,
  base_url text,
  is_active boolean NOT NULL DEFAULT true,
  fetch_interval_minutes integer NOT NULL DEFAULT 60,
  supports_update_detection boolean NOT NULL DEFAULT false,
  requires_auth boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_priority_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_target_id uuid NOT NULL REFERENCES source_targets(id) ON DELETE CASCADE,
  usage_type text NOT NULL CHECK (usage_type IN ('public_primary', 'public_secondary')),
  priority_score integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_target_id, usage_type)
);

CREATE INDEX IF NOT EXISTS idx_source_targets_active
  ON source_targets (is_active, fetch_interval_minutes);

CREATE INDEX IF NOT EXISTS idx_source_priority_rules_usage
  ON source_priority_rules (usage_type, priority_score DESC)
  WHERE is_active = true;

COMMENT ON TABLE source_targets IS '取得元マスタTBL';
COMMENT ON TABLE source_priority_rules IS '取得元優先度マスタTBL';
