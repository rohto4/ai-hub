-- migration 025: public_articles に Layer 4 表示・転送に必要なカラムを追加する
--
-- 背景（dim2_memo との差分解消）:
--   dim2_memo（Layer 3/4 設計）と現行 spec（Layer 1/2 積み上げ）を照合した結果、
--   hourly-publish 転送スクリプトが必要とする以下カラムが public_articles に不足していた。
--
-- 追加カラム:
--   source_category     - トピック分類。Web のカテゴリ別フィルタ・ランキング分離に使う
--   summary_input_basis - 要約入力種別（full_content / source_snippet / title_only）。
--                         Web の表示ラベル分岐（本文要約 / スニペット要約）に使う
--   publication_basis   - 公開根拠（full_summary / source_snippet）。
--                         Web の表示ルーティングに使う
--   content_score       - コンテンツ品質スコア（0〜100）。
--                         articles_enriched.score をそのまま移す。
--                         ランキング初期値・記事一覧ソートに使う。
--                         アクティビティ込みのランキングスコアは public_rankings.score が担う。
--
-- display_summary_300 はmigration 018 で除去済み。本 migration には含めない。

ALTER TABLE public_articles
  ADD COLUMN IF NOT EXISTS source_category text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS summary_input_basis text NOT NULL DEFAULT 'full_content'
    CHECK (summary_input_basis IN ('full_content', 'source_snippet', 'title_only')),
  ADD COLUMN IF NOT EXISTS publication_basis text NOT NULL DEFAULT 'full_summary'
    CHECK (publication_basis IN ('full_summary', 'source_snippet')),
  ADD COLUMN IF NOT EXISTS content_score numeric(5,2) NOT NULL DEFAULT 0;

-- インデックス（カテゴリ別ランキング・一覧クエリ用）
CREATE INDEX IF NOT EXISTS idx_public_articles_category_score
  ON public_articles (source_category, visibility_status, content_score DESC);

COMMENT ON COLUMN public_articles.source_category      IS 'トピック分類（articles_enriched.source_category から転写）';
COMMENT ON COLUMN public_articles.summary_input_basis  IS '要約入力種別。Web 表示ラベル分岐に使う（full_content=本文要約 / source_snippet=スニペット要約）';
COMMENT ON COLUMN public_articles.publication_basis    IS '公開根拠（full_summary / source_snippet）。hold 行は public_articles に入らない';
COMMENT ON COLUMN public_articles.content_score        IS 'コンテンツ品質スコア 0〜100。初期ランキングの base 値。アクティビティ込みスコアは public_rankings.score が担う';
