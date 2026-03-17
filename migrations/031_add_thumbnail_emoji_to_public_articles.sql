-- migration 031: public_articles に暫定サムネイル絵文字を追加する
--
-- 背景:
--   thumbnail_url が当面 NULL のため、Zenn 風の絵文字サムネイルで
--   カード先頭の視認性を補う。
--   絵文字は L4 転送時に summary / title から決める。

ALTER TABLE public_articles
  ADD COLUMN IF NOT EXISTS thumbnail_emoji text NOT NULL DEFAULT '📝';

COMMENT ON COLUMN public_articles.thumbnail_emoji IS '暫定サムネイル絵文字。thumbnail_url が無い間のカード表示用';
