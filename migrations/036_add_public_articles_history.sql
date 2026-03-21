CREATE TABLE IF NOT EXISTS public_articles_history (
  public_article_history_id bigserial PRIMARY KEY,
  public_article_id uuid NOT NULL,
  enriched_article_id bigint NOT NULL,
  primary_source_target_id uuid,
  public_key text NOT NULL,
  canonical_url text NOT NULL,
  display_title text NOT NULL,
  display_summary_100 text NOT NULL,
  display_summary_200 text,
  thumbnail_url text,
  thumbnail_emoji text,
  source_category text,
  source_type text,
  content_language varchar(2),
  summary_input_basis text,
  publication_basis text,
  content_score numeric(8,4),
  critique text,
  topic_group_id uuid,
  original_published_at timestamptz,
  visibility_status text NOT NULL,
  public_refreshed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  archive_reason text NOT NULL DEFAULT 'age_out',
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_articles_history_archived
  ON public_articles_history (archived_at DESC, canonical_url);

CREATE INDEX IF NOT EXISTS idx_public_articles_history_public_article
  ON public_articles_history (public_article_id, archived_at DESC);

COMMENT ON TABLE public_articles_history IS '公開記事の履歴テーブル。半年超過などで public_articles から退避したスナップショットを保持する';
COMMENT ON COLUMN public_articles_history.archive_reason IS '履歴退避理由。初期値は age_out';
