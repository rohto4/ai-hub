-- migration 027: critique（批評）カラムを拡張カラムとして追加する
--
-- 背景:
--   批評生成は初期リリース対象外だが、将来 content_path=full の記事に対して
--   200文字サマリ付与タイミングで生成する予定。
--   カラムを先に追加しておき、NULL で運用する。
--
-- 対象テーブル:
--   articles_enriched         - Layer 2 の実データ
--   articles_enriched_history - 履歴保管
--   public_articles           - Layer 4 公開面

ALTER TABLE articles_enriched
  ADD COLUMN IF NOT EXISTS critique text;

ALTER TABLE articles_enriched_history
  ADD COLUMN IF NOT EXISTS critique text;

ALTER TABLE public_articles
  ADD COLUMN IF NOT EXISTS critique text;

COMMENT ON COLUMN articles_enriched.critique         IS '批評テキスト（将来実装。content_path=full の記事のみ付与予定。初期は NULL）';
COMMENT ON COLUMN articles_enriched_history.critique IS '批評テキスト履歴';
COMMENT ON COLUMN public_articles.critique           IS '批評テキスト公開面（将来実装）';
