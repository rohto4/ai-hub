CREATE TABLE IF NOT EXISTS tags_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  trend_keyword text,
  is_active boolean NOT NULL DEFAULT true,
  article_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE TABLE IF NOT EXISTS tag_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES tags_master(id) ON DELETE CASCADE,
  alias_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tag_candidate_pool (
  id bigserial PRIMARY KEY,
  candidate_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  seen_count integer NOT NULL DEFAULT 1,
  latest_origin_raw_id bigint REFERENCES articles_raw(id) ON DELETE SET NULL,
  review_status text NOT NULL DEFAULT 'candidate'
    CHECK (review_status IN ('candidate', 'trend_matched', 'manual_review', 'promoted', 'rejected')),
  manual_review_required boolean NOT NULL DEFAULT false,
  latest_trends_score numeric(8,4),
  trends_checked_at timestamptz,
  promoted_tag_id uuid REFERENCES tags_master(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles_enriched (
  id bigserial PRIMARY KEY,
  raw_article_id bigint NOT NULL UNIQUE REFERENCES articles_raw(id) ON DELETE CASCADE,
  source_target_id uuid NOT NULL REFERENCES source_targets(id),
  normalized_url text NOT NULL,
  cited_url text,
  canonical_url text NOT NULL,
  title text NOT NULL,
  thumbnail_url text,
  summary_100 varchar(100) NOT NULL CHECK (char_length(summary_100) <= 100),
  summary_200 varchar(200) CHECK (summary_200 IS NULL OR char_length(summary_200) <= 200),
  summary_300 varchar(300) CHECK (summary_300 IS NULL OR char_length(summary_300) <= 300),
  content_path text NOT NULL CHECK (content_path IN ('full', 'snippet')),
  dedupe_status text NOT NULL DEFAULT 'unique'
    CHECK (dedupe_status IN ('unique', 'url_duplicate', 'source_duplicate', 'similar_candidate')),
  dedupe_group_key text,
  publish_candidate boolean NOT NULL DEFAULT false,
  score numeric(8,4) NOT NULL DEFAULT 0,
  score_reason text,
  source_updated_at timestamptz,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles_enriched_history (
  id bigserial PRIMARY KEY,
  enriched_article_id bigint NOT NULL,
  raw_article_id bigint NOT NULL,
  source_target_id uuid NOT NULL,
  normalized_url text NOT NULL,
  cited_url text,
  canonical_url text NOT NULL,
  title text NOT NULL,
  thumbnail_url text,
  summary_100 varchar(100) NOT NULL,
  summary_200 varchar(200),
  summary_300 varchar(300),
  content_path text NOT NULL,
  dedupe_status text NOT NULL,
  dedupe_group_key text,
  publish_candidate boolean NOT NULL,
  score numeric(8,4) NOT NULL,
  score_reason text,
  source_updated_at timestamptz,
  processed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles_enriched_tags (
  enriched_article_id bigint NOT NULL REFERENCES articles_enriched(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags_master(id) ON DELETE CASCADE,
  tag_source text NOT NULL DEFAULT 'master'
    CHECK (tag_source IN ('master', 'manual', 'candidate_promoted')),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (enriched_article_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tags_master_active
  ON tags_master (is_active, article_count DESC);

CREATE INDEX IF NOT EXISTS idx_tag_candidate_pool_status
  ON tag_candidate_pool (review_status, seen_count DESC, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_enriched_candidate
  ON articles_enriched (publish_candidate, processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_enriched_dedupe
  ON articles_enriched (dedupe_status, dedupe_group_key);

CREATE INDEX IF NOT EXISTS idx_articles_enriched_history_archived
  ON articles_enriched_history (archived_at DESC, canonical_url);

COMMENT ON TABLE tags_master IS 'タグマスタTBL';
COMMENT ON TABLE tag_aliases IS 'タグ別名マスタTBL';
COMMENT ON TABLE tag_candidate_pool IS '新語タグ候補TBL';
COMMENT ON TABLE articles_enriched IS '整形済記事TBL';
COMMENT ON TABLE articles_enriched_history IS '整形済記事履歴TBL';
COMMENT ON TABLE articles_enriched_tags IS '整形記事タグTBL';
