-- migration 033: pgvector 初期導入と L2/L4 ソース来歴保持

ALTER TABLE articles_enriched
  ADD COLUMN IF NOT EXISTS summary_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz;

ALTER TABLE articles_enriched_history
  ADD COLUMN IF NOT EXISTS summary_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS articles_enriched_sources (
  enriched_article_source_id bigserial PRIMARY KEY,
  enriched_article_id bigint NOT NULL REFERENCES articles_enriched(enriched_article_id) ON DELETE CASCADE,
  source_target_id uuid REFERENCES source_targets(source_target_id) ON DELETE SET NULL,
  source_key text NOT NULL,
  source_display_name text NOT NULL,
  source_category text,
  source_type text,
  selection_status text NOT NULL DEFAULT 'selected'
    CHECK (selection_status IN ('selected', 'supporting', 'rejected')),
  selection_reason text,
  similarity_score numeric(6,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enriched_article_id, source_key, selection_status)
);

ALTER TABLE public_article_sources
  ADD COLUMN IF NOT EXISTS source_key text,
  ADD COLUMN IF NOT EXISTS source_display_name text,
  ADD COLUMN IF NOT EXISTS selection_status text NOT NULL DEFAULT 'selected'
    CHECK (selection_status IN ('selected', 'supporting', 'rejected'));

UPDATE public_article_sources pas
SET
  source_key = st.source_key,
  source_display_name = st.display_name,
  selection_status = CASE
    WHEN pas.is_primary THEN 'selected'
    ELSE 'supporting'
  END
FROM source_targets st
WHERE st.source_target_id = pas.source_target_id
  AND (pas.source_key IS NULL OR pas.source_display_name IS NULL);

INSERT INTO articles_enriched_sources (
  enriched_article_id,
  source_target_id,
  source_key,
  source_display_name,
  source_category,
  source_type,
  selection_status,
  selection_reason
)
SELECT
  ae.enriched_article_id,
  ae.source_target_id,
  st.source_key,
  st.display_name,
  ae.source_category,
  ae.source_type,
  CASE
    WHEN ae.dedupe_status = 'unique' THEN 'selected'
    ELSE 'rejected'
  END,
  CASE
    WHEN ae.dedupe_status = 'unique' THEN 'primary article source'
    ELSE 'dedupe group member'
  END
FROM articles_enriched ae
JOIN source_targets st ON st.source_target_id = ae.source_target_id
ON CONFLICT (enriched_article_id, source_key, selection_status) DO UPDATE SET
  source_target_id = EXCLUDED.source_target_id,
  source_display_name = EXCLUDED.source_display_name,
  source_category = EXCLUDED.source_category,
  source_type = EXCLUDED.source_type,
  selection_reason = EXCLUDED.selection_reason,
  updated_at = now();

CREATE INDEX IF NOT EXISTS idx_articles_enriched_embedding_hnsw
  ON articles_enriched USING hnsw (summary_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_articles_enriched_sources_lookup
  ON articles_enriched_sources (enriched_article_id, selection_status, source_type);

CREATE INDEX IF NOT EXISTS idx_public_article_sources_display
  ON public_article_sources (public_article_id, selection_status, is_primary DESC, source_priority DESC);

COMMENT ON COLUMN articles_enriched.summary_embedding IS 'OpenAI text-embedding-3-small による title+summary 埋め込み。pgvector 類似重複判定の初期実装で利用';
COMMENT ON COLUMN articles_enriched.embedding_model IS 'summary_embedding の生成モデル名';
COMMENT ON COLUMN articles_enriched.embedding_updated_at IS 'summary_embedding 更新日時';
COMMENT ON TABLE articles_enriched_sources IS 'L2 記事に対する採用/補助/非採用ソースの来歴保持';
COMMENT ON COLUMN public_article_sources.source_key IS 'L4 表示用に保持する元ソースキーのスナップショット';
COMMENT ON COLUMN public_article_sources.source_display_name IS 'L4 表示用に保持する元ソース名のスナップショット';
COMMENT ON COLUMN public_article_sources.selection_status IS 'selected=代表 source / supporting=補助 source / rejected=重複候補 source';
