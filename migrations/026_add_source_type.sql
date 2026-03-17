-- migration 026: source_type（ソース種別）を追加する
--
-- source_type の値定義:
--   official  - 企業・組織の公式技術ブログ（OpenAI, Anthropic, Google AI, HuggingFace, NVIDIA 等）
--   blog      - 個人・コミュニティブログ
--   news      - ニュースメディア / まとめサイト
--   video     - 動画（YouTube 等）
--   alerts    - Google Alerts（discovery feed、配信元が不定）
--
-- 追加対象テーブル:
--   1. source_targets          - ソースマスタに種別を持つ
--   2. articles_enriched       - source_targets から enrich 時にコピー（denormalize）
--   3. articles_enriched_history
--   4. public_articles         - hourly-publish 転送時にコピー

-- 1. source_targets
ALTER TABLE source_targets
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'news'
    CHECK (source_type IN ('official', 'blog', 'news', 'video', 'alerts'));

-- バックフィル: 公式 source → official
UPDATE source_targets SET source_type = 'official'
WHERE source_key IN (
  'google-ai-blog', 'anthropic-news', 'openai-news',
  'microsoft-foundry-blog', 'aws-machine-learning-blog',
  'huggingface-blog', 'nvidia-developer-blog', 'meta-ai-news'
);

-- バックフィル: Google Alerts → alerts
UPDATE source_targets SET source_type = 'alerts'
WHERE fetch_kind = 'alerts';

-- 2. articles_enriched
ALTER TABLE articles_enriched
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'news'
    CHECK (source_type IN ('official', 'blog', 'news', 'video', 'alerts'));

UPDATE articles_enriched ae
SET source_type = st.source_type
FROM source_targets st
WHERE st.source_target_id = ae.source_target_id;

-- 3. articles_enriched_history
ALTER TABLE articles_enriched_history
  ADD COLUMN IF NOT EXISTS source_type text;

-- 4. public_articles
ALTER TABLE public_articles
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'news'
    CHECK (source_type IN ('official', 'blog', 'news', 'video', 'alerts'));

CREATE INDEX IF NOT EXISTS idx_articles_enriched_source_type
  ON articles_enriched (source_type, publish_candidate, processed_at DESC);

COMMENT ON COLUMN source_targets.source_type         IS 'ソース種別（official/blog/news/video/alerts）。Web カード表示の分岐に使う';
COMMENT ON COLUMN articles_enriched.source_type      IS 'ソース種別。source_targets.source_type を enrich 時にコピー';
COMMENT ON COLUMN public_articles.source_type        IS 'ソース種別。hourly-publish 転送時にコピー';
