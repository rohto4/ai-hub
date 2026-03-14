CREATE TABLE IF NOT EXISTS job_runs (
  id bigserial PRIMARY KEY,
  job_name text NOT NULL,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  processed_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_run_items (
  id bigserial PRIMARY KEY,
  job_run_id bigint NOT NULL REFERENCES job_runs(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_status text NOT NULL DEFAULT 'processed'
    CHECK (item_status IN ('processed', 'failed', 'skipped')),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name_started
  ON job_runs (job_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_run_items_run
  ON job_run_items (job_run_id, created_at DESC);

COMMENT ON TABLE job_runs IS 'Batch and cron job execution log';
COMMENT ON TABLE job_run_items IS 'Per-item execution log for batch and cron jobs';
