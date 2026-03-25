# AI Trend Hub Screen Flow

最終更新: 2026-03-25

## 1. 目的

公開画面・管理画面の導線、主要 API、L4 接続点を文字情報で整理する。Mermaid 図は `docs/imp/flowchart.md` に分離した。

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

## 3. 画面別の主な読み先

### Home

- `public_articles`
- `public_rankings`
- `activity_metrics_hourly`

### Article Detail

- `public_articles`
- `public_article_tags`
- `public_article_sources`
- OGP: `/api/og`

### Ranking

- `public_rankings`
- `public_articles`

### Search

- `public_articles`

### Tags / Category

- `tags_master`
- `public_article_tags`
- `public_articles`

### Admin Articles

- `public_articles`
- hide / unhide は管理 API で即時更新 + revalidation

### Admin Tags

- `tag_candidate_pool`
- `tags_master`
- `tag_keywords`

### Admin Sources

- `source_targets`

### Admin Jobs

- `job_runs`
- `job_run_items`

## 4. 現在の前提

1. `public_articles` は半年以内の公開集合
2. 半年超は `public_articles_history` に月次退避
3. `content_language` は公開面まで反映済み
4. `thumbnail_url` は内部テンプレ方式
5. OGP は `/api/og` で動的生成
6. 管理面は `/admin/login` + `ADMIN_SECRET` 認証
7. Topic Group は未実装

## 5. 関連図

- 公開面導線: `docs/imp/flowchart.md`
- 管理面導線: `docs/imp/flowchart.md`
- 統合図: `docs/imp/flowchart.md`
