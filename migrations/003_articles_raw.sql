CREATE TABLE IF NOT EXISTS articles_raw (
  id bigserial PRIMARY KEY,
  source_target_id uuid NOT NULL REFERENCES source_targets(id),
  source_item_id text,
  source_url text NOT NULL,
  cited_url text,
  normalized_url text NOT NULL,
  title text,
  snippet text,
  snippet_hash text,
  source_published_at timestamptz,
  source_updated_at timestamptz,
  source_author text,
  source_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetch_run_at timestamptz NOT NULL DEFAULT now(),
  is_processed boolean NOT NULL DEFAULT false,
  has_source_update boolean NOT NULL DEFAULT false,
  process_after timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles_raw_history (
  id bigserial PRIMARY KEY,
  raw_article_id bigint NOT NULL,
  source_target_id uuid NOT NULL,
  source_item_id text,
  source_url text NOT NULL,
  cited_url text,
  normalized_url text NOT NULL,
  title text,
  snippet text,
  snippet_hash text,
  source_published_at timestamptz,
  source_updated_at timestamptz,
  source_author text,
  source_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetch_run_at timestamptz NOT NULL,
  is_processed boolean NOT NULL,
  has_source_update boolean NOT NULL,
  process_after timestamptz NOT NULL,
  last_error text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_raw_process
  ON articles_raw (is_processed, process_after, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_raw_source_url
  ON articles_raw (source_target_id, normalized_url, fetch_run_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_raw_updated
  ON articles_raw (source_target_id, normalized_url, source_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_raw_history_archived
  ON articles_raw_history (archived_at DESC, normalized_url);

COMMENT ON TABLE articles_raw IS '生記事TBL';
COMMENT ON TABLE articles_raw_history IS '生記事履歴TBL';
