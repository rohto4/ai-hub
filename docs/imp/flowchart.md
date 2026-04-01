# AI Trend Hub Flowchart

最終更新: 2026-04-02

このファイルには Mermaid 図だけを集約する。図の補足説明は元ファイル側へ残す。

## 1. 公開面の画面遷移と API 接続

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

    Home["Home /
    ホーム"]:::screen --> ArticleCard["ArticleCard
    記事カード"]:::screen
    Home --> Ranking["Ranking /ranking
    ランキング"]:::screen
    Home --> Search["Search /search
    検索"]:::screen
    Home --> Tags["Tags /tags
    タグ一覧"]:::screen
    Home --> Digest["Digest /digest
    ダイジェスト"]:::screen

    ArticleCard --> Detail["Article Detail
    /articles/:publicKey"]:::screen
    ArticleCard --> Source["Source Site
    元記事サイト"]:::screen
    ArticleCard --> Share["Share Modal
    共有モーダル"]:::screen
    ArticleCard --> SavedPage["Saved /saved
    保存済み"]:::screen

    Detail --> Source
    Detail --> TagDetail["Tag Detail
    /tags/:tagKey"]:::screen
    Detail --> Category["Category
    /category/:slug"]:::screen

    Home --> HomeApi["/api/home"]:::api
    Home --> TrendsApi["/api/trends"]:::api
    Search --> SearchApi["/api/search"]:::api
    Ranking --> TrendsApi

    HomeApi --> PublicArticles["public_articles
    公開記事"]:::db
    HomeApi --> PublicRankings["public_rankings
    ランキング"]:::db
    HomeApi --> ActivityMetrics["activity_metrics_hourly
    アクティビティ集計"]:::db
    SearchApi --> PublicArticles
    TrendsApi --> PublicArticles
    TrendsApi --> PublicRankings

    Detail --> DetailApi["/api/articles/:id"]:::api
    Detail --> OgApi["/api/og?publicKey=...
    OGP画像生成"]:::api
    DetailApi --> PublicArticles

    ArticleCard --> Actions["/api/actions
    行動ログ"]:::api
    Detail --> Actions
    Source --> Actions
    Share --> Actions
```

## 2. 管理面の画面遷移と API 接続

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

    Login["Admin Login
    /admin/login"]:::screen -->|ADMIN_SECRET 認証| Dashboard["Admin Dashboard
    /admin"]:::screen
    Dashboard --> Articles["記事管理
    /admin/articles"]:::screen
    Dashboard --> TagsAdmin["タグレビュー
    /admin/tags"]:::screen
    Dashboard --> Sources["ソース管理
    /admin/sources"]:::screen
    Dashboard --> Jobs["ジョブログ
    /admin/jobs"]:::screen

    Articles --> ArticlesApi["PATCH /api/admin/articles/:id
    記事 hide/unhide"]:::api
    ArticlesApi --> PublicArticles["public_articles
    公開記事"]:::db
    ArticlesApi --> AdminLogs["admin_operation_logs
    管理操作ログ"]:::admin

    TagsAdmin --> TagsApi["GET|POST /api/admin/tags
    タグ昇格・照合"]:::api
    TagsApi --> TagPool["tag_candidate_pool
    タグ候補"]:::db
    TagsApi --> TagsMaster["tags_master
    タグマスタ"]:::db
    TagsApi --> TagKeywords["tag_keywords
    タグキーワード"]:::db

    Sources --> SourcesApi["GET|PATCH /api/admin/sources
    ソース ON/OFF"]:::api
    SourcesApi --> SourceTargets["source_targets
    取得元マスタ"]:::db

    Jobs --> JobsApi["GET /api/admin/jobs
    ジョブ一覧"]:::api
    JobsApi --> JobRuns["job_runs
    ジョブ実行ログ"]:::db
    Jobs --> JobDetailApi["GET /api/admin/jobs/:id
    失敗 items 詳細"]:::api
    JobDetailApi --> JobRunItems["job_run_items
    実行 item ログ"]:::db
```

## 3. 統合図

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
        ST["source_targets
        取得元マスタ"]:::db
        Fetch["hourly-fetch :00
        記事収集"]:::batch
        L1["articles_raw
        生記事"]:::db
        Enrich["hourly-enrich :05〜:40
        AI要約・タグ付け"]:::batch
        L2["articles_enriched
        整形済み記事"]:::db
        Publish["hourly-publish :50
        公開反映"]:::batch
        Rank["hourly-compute-ranks
        ランキング計算"]:::batch
        L4["public_articles
        公開記事"]:::db
        R["public_rankings
        ランキング"]:::db
        TCP["tag_candidate_pool
        タグ候補"]:::tag
        Dedup["daily-tag-dedup
        タグ重複検出"]:::batch
        TM["tags_master
        タグマスタ"]:::tag
        TK["tag_keywords
        タグキーワード"]:::tag

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
        Home["Home /
        ホーム"]:::screen
        Detail["記事詳細
        /articles/:id"]:::screen
        Search["検索
        /search"]:::screen
        RankPage["ランキング
        /ranking"]:::screen
        TagPage["タグ
        /tags"]:::screen
    end

    subgraph admin["🔧 管理画面"]
        AdminDash["ダッシュボード
        /admin"]:::screen
        AdminArt["記事管理
        /admin/articles"]:::screen
        AdminTag["タグレビュー
        /admin/tags"]:::screen
        AdminJob["ジョブログ
        /admin/jobs"]:::screen
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

## 4. cron / job フロー

```mermaid
flowchart LR
    classDef batch fill:#ffd6d6,stroke:#e74c3c,color:#333
    classDef db    fill:#e8d5ff,stroke:#8e44ad,color:#333
    classDef tag   fill:#a0f4ff,stroke:#00b4d8,color:#333

    subgraph 凡例["📋 凡例"]
        direction TB
        LB["バッチ / cron"]:::batch
        LD["DB / 永続データ"]:::db
        LT["タグ系"]:::tag
        LB ~~~ LD ~~~ LT
    end

    ST["source_targets
    取得元マスタ"]:::db
    L1["articles_raw
    生記事"]:::db
    L2["articles_enriched
    整形済み記事"]:::db
    L4["public_articles
    公開記事"]:::db
    L4H["public_articles_history
    公開記事履歴"]:::db
    R["public_rankings
    ランキング"]:::db
    TCP["tag_candidate_pool
    タグ候補"]:::tag
    TM["tags_master
    タグマスタ"]:::tag
    TK["tag_keywords
    タグキーワード"]:::tag

    Fetch["hourly-fetch :00
    記事収集"]:::batch
    Enrich05["hourly-enrich :05
    AI要約・タグ付け"]:::batch
    Enrich10["hourly-enrich :10
    AI要約・タグ付け"]:::batch
    Enrich20["hourly-enrich :20
    AI要約・タグ付け"]:::batch
    Enrich30["hourly-enrich :30
    AI要約・タグ付け"]:::batch
    Enrich40["hourly-enrich :40
    AI要約・タグ付け"]:::batch
    Publish["hourly-publish :50
    公開反映"]:::batch
    Rank["hourly-compute-ranks
    ランキング計算"]:::batch
    Archive["monthly-public-archive
    月次アーカイブ"]:::batch
    Dedup["daily-tag-dedup 02:30 UTC
    タグ重複検出・統合"]:::batch

    ST --> Fetch
    Fetch --> L1
    L1 --> Enrich05 & Enrich10 & Enrich20 & Enrich30 & Enrich40
    Enrich05 & Enrich10 & Enrich20 & Enrich30 & Enrich40 --> L2
    Enrich05 --> TCP
    L2 --> Publish
    Publish --> L4
    L4 --> Rank --> R
    L4 --> Archive --> L4H
    TCP --> Dedup
    TM --> Dedup
    Dedup --> TK
    Dedup --> L2
    Dedup --> L4
```

## 5. サムネイル生成フロー

```mermaid
flowchart TD
    classDef db fill:#fff3e0,stroke:#fb8c00,color:#4e342e
    classDef code fill:#e3f2fd,stroke:#1e88e5,color:#0d47a1
    classDef batch fill:#ede7f6,stroke:#5e35b1,color:#311b92
    classDef api fill:#e0f7fa,stroke:#00838f,color:#004d40
    classDef ui fill:#fce4ec,stroke:#d81b60,color:#880e4f
    classDef asset fill:#e8f5e9,stroke:#43a047,color:#1b5e20
    classDef legendBox fill:#ffffff,stroke:#9e9e9e,color:#424242

    ST["source_type / source_category / content_language"]:::db
    AE["articles_enriched<br/>title / summary / thumbnail_url"]:::db
    AET["articles_enriched_tags"]:::db
    TM["tags_master<br/>tag_key / display_name"]:::db
    REG["thumbnail-tag-registry.ts"]:::code
    ASSET["public/thumbs/icons<br/>public/thumbs/assets"]:::asset
    BUILD["buildInternalThumbnailUrl()"]:::code
    BACKFILL["scripts/backfill-thumbnail-urls.ts<br/>既存 thumbnail_url 再計算"]:::batch
    PERSIST["persist-enriched.ts / hourly-publish<br/>保存時 thumbnail_url 反映"]:::batch
    PA["public_articles<br/>thumbnail_url / thumbnail_emoji"]:::db
    API["GET /api/thumb<br/>サムネイル SVG 返却"]:::api
    DECODE["decodeThumbnailPayload()<br/>クエリ解釈"]:::code
    RENDER["renderThumbnailSvg()<br/>SVG 合成"]:::code
    CARD["ArticleCard img"]:::ui
    EMOJI["thumbnail_emoji fallback"]:::ui

    subgraph LEGEND["凡例"]
        direction TB
        LEGEND_DB["DB"]:::db
        LEGEND_CODE["Code"]:::code
        LEGEND_BATCH["Batch"]:::batch
        LEGEND_API["API"]:::api
        LEGEND_UI["UI"]:::ui
        LEGEND_ASSET["Asset"]:::asset
    end
    class LEGEND legendBox

    AE --> BUILD
    AET --> BUILD
    TM --> BUILD
    ST --> BUILD
    REG --> BUILD

    BUILD --> PERSIST
    BUILD --> BACKFILL
    BACKFILL --> AE
    PERSIST --> PA
    AE --> PA

    PA --> CARD
    CARD --> API
    API --> DECODE
    DECODE --> REG
    REG --> RENDER
    ASSET --> RENDER
    RENDER --> CARD

    PA --> EMOJI
```

## 6. サムネイル描画シーケンス

```mermaid
sequenceDiagram
    participant Card as ArticleCard
    participant Thumb as /api/thumb\nサムネイル SVG 返却
    participant Template as thumbnail-template.ts\nSVG 合成
    participant Registry as thumbnail-tag-registry.ts
    participant Assets as public/thumbs/*

    Card->>Thumb: GET /api/thumb?bg=...&layout=...&tags=...&lang=...&v=3
    Thumb->>Template: decodeThumbnailPayload(searchParams)
    Template->>Registry: resolveThumbnailTagRegistryEntry(tagKey)
    Registry-->>Template: accentColor / iconPath / highQualityAssetPath
    Template->>Assets: loadAssetDataUri(assetPath)
    Template->>Template: renderThumbnailSvg(payload)
    Template-->>Thumb: SVG string
    Thumb-->>Card: image/svg+xml
```

## 7. Layer2 フロー（現行名称）

```mermaid
flowchart TB
    S["source_targets"] --> F["hourly-fetch"]
    X["外部 RSS / Google Alerts / 公式フィード"] --> F

    F --> U["Google Alerts URL unwrap"]
    U --> R["articles_raw"]

    R --> N["URL 正規化 / 更新検知"]
    N --> E["enrich-worker<br/>小分け定時実行"]

    E --> P0["source content_access_policy 判定"]
    P0 -->|fulltext_allowed| C["本文取得"]
    P0 -->|feed_only| SN["snippet fallback"]
    P0 -->|blocked_snippet_only| DS["domain_snippet_only"]
    C -->|取得成功| P["本文抽出 full"]
    C -->|blocked domain / bot block| DS
    C -->|本文不足 / 抽出失敗| SN

    P --> A["AI要約 / score / dedupe / tag照合"]
    DS --> A
    SN --> A

    A --> L2["articles_enriched<br/>is_provisional / provisional_reason"]
    A --> T["articles_enriched_tags"]
    A --> TC["tag_candidate_pool"]
    A --> H["articles_enriched_history"]
    A --> RR["articles_raw.is_processed 更新"]

    F --> J["job_runs / job_run_items"]
    E --> J

    J --> K["db:check-layer12"]

    TC --> TP["daily-tag-dedup<br/>候補統合・保留整理"]
    TP --> TM["tags_master / tag_aliases"]
    TM --> A

    L2 -. 将来 .-> L3["Layer3 運用データ"]
    L2 -. 将来 .-> L4["Layer4 公開データ"]
```

## 8. 公開導線 vNext Draft

```mermaid
flowchart TD
    classDef screen fill:#ffe5b4,stroke:#f90,color:#333
    classDef api    fill:#c8f7c5,stroke:#27ae60,color:#333
    classDef admin  fill:#ffd6d6,stroke:#e74c3c,color:#333
    classDef db     fill:#e8d5ff,stroke:#8e44ad,color:#333
    classDef ui     fill:#a0f4ff,stroke:#00b4d8,color:#333

    Home["ホーム /"]:::screen --> Sidebar["カテゴリ サイドバー"]:::ui
    Home --> CardList["記事カード一覧"]:::ui
    Home --> Ranking["ランキング /ranking"]:::screen
    Home --> Search["検索 /search"]:::screen
    Home --> Tags["タグ一覧 /tags"]:::screen

    Sidebar --> CategoryOfficial["カテゴリ /category/official<br/>公式"]:::screen
    Sidebar --> CategoryNews["カテゴリ /category/news<br/>ニュース"]:::screen
    Sidebar --> CategoryPaper["カテゴリ /category/paper<br/>論文"]:::screen
    Sidebar --> CategorySearchRag["カテゴリ /category/search-rag<br/>Search / RAG"]:::screen
    Sidebar --> CategoryOss["カテゴリ /category/oss<br/>OSS"]:::screen
    Sidebar --> CategoryEnterprise["カテゴリ /category/enterprise-ai<br/>Enterprise AI"]:::screen

    CardList --> Detail["記事詳細 /articles/:publicKey"]:::screen
    CardList --> PrimaryTag["主タグ詳細 /tags/:tagKey"]:::screen
    CardList --> AdjacentTag["周辺分野タグ詳細 /tags/:tagKey"]:::screen

    Detail --> PrimaryTag
    Detail --> AdjacentTag
    Tags --> PrimaryTag
    Tags --> AdjacentTag
    CategoryOfficial --> Detail
    CategoryOfficial --> PrimaryTag
    CategoryOfficial --> AdjacentTag

    Home --> HomeApi["ホーム取得 API<br/>/api/home"]:::api
    Ranking --> TrendsApi["トレンド取得 API<br/>/api/trends"]:::api
    Search --> SearchApi["検索 API<br/>/api/search"]:::api
    Detail --> DetailApi["記事詳細 API<br/>/api/articles/:id"]:::api

    HomeApi --> PublicArticles["public_articles<br/>公開記事"]:::db
    HomeApi --> PublicRankings["public_rankings<br/>ランキング"]:::db
    HomeApi --> PublicTags["public_article_tags<br/>主タグ紐付け"]:::db
    HomeApi --> PublicAdjacentTags["public_article_adjacent_tags<br/>周辺分野タグ紐付け"]:::db
    HomeApi --> TagsMaster["tags_master<br/>主タグマスタ"]:::db
    HomeApi --> AdjacentMaster["adjacent_tags_master<br/>周辺分野タグマスタ"]:::db

    SearchApi --> PublicArticles
    TrendsApi --> PublicArticles
    TrendsApi --> PublicRankings
    DetailApi --> PublicArticles
    DetailApi --> PublicTags
    DetailApi --> PublicAdjacentTags
```

## 9. タグ導線 vNext Draft

```mermaid
flowchart LR
    classDef screen fill:#ffe5b4,stroke:#f90,color:#333
    classDef api    fill:#c8f7c5,stroke:#27ae60,color:#333
    classDef db     fill:#e8d5ff,stroke:#8e44ad,color:#333
    classDef ui     fill:#a0f4ff,stroke:#00b4d8,color:#333

    Category["カテゴリ サイドバー"]:::screen --> CategoryPage["カテゴリ詳細 /category/:slug"]:::screen
    TagList["タグ一覧 /tags"]:::screen --> PrimaryTag["主タグ詳細 /tags/:tagKey"]:::screen
    TagList --> AdjacentTag["周辺分野タグ詳細 /tags/:tagKey"]:::screen
    Detail["記事詳細 /articles/:publicKey"]:::screen --> PrimaryTag
    Detail --> AdjacentTag

    PrimaryTag --> PublicTagsApi["主タグ導線クエリ"]:::api
    AdjacentTag --> PublicAdjacentApi["周辺分野タグ導線クエリ"]:::api
    CategoryPage --> PublicCategoryApi["カテゴリ導線クエリ"]:::api

    PublicTagsApi --> TagsMaster["tags_master<br/>主タグマスタ"]:::db
    PublicTagsApi --> PublicArticleTags["public_article_tags<br/>主タグ紐付け"]:::db
    PublicTagsApi --> PublicArticles["public_articles<br/>公開記事"]:::db

    PublicAdjacentApi --> AdjacentMaster["adjacent_tags_master<br/>周辺分野タグマスタ"]:::db
    PublicAdjacentApi --> PublicAdjacentTags["public_article_adjacent_tags<br/>周辺分野タグ紐付け"]:::db
    PublicAdjacentApi --> PublicArticles

    PublicCategoryApi --> PublicArticles
```
