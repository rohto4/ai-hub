# AI Trend Hub Screen Flow

最終更新: 2026-04-03

## 1. 目的

公開面・管理面の主要導線と主な読み先を簡潔に整理する。Mermaid 図は `docs/imp/flowchart.md` を参照する。

## 2. 主要画面

### 公開面

1. Home `/`
2. Ranking `/ranking`
3. Search `/search`
4. Article Detail `/articles/:publicKey`
5. Category `/category/:slug`
6. Tags `/tags`, `/tags/:tagKey`
7. About `/about`
8. Feed `/feed`, `/feed.xml`
9. Digest `/digest`
10. Saved `/saved`
11. Liked `/liked`

### 管理面

12. Admin Login `/admin/login`
13. Admin Dashboard `/admin`
14. Admin Articles `/admin/articles`
15. Admin Tags `/admin/tags`
16. Admin Sources `/admin/sources`
17. Admin Jobs `/admin/jobs`
18. Admin Enrich Queue `/admin/enrich-queue`

## 3. 画面別の主な読み先

- Home: `public_articles`, `public_rankings`, `activity_metrics_hourly`
- Article Detail: `public_articles`, `public_article_tags`, `public_article_sources`, `/api/og`
- Ranking: `public_rankings`, `public_articles`
- Search: `public_articles`
- Tags / Category: `tags_master`, `public_article_tags`, `public_articles`
- Admin Articles: `public_articles`
- Admin Tags: `tag_candidate_pool`, `tags_master`, `tag_keywords`
- Admin Sources: `source_targets`
- Admin Jobs: `job_runs`, `job_run_items`
- Admin Enrich Queue: `articles_raw`, `articles_enriched`, `job_runs`, `source_targets`

## 4. 現在の前提

1. `public_articles` は公開集合、半年超は `public_articles_history` に月次退避する
2. `content_language` は公開面まで反映済み
3. `thumbnail_url` は内部テンプレ方式
4. `thumbnail_bg_theme` は隣接分野タグから決定する
5. OGP は `/api/og` で動的生成する
6. 管理面は `/admin/login` + `ADMIN_SECRET` 認証
7. Topic Group は未実装

## 5. vNext の導線整理

- 主タグ: `/tags/:tagKey` の主導線
- カテゴリ: Home サイドバーの大枠導線
  - 実装上は `source-type` / `source-category` / `tag` の 3 種を `SITE_CATEGORIES` で束ねている
- 周辺分野タグ: 当面は通常タグと同じクリック導線
- 新規立項タグ候補: 公開導線ではなく運用判断用

## 6. 直近で詰める論点

1. サイドバーに固定表示するカテゴリ集合
2. Home でカテゴリ導線をどこに置くか
3. 主タグと周辺分野タグを UI 上でどこまで見分けるか
4. `/tags` 一覧で周辺分野タグをどう見せるか
5. `oss` / `enterprise-ai` をカテゴリ専用にするか
