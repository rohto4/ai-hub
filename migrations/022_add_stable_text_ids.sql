ALTER TABLE articles_raw
  ADD COLUMN IF NOT EXISTS raw_id text
  GENERATED ALWAYS AS ('raw-' || lpad(raw_article_id::text, 8, '0')) STORED;

ALTER TABLE articles_raw_history
  ADD COLUMN IF NOT EXISTS raw_history_id text
  GENERATED ALWAYS AS ('rawhist-' || lpad(raw_article_history_id::text, 8, '0')) STORED;

ALTER TABLE articles_enriched
  ADD COLUMN IF NOT EXISTS enriched_id text
  GENERATED ALWAYS AS ('enriched-' || lpad(enriched_article_id::text, 8, '0')) STORED;

ALTER TABLE articles_enriched_history
  ADD COLUMN IF NOT EXISTS enriched_history_id text
  GENERATED ALWAYS AS ('enrichedhist-' || lpad(enriched_article_history_id::text, 8, '0')) STORED;

ALTER TABLE job_runs
  ADD COLUMN IF NOT EXISTS job_id text
  GENERATED ALWAYS AS ('job-' || lpad(job_run_id::text, 8, '0')) STORED;

ALTER TABLE job_run_items
  ADD COLUMN IF NOT EXISTS job_item_id text
  GENERATED ALWAYS AS ('jobitem-' || lpad(job_run_item_id::text, 8, '0')) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_raw_raw_id
  ON articles_raw (raw_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_raw_history_raw_history_id
  ON articles_raw_history (raw_history_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_enriched_enriched_id
  ON articles_enriched (enriched_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_enriched_history_enriched_history_id
  ON articles_enriched_history (enriched_history_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_job_id
  ON job_runs (job_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_run_items_job_item_id
  ON job_run_items (job_item_id);
