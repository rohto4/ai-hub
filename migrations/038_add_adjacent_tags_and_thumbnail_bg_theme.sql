-- migration 038: 隣接分野タグ + 背景テーマ

CREATE TABLE IF NOT EXISTS adjacent_tags_master (
  adjacent_tag_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  theme_key text NOT NULL,
  priority int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  article_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adjacent_tag_keywords (
  adjacent_tag_keyword_id bigserial PRIMARY KEY,
  adjacent_tag_id uuid NOT NULL REFERENCES adjacent_tags_master(adjacent_tag_id) ON DELETE CASCADE,
  keyword text NOT NULL,
  is_case_sensitive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (adjacent_tag_id, keyword)
);

CREATE TABLE IF NOT EXISTS articles_enriched_adjacent_tags (
  enriched_article_id bigint NOT NULL REFERENCES articles_enriched(enriched_article_id) ON DELETE CASCADE,
  adjacent_tag_id uuid NOT NULL REFERENCES adjacent_tags_master(adjacent_tag_id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (enriched_article_id, adjacent_tag_id)
);

CREATE TABLE IF NOT EXISTS public_article_adjacent_tags (
  public_article_id uuid NOT NULL REFERENCES public_articles(public_article_id) ON DELETE CASCADE,
  adjacent_tag_id uuid NOT NULL REFERENCES adjacent_tags_master(adjacent_tag_id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (public_article_id, adjacent_tag_id)
);

ALTER TABLE articles_enriched
  ADD COLUMN IF NOT EXISTS thumbnail_bg_theme text;

ALTER TABLE articles_enriched_history
  ADD COLUMN IF NOT EXISTS thumbnail_bg_theme text;

ALTER TABLE public_articles
  ADD COLUMN IF NOT EXISTS thumbnail_bg_theme text;

ALTER TABLE public_articles_history
  ADD COLUMN IF NOT EXISTS thumbnail_bg_theme text;

CREATE INDEX IF NOT EXISTS idx_adjacent_tags_master_active
  ON adjacent_tags_master (is_active, priority ASC, article_count DESC);

CREATE INDEX IF NOT EXISTS idx_adjacent_tag_keywords_lookup
  ON adjacent_tag_keywords (keyword, is_case_sensitive);

CREATE INDEX IF NOT EXISTS idx_articles_enriched_adjacent_tags_lookup
  ON articles_enriched_adjacent_tags (enriched_article_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_public_article_adjacent_tags_lookup
  ON public_article_adjacent_tags (public_article_id, sort_order);

COMMENT ON TABLE adjacent_tags_master IS '隣接分野タグマスタ';
COMMENT ON TABLE adjacent_tag_keywords IS '隣接分野タグのキーワード辞書';
COMMENT ON TABLE articles_enriched_adjacent_tags IS 'L2記事と隣接分野タグの紐付け';
COMMENT ON TABLE public_article_adjacent_tags IS 'L4記事と隣接分野タグの紐付け';
COMMENT ON COLUMN articles_enriched.thumbnail_bg_theme IS 'サムネイル背景テーマ。隣接分野タグから決定する';
COMMENT ON COLUMN public_articles.thumbnail_bg_theme IS '公開記事のサムネイル背景テーマ';

-- 初期マスタ
INSERT INTO adjacent_tags_master (tag_key, display_name, theme_key, priority, is_active)
VALUES
  ('infra', 'Infrastructure', 'adj-infra', 10, true),
  ('security', 'Cybersecurity', 'adj-security', 20, true),
  ('robotics', 'Robotics', 'adj-robotics', 25, true),
  ('media', 'Media & Creator', 'adj-media', 30, true),
  ('finance', 'Finance', 'adj-finance', 40, true),
  ('healthcare', 'Healthcare', 'adj-healthcare', 45, true),
  ('education', 'Education', 'adj-education', 50, true),
  ('legal', 'Legal', 'adj-legal', 55, true),
  ('gaming', 'Gaming', 'adj-gaming', 60, true),
  ('hardware', 'Hardware', 'adj-hardware', 65, true)
ON CONFLICT (tag_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  theme_key = EXCLUDED.theme_key,
  priority = EXCLUDED.priority,
  is_active = EXCLUDED.is_active,
  updated_at = now();

WITH kw(tag_key, keyword, is_case_sensitive) AS (
  VALUES
    ('infra', 'infrastructure', false),
    ('infra', 'inference stack', false),
    ('infra', 'gpu cluster', false),
    ('infra', 'kubernetes', false),
    ('infra', 'datacenter', false),
    ('security', 'cybersecurity', false),
    ('security', 'security', false),
    ('security', 'threat', false),
    ('security', 'malware', false),
    ('security', 'phishing', false),
    ('robotics', 'robotics', false),
    ('robotics', 'robot', false),
    ('robotics', 'humanoid', false),
    ('robotics', 'drone', false),
    ('media', 'video', false),
    ('media', 'audio', false),
    ('media', 'music', false),
    ('media', 'image generation', false),
    ('media', 'creator', false),
    ('finance', 'finance', false),
    ('finance', 'fintech', false),
    ('finance', 'banking', false),
    ('finance', 'trading', false),
    ('finance', 'fraud', false),
    ('healthcare', 'healthcare', false),
    ('healthcare', 'medical', false),
    ('healthcare', 'clinical', false),
    ('healthcare', 'hospital', false),
    ('healthcare', 'biotech', false),
    ('education', 'education', false),
    ('education', 'student', false),
    ('education', 'classroom', false),
    ('education', 'tutor', false),
    ('legal', 'regulation', false),
    ('legal', 'compliance', false),
    ('legal', 'lawsuit', false),
    ('legal', 'copyright', false),
    ('gaming', 'gaming', false),
    ('gaming', 'game', false),
    ('gaming', 'npc', false),
    ('gaming', 'gameplay', false),
    ('hardware', 'gpu', false),
    ('hardware', 'chip', false),
    ('hardware', 'semiconductor', false),
    ('hardware', 'device', false)
)
INSERT INTO adjacent_tag_keywords (adjacent_tag_id, keyword, is_case_sensitive)
SELECT atm.adjacent_tag_id, kw.keyword, kw.is_case_sensitive
FROM kw
JOIN adjacent_tags_master atm ON atm.tag_key = kw.tag_key
ON CONFLICT (adjacent_tag_id, keyword) DO NOTHING;
