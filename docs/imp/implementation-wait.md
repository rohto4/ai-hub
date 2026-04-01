# AI Trend Hub 実装判断待ち

最終更新: 2026-04-02

ここには「まだ確定していないが、実装を止めずに後で判断したい論点」だけを残す。確定済みの内容や履歴はここに残さない。

## 1. 判断待ち一覧

### 1.1 `hourly-compute-ranks` 係数調整

現状:
- activity weight は `impression=0.5`, `open=1.0`, `share=1.0`, `save=1.0`, `sourceOpen=2.0`
- 時間減衰は 1 週間でスコアが 1/5
- 実データがまだ少なく、妥当性評価ができない

判断時に見ること:
- 上位が「新鮮な記事」寄りか「高エンゲージメント記事」寄りか
- 時間減衰が急すぎるか
- `sourceOpen` を最大ウェイトにする妥当性

### 1.2 tag alias 管理 UI の要否

現状:
- `tag_aliases` は機能している
- 管理 UI はなく、追加は SQL 操作前提
- `daily-tag-dedup` で keyword 寄せは自動化済み

判断:
- 運用頻度が高いなら `/admin/tags/aliases` を作る
- 低いなら SQL 運用のままにする

### 1.3 `push_subscriptions.genres` rename

現状:
- 旧名称 `genres` が残っている
- 正しい意味は `source_categories`
- DB 変更は Human-in-the-Loop 対象

判断:
- rename するなら migration とアプリ側修正を同時に行う

### 1.4 Topic Group の最終 URL 設計

現状:
- `summary_embedding`、`topic_group_id`、`topic_groups` は受け口だけ存在
- 値はまだ入っていない
- `/topics/:id` を持つか、Home 内導線に留めるかは未決

前提:
- embedding 生成
- backfill
- HNSW インデックス
- グループ化 batch
- UI 設計

### 1.5 `critique` UI の有効化タイミング

現状:
- `public_articles.critique` はあるが UI では未使用

判断:
- critique 生成のコストと品質を見て有効化時期を決める

### 1.6 `ADMIN_PATH_PREFIX` の動的設定

現状:
- 管理画面は `/admin/*` 固定
- `ADMIN_SECRET` cookie で保護済み

判断:
- 固定で十分か、env var 化するかをセキュリティ要件で決める

### 1.7 `arxiv-ai` の流入監視と再判断

現状:
- `arxiv-ai` は raw へは通常取り込み
- 5 か月超 raw は enrich 対象外
- L4 は 2 か月保持上限
- throughput 増加後も backlog と露出を監視中

継続監視:
- `articles_raw` の未処理件数
- 24h の fetch 件数
- 24h の enrich 処理件数 / 成功件数
- Home / ranking / search での露出量

再判断条件:
- backlog が縮小しない
- Gemini API コストや待ち行列が不安定
- 公開面で露出が強すぎる

### 1.8 1 周目 retag 後のカテゴリ / 属性設計確定

現状:
- 1 周目ではカテゴリを固定しない
- 主タグ / 周辺分野タグ / 新規立項タグ候補を属性として再構築中

判断時に決めること:
- `oss` をカテゴリ専用にするか
- `enterprise-ai` をカテゴリ専用にするか
- `official` / `news` / `paper` / `search-rag` をどの導線へ寄せるか

### 1.9 `paper` 専用タグ群の要否

現状:
- `paper` / `arxiv-ai` は既存主タグへ落ちにくい記事が多い
- 論文導線では一般研究語が有効な可能性がある

判断:
- `paper` 専用タグマスタを持つか
- `paper` 判定時に通常タグから切り替えるか
- 公開面でどこまで見せるか

### 1.10 タグ関連テーブルの再編

現状:
- 主タグ系と周辺分野タグ系が別マスタ・別付与テーブル

判断:
- `tag_type` を持つ共通テーブルへ寄せるか
- 分離維持のまま進めるか
- 移行コストに見合うか

### 1.11 周辺分野タグの将来導線

現状:
- いまは `thumbnail_bg_theme` と文脈補助が主用途
- 専用 UI はまだない

判断:
- 将来、タグと分野の関係を見る視覚マッピングページを作るか
