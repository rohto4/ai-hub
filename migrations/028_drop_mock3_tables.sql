-- migration 028: mock3 暫定実装テーブルを削除する
--
-- 対象:
--   articles              - mock3 の暫定 Web 公開テーブル（4件 mock データ）。public_articles が後継
--   feeds                 - mock3 の暫定 source_targets（3件 mock データ）。source_targets が後継
--   topic_groups          - mock3 の暫定 topic クラスタ（3件 mock データ）。source_type で代替
--   rank_scores           - 設計書なし（24件 mock データ）
--   source_items          - データゼロ・設計書なし
--   source_items_2026_03  - データゼロ・設計書なし（パーティション）
--
-- 残すもの:
--   action_logs            - サイトクリックログ（16件実データ）。継続使用
--   action_logs_2026_w10   - パーティション（空だが構造は残す）
--   action_logs_2026_w11   - パーティション（16件実データ）

DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS feeds CASCADE;
DROP TABLE IF EXISTS topic_groups CASCADE;
DROP TABLE IF EXISTS rank_scores CASCADE;
DROP TABLE IF EXISTS source_items_2026_03 CASCADE;
DROP TABLE IF EXISTS source_items CASCADE;
