# AI Trend Hub Screen Flow

最終更新: 2026-03-22

## 1. 目的

公開画面・管理画面の導線、主要 API、L4 接続点を一枚で把握するための資料。

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

## 3. 公開面の画面遷移と API 接続

```mermaid
flowchart TD
    classDef screen fill:#ffe5b4,stroke:#f90,color:#333
    classDef api    fill:#c8f7c5,stroke:#27ae60,color:#333
    classDef db     fill:#e8d5ff,stroke:#8e44ad,color:#333

    subgraph 凡例["📋 凡例"]
        direction LR
        LS["画面 / 遷移"]:::screen
        LA["API /"]:::api
        LD["DB / 永続データ"]:::db
        LS ~~~ LA ~~~ LD
    end

    Home["Home /\nホーム"]:::screen --> ArticleCard["ArticleCard\n記事カード"]:::screen
    Home --> Ranking["Ranking /ranking\nランキング"]:::screen
    Home --> Search["Search /search\n検索"]:::screen
    Home --> Tags["Tags /tags\nタグ一覧"]:::screen
    Home --> Digest["Digest /digest\nダイジェスト"]:::screen

    ArticleCard --> Detail["Article Detail\n/articles/:publicKey"]:::screen
    ArticleCard --> Source["Source Site\n元記事サイト"]:::screen
    ArticleCard --> Share["Share Modal\n共有モーダル"]:::screen
    ArticleCard --> SavedPage["Saved /saved\n保存済み"]:::screen

    Detail --> Source
    Detail --> TagDetail["Tag Detail\n/tags/:tagKey"]:::screen
    Detail --> Category["Category\n/category/:slug"]:::screen

    Home --> HomeApi["/api/home"]:::api
    Home --> TrendsApi["/api/trends"]:::api
    Search --> SearchApi["/api/search"]:::api
    Ranking --> TrendsApi

    HomeApi --> PublicArticles["public_articles\n公開記事"]:::db
    HomeApi --> PublicRankings["public_rankings\nランキング"]:::db
    HomeApi --> ActivityMetrics["activity_metrics_hourly\nアクティビティ集計"]:::db
    SearchApi --> PublicArticles
    TrendsApi --> PublicArticles
    TrendsApi --> PublicRankings

    Detail --> DetailApi["/api/articles/:id"]:::api
    Detail --> OgApi["/api/og?publicKey=...\nOGP画像生成"]:::api
    DetailApi --> PublicArticles

    ArticleCard --> Actions["/api/actions\n行動ログ"]:::api
    Detail --> Actions
    Source --> Actions
    Share --> Actions
```

## 4. 管理面の画面遷移と API 接続

```mermaid
flowchart TD
    classDef screen fill:#ffe5b4,stroke:#f90,color:#333
    classDef api    fill:#c8f7c5,stroke:#27ae60,color:#333
    classDef admin  fill:#ffd6d6,stroke:#e74c3c,color:#333
    classDef db     fill:#e8d5ff,stroke:#8e44ad,color:#333

    subgraph 凡例["📋 凡例"]
        direction LR
        LS["画面 / 遷移"]:::screen
        LA["API /"]:::api
        LM["状態 / 管理"]:::admin
        LD["DB / 永続データ"]:::db
        LS ~~~ LA ~~~ LM ~~~ LD
    end

    Login["Admin Login\n/admin/login"]:::screen -->|ADMIN_SECRET 認証| Dashboard["Admin Dashboard\n/admin"]:::screen
    Dashboard --> Articles["記事管理\n/admin/articles"]:::screen
    Dashboard --> TagsAdmin["タグレビュー\n/admin/tags"]:::screen
    Dashboard --> Sources["ソース管理\n/admin/sources"]:::screen
    Dashboard --> Jobs["ジョブログ\n/admin/jobs"]:::screen

    Articles --> ArticlesApi["PATCH /api/admin/articles/:id\n記事 hide/unhide"]:::api
    ArticlesApi --> PublicArticles["public_articles\n公開記事"]:::db
    ArticlesApi --> AdminLogs["admin_operation_logs\n管理操作ログ"]:::admin

    TagsAdmin --> TagsApi["GET|POST /api/admin/tags\nタグ昇格・照合"]:::api
    TagsApi --> TagPool["tag_candidate_pool\nタグ候補"]:::db
    TagsApi --> TagsMaster["tags_master\nタグマスタ"]:::db
    TagsApi --> TagKeywords["tag_keywords\nタグキーワード"]:::db

    Sources --> SourcesApi["GET|PATCH /api/admin/sources\nソース ON/OFF"]:::api
    SourcesApi --> SourceTargets["source_targets\n取得元マスタ"]:::db

    Jobs --> JobsApi["GET /api/admin/jobs\nジョブ一覧"]:::api
    JobsApi --> JobRuns["job_runs\nジョブ実行ログ"]:::db
    Jobs --> JobDetailApi["GET /api/admin/jobs/:id\n失敗 items 詳細"]:::api
    JobDetailApi --> JobRunItems["job_run_items\n実行 item ログ"]:::db
```

## 5. 統合図（データパイプライン + 公開面 + 管理面）

```mermaid
flowchart TD
    classDef screen fill:#ffe5b4,stroke:#f90,color:#333
    classDef api    fill:#c8f7c5,stroke:#27ae60,color:#333
    classDef batch  fill:#ffd6d6,stroke:#e74c3c,color:#333
    classDef db     fill:#e8d5ff,stroke:#8e44ad,color:#333
    classDef tag    fill:#a0f4ff,stroke:#00b4d8,color:#333

    subgraph 凡例["📋 凡例"]
        direction LR
        LS["画面 / 遷移"]:::screen
        LB["バッチ / cron"]:::batch
        LD["DB / 永続データ"]:::db
        LT["タグ系"]:::tag
        LS ~~~ LB ~~~ LD ~~~ LT
    end

    subgraph pipeline["📦 データパイプライン（自動）"]
        direction LR
        ST["source_targets\n取得元マスタ"]:::db
        Fetch["hourly-fetch :00\n記事収集"]:::batch
        L1["articles_raw\n生記事"]:::db
        Enrich["hourly-enrich :10〜:40\nAI要約・タグ付け"]:::batch
        L2["articles_enriched\n整形済み記事"]:::db
        Publish["hourly-publish :50\n公開反映"]:::batch
        Rank["compute-ranks\nランキング計算"]:::batch
        L4["public_articles\n公開記事"]:::db
        R["public_rankings\nランキング"]:::db
        TCP["tag_candidate_pool\nタグ候補"]:::tag
        Dedup["daily-tag-dedup\nタグ重複検出"]:::batch
        TM["tags_master\nタグマスタ"]:::tag
        TK["tag_keywords\nタグキーワード"]:::tag

        ST --> Fetch --> L1 --> Enrich --> L2 --> Publish --> L4
        L4 --> Rank --> R
        Enrich --> TCP
        TCP --> Dedup
        TM --> Dedup
        Dedup --> TK
        Dedup --> L2
        Dedup --> L4
    end

    subgraph public["🌐 公開画面"]
        Home["Home /\nホーム"]:::screen
        Detail["記事詳細\n/articles/:id"]:::screen
        Search["検索\n/search"]:::screen
        RankPage["ランキング\n/ranking"]:::screen
        TagPage["タグ\n/tags"]:::screen
    end

    subgraph admin["🔧 管理画面"]
        AdminDash["ダッシュボード\n/admin"]:::screen
        AdminArt["記事管理\n/admin/articles"]:::screen
        AdminTag["タグレビュー\n/admin/tags"]:::screen
        AdminJob["ジョブログ\n/admin/jobs"]:::screen
    end

    L4 --> Home & Detail & Search & RankPage
    R --> RankPage & Home
    TM --> TagPage

    L4 --> AdminArt
    AdminArt -->|hide/unhide| L4
    TCP --> AdminTag
    AdminTag -->|昇格| TM & TK
    AdminJob -.->|参照| pipeline
```

## 6. 画面別の読み先

### 6.1 Home
- `public_articles`（random / latest / unique / ranked / lanes）
- `public_rankings`
- `activity_metrics_hourly`

### 6.2 Article Detail
- `public_articles`
- `public_article_tags`
- `public_article_sources`
- OGP: `/api/og` で動的画像生成（`@vercel/og`、edge runtime）

### 6.3 Ranking
- `public_rankings`
- `public_articles`

### 6.4 Search
- `public_articles`（ILIKE 全文検索）

### 6.5 Tags / Category
- `tags_master`
- `public_article_tags`
- `public_articles`

### 6.6 Admin Articles
- `public_articles`（最新200件）
- PATCH で `visibility_status` を即時更新 + revalidation

### 6.7 Admin Tags
- `tag_candidate_pool`（seen_count >= 4, status='candidate'）
- 昇格: `tags_master` + `tag_keywords` + `articles_enriched_tags` + `public_article_tags`

### 6.8 Admin Sources
- `source_targets`（全件）

### 6.9 Admin Jobs
- `job_runs`（最新50件、フィルタ可）
- `job_run_items`（失敗 items のみ、クリックで展開）

## 7. 現在の前提

1. `public_articles` は半年以内の公開集合
2. 半年超は `public_articles_history` に月次退避
3. `content_language` は公開面まで反映済み（JP/EN バッジ表示）
4. `thumbnail_url` は内部テンプレサムネイル方式（`/api/thumb`）
5. OGP 画像は `/api/og` で動的生成（`summary_large_image`）
6. 管理面は `/admin/login` で `ADMIN_SECRET` 認証後に全画面アクセス可
7. Topic Group は Home 内セクション止まりで、専用画面は未実装（pgvector 待ち）

## 8. 次の画面系タスク

| タスク | 優先 | 前提条件 |
|---|---|---|
| Topic Group `/topics/:id` | 低 | pgvector embedding 生成・グループ化バッチ |
| `critique` UI 有効化 | 低 | daily-enrich での critique 生成有効化 |
| tag alias 管理 UI | 低 | 運用頻度次第 |
| share tracking meta の送信実装 | 低 | actions/route.ts は受け取り済み |
