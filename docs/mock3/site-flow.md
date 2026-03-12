# mock3 サイトフロー

最終更新: 2026-03-12

## 主な見方

1. Public Feed
   - `public_articles` / `public_article_tags` / `public_rankings` を読む想定
2. Related Sources
   - `public_article_sources` を読む想定
3. Tag Radar
   - `tags_master` と `tag_candidate_pool` の関係を見る想定
4. Ops Queue
   - `priority_processing_queue` と `admin_operation_logs` の反映を見る想定
5. Digest
   - `public_rankings` の上位から再構成する想定

## 目的

1. `layer4` の公開データがどうまとまるかを見る
2. `layer3` の運用データがどこで表示に効くかを見る
3. タグ運用、関連ソース、優先処理の見え方を確認する
