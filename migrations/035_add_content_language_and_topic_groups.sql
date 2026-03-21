-- migration 035: content_language 導入と topic group 受け口の先行追加

ALTER TABLE source_targets
  ADD COLUMN IF NOT EXISTS content_language varchar(2);

ALTER TABLE articles_enriched
  ADD COLUMN IF NOT EXISTS content_language varchar(2),
  ADD COLUMN IF NOT EXISTS topic_group_id uuid;

ALTER TABLE articles_enriched_history
  ADD COLUMN IF NOT EXISTS content_language varchar(2),
  ADD COLUMN IF NOT EXISTS topic_group_id uuid;

ALTER TABLE public_articles
  ADD COLUMN IF NOT EXISTS content_language varchar(2),
  ADD COLUMN IF NOT EXISTS topic_group_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'topic_groups'
  ) THEN
    CREATE TABLE topic_groups (
      topic_group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      label text NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

UPDATE source_targets
SET content_language = CASE
  WHEN source_key IN (
    'zenn-ai',
    'sakana-ai-blog',
    'pfn-tech-blog',
    'elyza-note',
    'zenn-llm',
    'zenn-generative-ai',
    'zenn-aiagent',
    'zenn-rag',
    'zenn-openai',
    'zenn-claude',
    'zenn-gemini',
    'cyberagent-dev-blog',
    'jdla-news',
    'ainow',
    'publickey'
  ) THEN 'ja'
  ELSE 'en'
END
WHERE content_language IS NULL;

UPDATE articles_enriched ae
SET content_language = st.content_language
FROM source_targets st
WHERE st.source_target_id = ae.source_target_id
  AND ae.content_language IS DISTINCT FROM st.content_language;

UPDATE articles_enriched_history aeh
SET content_language = st.content_language
FROM source_targets st
WHERE st.source_target_id = aeh.source_target_id
  AND aeh.content_language IS DISTINCT FROM st.content_language;

UPDATE public_articles pa
SET content_language = ae.content_language
FROM articles_enriched ae
WHERE ae.enriched_article_id = pa.enriched_article_id
  AND pa.content_language IS DISTINCT FROM ae.content_language;

CREATE INDEX IF NOT EXISTS idx_source_targets_content_language
  ON source_targets (content_language)
  WHERE content_language IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_articles_enriched_content_language
  ON articles_enriched (content_language, processed_at DESC)
  WHERE content_language IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_public_articles_content_language
  ON public_articles (content_language, visibility_status, public_refreshed_at DESC)
  WHERE content_language IS NOT NULL;

COMMENT ON COLUMN source_targets.content_language IS
  'コンテンツ言語。初期値は ja / en のみを使う。source_targets を SSOT とし、enrich / publish へ伝搬する。';

COMMENT ON COLUMN articles_enriched.content_language IS
  'コンテンツ言語。source_targets.content_language を enrich 時にコピーする。';

COMMENT ON COLUMN public_articles.content_language IS
  '公開記事のコンテンツ言語。articles_enriched.content_language を publish 時にコピーする。';

COMMENT ON COLUMN articles_enriched.topic_group_id IS
  '将来の Topic Group 用受け口。初期は NULL のまま運用する。';

COMMENT ON COLUMN public_articles.topic_group_id IS
  '将来の Topic Group 用受け口。初期は NULL のまま運用する。';
