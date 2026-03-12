CREATE TABLE IF NOT EXISTS public_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enriched_article_id bigint NOT NULL REFERENCES articles_enriched(id) ON DELETE CASCADE,
  primary_source_target_id uuid REFERENCES source_targets(id),
  public_key text NOT NULL UNIQUE,
  canonical_url text NOT NULL UNIQUE,
  display_title text NOT NULL,
  display_summary_100 text NOT NULL,
  display_summary_200 text,
  display_summary_300 text,
  thumbnail_url text,
  visibility_status text NOT NULL DEFAULT 'published'
    CHECK (visibility_status IN ('published', 'hidden', 'suppressed')),
  original_published_at timestamptz,
  public_refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public_article_sources (
  id bigserial PRIMARY KEY,
  public_article_id uuid NOT NULL REFERENCES public_articles(id) ON DELETE CASCADE,
  enriched_article_id bigint NOT NULL REFERENCES articles_enriched(id) ON DELETE CASCADE,
  source_target_id uuid NOT NULL REFERENCES source_targets(id),
  source_priority integer NOT NULL DEFAULT 100,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (public_article_id, enriched_article_id)
);

CREATE TABLE IF NOT EXISTS public_article_tags (
  public_article_id uuid NOT NULL REFERENCES public_articles(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags_master(id) ON DELETE CASCADE,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (public_article_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public_rankings (
  public_article_id uuid NOT NULL REFERENCES public_articles(id) ON DELETE CASCADE,
  ranking_window text NOT NULL CHECK (ranking_window IN ('hourly', '24h', '7d', '30d')),
  score numeric(10,4) NOT NULL,
  rank_position integer,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (public_article_id, ranking_window)
);

CREATE INDEX IF NOT EXISTS idx_public_articles_visibility
  ON public_articles (visibility_status, public_refreshed_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_article_sources_primary
  ON public_article_sources (public_article_id, is_primary DESC, source_priority DESC);

CREATE INDEX IF NOT EXISTS idx_public_rankings_lookup
  ON public_rankings (ranking_window, rank_position, score DESC);

COMMENT ON TABLE public_articles IS '公開記事TBL';
COMMENT ON TABLE public_article_sources IS '公開記事取得元TBL';
COMMENT ON TABLE public_article_tags IS '公開記事タグTBL';
COMMENT ON TABLE public_rankings IS '公開順位TBL';
