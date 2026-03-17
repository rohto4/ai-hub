-- migration 030: tag_keywords テーブルを追加する
--
-- 目的:
--   タグマスタに「検索・収集用キーワード」を紐づけ、以下の用途で共通利用する。
--   1. コレクター収集フィルタ（HN 等のタイトルフィルタリング）
--   2. Web 検索のサジェスト・クエリ拡張
--   3. enrich 時のタグ照合強化（将来）
--
-- tag_aliases との違い:
--   tag_aliases → 表記ゆれ正規化（'large-language-model' → 'llm'）
--   tag_keywords → 自然言語の検索・マッチ語（'ChatGPT', 'language model' 等）
--
-- 1キーワードが複数タグに紐づく重複を許容する（UNIQUE は tag_id + keyword の複合のみ）。

CREATE TABLE IF NOT EXISTS tag_keywords (
  tag_keyword_id      bigserial PRIMARY KEY,
  tag_id              uuid NOT NULL REFERENCES tags_master(tag_id) ON DELETE CASCADE,
  keyword             text NOT NULL,
  use_for_collection  boolean NOT NULL DEFAULT true,
  use_for_search      boolean NOT NULL DEFAULT true,
  is_case_sensitive   boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_tag_keywords_collection
  ON tag_keywords (use_for_collection)
  WHERE use_for_collection = true;

CREATE INDEX IF NOT EXISTS idx_tag_keywords_tag_id
  ON tag_keywords (tag_id);

COMMENT ON TABLE tag_keywords IS 'タグ検索・収集用キーワードTBL';
COMMENT ON COLUMN tag_keywords.use_for_collection IS 'HN等の収集フィルタに使うか';
COMMENT ON COLUMN tag_keywords.use_for_search     IS 'Web検索サジェスト・クエリ拡張に使うか';
COMMENT ON COLUMN tag_keywords.is_case_sensitive  IS '"AI"のような大文字区別が必要なキーワード向け';
