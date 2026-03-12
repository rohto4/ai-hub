CREATE TABLE IF NOT EXISTS activity_logs (
  id bigserial PRIMARY KEY,
  public_article_id uuid REFERENCES public_articles(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  user_id text,
  action_type text NOT NULL,
  platform text,
  referrer_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_metrics_hourly (
  public_article_id uuid NOT NULL REFERENCES public_articles(id) ON DELETE CASCADE,
  hour_bucket timestamptz NOT NULL,
  impression_count integer NOT NULL DEFAULT 0,
  open_count integer NOT NULL DEFAULT 0,
  share_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  source_open_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (public_article_id, hour_bucket)
);

CREATE TABLE IF NOT EXISTS admin_operation_logs (
  id bigserial PRIMARY KEY,
  operator_id text,
  operation_type text NOT NULL,
  target_kind text NOT NULL,
  target_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS priority_processing_queue (
  id bigserial PRIMARY KEY,
  queue_type text NOT NULL
    CHECK (queue_type IN ('admin_override', 'retag', 'republish', 'hide_article', 'rebuild_rank')),
  target_kind text NOT NULL,
  target_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority smallint NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_article_time
  ON activity_logs (public_article_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_action_time
  ON activity_logs (action_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_priority_processing_queue_next
  ON priority_processing_queue (status, priority ASC, available_at ASC);

COMMENT ON TABLE activity_logs IS '行動ログTBL';
COMMENT ON TABLE activity_metrics_hourly IS '行動集計TBL';
COMMENT ON TABLE admin_operation_logs IS '運営ログTBL';
COMMENT ON TABLE priority_processing_queue IS '優先処理キューTBL';
