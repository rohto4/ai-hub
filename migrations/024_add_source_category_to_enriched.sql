-- migration 024: articles_enriched に source_category を追加する
--
-- 背景:
--   source_targets.source_category はトピック分類（llm / agent / voice / policy / safety / search）であり、
--   enrich 時に source_targets から取得可能だが articles_enriched に保存していなかった。
--   Layer 4 への転送スクリプト・Web 表示・ランキング計算で必要なため、Layer 2 に denormalize する。
--
-- source_category の値定義（このプロジェクト固有）:
--   llm      - LLM/モデル系（OpenAI, Anthropic, Google AI, HuggingFace, NVIDIA 等）
--   agent    - AI エージェント / Coding Agent 系
--   voice    - Voice AI / Voice Agent 系
--   policy   - AI 規制 / 政策系
--   safety   - AI 安全 / Alignment 系
--   search   - 検索 / RAG 系
--   news     - 一般 AI ニュース系
--   unknown  - 未分類（バックフィル失敗時のフォールバック）
--
-- ※ dim2_memo の display-layout category（news/paper/community/overseas/oss）とは別軸。
--   表示レイアウトの切り替えは content_access_policy + summary_input_basis から導出する。

ALTER TABLE articles_enriched
  ADD COLUMN IF NOT EXISTS source_category text NOT NULL DEFAULT 'unknown';

ALTER TABLE articles_enriched_history
  ADD COLUMN IF NOT EXISTS source_category text;

-- 既存レコードのバックフィル
UPDATE articles_enriched ae
SET source_category = st.source_category
FROM source_targets st
WHERE st.source_target_id = ae.source_target_id;

-- インデックス（カテゴリ別一覧クエリ用）
CREATE INDEX IF NOT EXISTS idx_articles_enriched_source_category
  ON articles_enriched (source_category, publish_candidate, processed_at DESC);

COMMENT ON COLUMN articles_enriched.source_category IS 'トピック分類（llm/agent/voice/policy/safety/search/news）。source_targets.source_category を enrich 時にコピー';
COMMENT ON COLUMN articles_enriched_history.source_category IS '整形済記事履歴のトピック分類';
