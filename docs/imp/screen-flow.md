# AI Trend Hub Screen Flow

最終更新: 2026-03-28

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
5. `thumbnail_bg_theme` は隣接分野タグから決定してカード背景に反映
6. OGP は `/api/og` で動的生成
7. 管理面は `/admin/login` + `ADMIN_SECRET` 認証
8. Topic Group は未実装

## 5. 関連図

- 公開面導線: `docs/imp/flowchart.md`
- 管理面導線: `docs/imp/flowchart.md`
- 統合図: `docs/imp/flowchart.md`

## 6. vNext Draft（導線改修の叩き台）

このセクションは相談用の新草案。既存の 2〜5 は現行整理、ここは次版導線の叩き台として扱う。

### 6.1 導線の基本役割

1. 主タグ
   - `/tags/:tagKey` の主導線
   - trend / entity を見るための入口
2. カテゴリ
   - Home のサイドバー導線
   - 公開面の大枠ナビゲーション
3. 周辺分野タグ
   - 当面は主タグと同様にクリック可能なタグとして扱う
   - 将来は「あるタグがどの分野で活用されているか」を見る視覚マッピング導線へ発展させる
4. 新規立項タグ候補
   - 公開導線ではなく運用判断用
   - `tag_candidate_pool` と参照 SQL で確認する

### 6.2 公開面の vNext 画面イメージ

#### Home `/`

- 左サイドバー:
  - Category 一覧
  - 必要なら固定リンク（Ranking / Tags / Search）
- メイン:
  - 記事カード一覧
  - 記事カード内に主タグを表示
  - 必要なら周辺分野タグも補助導線として表示

#### Category `/category/:slug`

- サイドバーで選ばれたカテゴリの一覧ページ
- そのカテゴリに属する記事を並べる
- 各記事から主タグ詳細と記事詳細へ遷移できる

#### Tags `/tags`

- 主タグ一覧を優先表示
- 周辺分野タグは当面同じ一覧導線でもよいが、表示区分は分ける余地がある

#### Tag Detail `/tags/:tagKey`

- 主タグの記事一覧ページ
- 将来的には周辺分野との掛け合わせを見せる余地を残す
- 当面は通常タグ詳細として成立させることを優先する

### 6.3 直近で詰めるべき論点

1. サイドバーに固定表示するカテゴリ集合
2. Home でカテゴリ導線をどの位置に置くか
3. 主タグと周辺分野タグを UI 上でどこまで見分けるか
4. `/tags` 一覧で周辺分野タグを混在表示するか、別セクションにするか
5. `oss` / `enterprise-ai` をカテゴリ専用で扱うか、タグ導線にも残すか
