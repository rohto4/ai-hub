-- migration 032: paper source_type 専用の paper タグを追加する
--
-- 背景:
--   論文ソースはキーワード由来の製品・企業タグでノイズが出やすいため、
--   当面は source_type=paper のときに paper タグだけを付与する。

INSERT INTO tags_master (tag_id, tag_key, display_name, trend_keyword, is_active, article_count)
VALUES (
  gen_random_uuid(),
  'paper',
  'Paper',
  'research paper',
  true,
  0
)
ON CONFLICT (tag_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  trend_keyword = EXCLUDED.trend_keyword,
  is_active = EXCLUDED.is_active,
  updated_at = now();
