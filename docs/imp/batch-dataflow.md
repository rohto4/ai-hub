# バッチ別データフロー図

最終更新: 2026-04-01

各定時バッチの入出力テーブルと内部処理分岐を flowchart で示す。
処理順の詳細は `batch-sequence.md`、全体俯瞰は `flowchart.md` を参照。

凡例（全図共通）:

```mermaid
flowchart LR
    classDef batch fill:#ffd6d6,stroke:#e74c3c,color:#333
    classDef db    fill:#e8d5ff,stroke:#8e44ad,color:#333
    classDef tag   fill:#a0f4ff,stroke:#00b4d8,color:#333
    classDef ext   fill:#fff3cd,stroke:#f0ad4e,color:#333
    classDef l4    fill:#d4edda,stroke:#28a745,color:#333
    classDef arc   fill:#f5f5f5,stroke:#999,color:#333

    B["バッチ / cron"]:::batch
    D["DB テーブル（L1/L2/L3）"]:::db
    T["タグ系テーブル"]:::tag
    E["外部サービス"]:::ext
    P["公開層テーブル（L4）"]:::l4
    A["履歴 / アーカイブ"]:::arc
```

---

## 1. hourly-fetch（毎時 :00）

```mermaid
flowchart TD
    classDef batch fill:#ffd6d6,stroke:#e74c3c,color:#333
    classDef db    fill:#e8d5ff,stroke:#8e44ad,color:#333
    classDef ext   fill:#fff3cd,stroke:#f0ad4e,color:#333

    ST["source_targets\n取得元マスタ"]:::db
    EXT["外部 RSS / API / Alerts"]:::ext
    JR["job_runs\njob_run_items"]:::db

    subgraph FETCH["hourly-fetch"]
        direction TB
        F1["有効ソース取得"]:::batch
        F2["collector 選択・外部取得"]:::batch
        F3["Google Alerts URL unwrap"]:::batch
        F4["URL 正規化\nutm_* 除去 / https 統一 / 末尾 / 統一"]:::batch
        F5{"更新検知\nnormalized_url\n+ snippet_hash"}
        F6["新規 INSERT\narticles_raw"]:::batch
        F7["更新 INSERT\narticles_raw\nhas_source_update=true"]:::batch
        F8["変化なし → スキップ"]:::batch

        F1 --> F2 --> F3 --> F4 --> F5
        F5 -->|新着| F6
        F5 -->|更新検知| F7
        F5 -->|重複・変化なし| F8
    end

    ST --> F1
    EXT --> F2
    FETCH --> L1["articles_raw"]:::db
    FETCH --> JR
```

---

## 2. enrich-worker / hourly-enrich（毎時 :05〜:40）

```mermaid
flowchart TD
    classDef batch fill:#ffd6d6,stroke:#e74c3c,color:#333
    classDef db    fill:#e8d5ff,stroke:#8e44ad,color:#333
    classDef tag   fill:#a0f4ff,stroke:#00b4d8,color:#333
    classDef ext   fill:#fff3cd,stroke:#f0ad4e,color:#333

    L1["articles_raw\n（未処理 20 件）"]:::db
    ST["source_targets\ncontent_access_policy"]:::db
    OAD["observed_article_domains\nfetch_policy"]:::db
    TM["tags_master\ntag_aliases"]:::tag
    BODY["外部コンテンツ（本文取得）"]:::ext
    GEM["Gemini\nprimary / secondary"]:::ext
    OAI["OpenAI gpt-5-mini"]:::ext
    JR["job_runs\njob_run_items"]:::db

    subgraph ENRICH["enrich-worker（1 記事ずつ・失敗はスキップ）"]
        direction TB

        E1["raw CLAIM\nFOR UPDATE SKIP LOCKED\nprocess_after = now()+30min"]:::batch

        subgraph CONTENT["コンテンツ取得判定"]
            direction TB
            C1{"content_access_policy"}
            C2{"domain fetch_policy"}
            C3["本文取得 → full"]:::batch
            C4["domain_snippet_only"]:::batch
            C5["feed_only → snippet"]:::batch
            C1 -->|fulltext_allowed| C2
            C1 -->|feed_only| C5
            C2 -->|fulltext_allowed| C3
            C2 -->|blocked| C4
        end

        E2["summary_input_basis 決定\nis_provisional / provisional_reason\npublication_basis / publication_text"]:::batch

        subgraph AI["AI 要約生成"]
            direction TB
            A1["Gemini 要約リクエスト\ntitleJa / summary100Ja / summary200Ja\nproperNounTags"]:::batch
            A2{"Gemini 成功?"}
            A3["OpenAI fallback"]:::batch
            A4{"OpenAI 成功?"}
            A5["manual_pending\nartifacts/manual-pending/ 出力"]:::batch
            A1 --> A2
            A2 -->|Yes| A6["要約確定"]:::batch
            A2 -->|No| A3 --> A4
            A4 -->|Yes| A6
            A4 -->|No| A5
        end

        E3["タグ照合\ntags_master / tag_aliases vs properNounTags"]:::batch
        E4["隣接分野タグ抽出\n（title+summary_200 → 1〜2 件）\nthumbnail_bg_theme 決定"]:::batch
        E5["確定重複判定\nnormalized_url / 同一引用元"]:::batch

        E6{"既存 enriched あり?"}
        E7["旧版を history へ退避"]:::batch
        E8["articles_enriched UPSERT"]:::batch

        E1 --> CONTENT --> E2 --> AI --> E3 --> E4 --> E5 --> E6
        E6 -->|更新| E7 --> E8
        E6 -->|新規| E8
    end

    L1 --> E1
    ST --> C1
    OAD --> C2
    BODY --> C3
    GEM --> A1
    OAI --> A3
    TM --> E3

    ENRICH --> L2["articles_enriched"]:::db
    ENRICH --> L2H["articles_enriched_history"]:::db
    ENRICH --> ET["articles_enriched_tags"]:::tag
    ENRICH --> EADT["articles_enriched_adjacent_tags"]:::tag
    ENRICH --> TCP["tag_candidate_pool\n（未一致タグ候補）"]:::tag
    ENRICH --> L1U["articles_raw\nis_processed=true"]:::db
    ENRICH --> JR
```

---

## 3. hourly-publish + compute-ranks（毎時 :50）

```mermaid
flowchart TD
    classDef batch fill:#ffd6d6,stroke:#e74c3c,color:#333
    classDef db    fill:#e8d5ff,stroke:#8e44ad,color:#333
    classDef tag   fill:#a0f4ff,stroke:#00b4d8,color:#333
    classDef l4    fill:#d4edda,stroke:#28a745,color:#333

    L2["articles_enriched\n（publish_candidate=true）"]:::db
    ET["articles_enriched_tags\narticles_enriched_adjacent_tags"]:::tag
    SPR["source_priority_rules"]:::db
    AMH["activity_metrics_hourly"]:::db
    PPQ["priority_processing_queue"]:::db

    subgraph PUBLISH["hourly-publish"]
        direction TB
        P0{"優先キュー\nあり?"}
        P1["優先記事を先頭処理"]:::batch
        P2["公開候補取得\n+ タグ・ソース JOIN"]:::batch
        P3["dedupe_group ごとに\n代表ソース選定\n（source_priority_rules）"]:::batch
        P4["public_articles UPSERT\n（thumbnail_url / thumbnail_emoji）"]:::batch
        P5["public_article_sources UPSERT"]:::batch
        P6["public_article_tags UPSERT"]:::batch
        P7["public_article_adjacent_tags UPSERT"]:::batch
        P8["priority_processing_queue\nUPDATE processed=true"]:::batch

        P0 -->|Yes| P1 --> P2
        P0 -->|No| P2
        P2 --> P3 --> P4 --> P5 --> P6 --> P7 --> P8
    end

    subgraph RANKS["compute-ranks（publish 後続）"]
        direction TB
        R1["public_articles 全件読み込み"]:::batch
        R2["activity_metrics_hourly 参照"]:::batch
        R3["4 window 並列ランキング計算"]:::batch
        R4["public_rankings UPSERT"]:::batch
        R1 --> R2 --> R3 --> R4
    end

    L2 --> P2
    ET --> P2
    SPR --> P3
    PPQ --> P0
    AMH --> R2

    PUBLISH --> PA["public_articles"]:::l4
    PUBLISH --> PAS["public_article_sources"]:::l4
    PUBLISH --> PAT["public_article_tags"]:::l4
    PUBLISH --> PAAT["public_article_adjacent_tags"]:::l4
    PUBLISH --> PPQ

    PA --> RANKS
    RANKS --> PR["public_rankings"]:::l4
```

---

## 4. daily-tag-dedup（毎日 02:30 UTC）

```mermaid
flowchart TD
    classDef batch fill:#ffd6d6,stroke:#e74c3c,color:#333
    classDef db    fill:#e8d5ff,stroke:#8e44ad,color:#333
    classDef tag   fill:#a0f4ff,stroke:#00b4d8,color:#333
    classDef ext   fill:#fff3cd,stroke:#f0ad4e,color:#333

    TCP["tag_candidate_pool\nseen_count >= 8"]:::tag
    TM["tags_master"]:::tag
    TA["tag_aliases"]:::tag
    GT["Google Trends"]:::ext

    subgraph DEDUP["daily-tag-dedup"]
        direction TB
        D1["高頻度候補抽出\n（seen_count >= 8）"]:::batch
        D2["既存タグと類似一致チェック\n（日本語基準）"]:::batch
        D3{"既存タグと\n一致?"}
        D4["review_status=merged\n（統合済み）"]:::batch
        D5["Google Trends 照合"]:::batch
        D6{"Trends\n一致?"}
        D7["tags_master INSERT\ntag_keywords INSERT\ntag_aliases INSERT（必要時）\nreview_status=promoted"]:::batch
        D8["review_status=pending\n（手動レビュー待ち）"]:::batch

        D1 --> D2 --> D3
        D3 -->|一致| D4
        D3 -->|未一致| D5 --> D6
        D6 -->|一致| D7
        D6 -->|不一致| D8
    end

    TCP --> D1
    TM --> D2
    TA --> D2
    GT --> D5

    DEDUP --> TM
    DEDUP --> TA
    DEDUP --> TK["tag_keywords"]:::tag
    DEDUP --> TCP
    D7 -.->|次回 hourly-enrich で再タグ付け| L2["articles_enriched_tags"]:::db
    D7 -.->|次回 hourly-publish で反映| PA["public_article_tags"]:::db
```

---

## 5. weekly-archive（週次）

```mermaid
flowchart LR
    classDef batch fill:#ffd6d6,stroke:#e74c3c,color:#333
    classDef db    fill:#e8d5ff,stroke:#8e44ad,color:#333
    classDef arc   fill:#f5f5f5,stroke:#999,color:#333

    L1["articles_raw\nis_processed=true\ncreated_at < 30 日前"]:::db

    subgraph ARC["weekly-archive"]
        direction TB
        A1["対象 raw 抽出"]:::batch
        A2["articles_raw_history へ INSERT"]:::batch
        A3["articles_raw から DELETE"]:::batch
        A1 --> A2 --> A3
    end

    L1 --> A1
    ARC --> L1H["articles_raw_history"]:::arc
```

---

## 6. monthly-public-archive（月次）

```mermaid
flowchart LR
    classDef batch fill:#ffd6d6,stroke:#e74c3c,color:#333
    classDef l4    fill:#d4edda,stroke:#28a745,color:#333
    classDef arc   fill:#f5f5f5,stroke:#999,color:#333

    PA["public_articles\npublished_at < 6 か月前\n（arxiv-ai は 2 か月）"]:::l4

    subgraph ARC["monthly-public-archive"]
        direction TB
        M1["退避対象抽出\n（source_key で期間分岐）"]:::batch
        M2["public_articles_history へ INSERT"]:::batch
        M3["public_articles DELETE\n（cascade で関連テーブルも削除）"]:::batch
        M1 --> M2 --> M3
    end

    PA --> M1
    ARC --> PAH["public_articles_history"]:::arc
    M3 -. cascade .-> PAS["public_article_sources"]:::l4
    M3 -. cascade .-> PAT["public_article_tags\npublic_article_adjacent_tags"]:::l4
    M3 -. cascade .-> PR["public_rankings"]:::l4
```

---

## 7. daily-db-backup（毎日 18:15 UTC）

```mermaid
flowchart LR
    classDef batch fill:#ffd6d6,stroke:#e74c3c,color:#333
    classDef ext   fill:#fff3cd,stroke:#f0ad4e,color:#333
    classDef arc   fill:#f5f5f5,stroke:#999,color:#333

    NEON["Neon DB\n（DATABASE_URL_UNPOOLED）"]:::ext

    subgraph BACKUP["daily-db-backup"]
        direction TB
        B1["scripts/backup-neon-all.mjs 起動"]:::batch
        B2["pg_dump 全テーブル"]:::batch
        B3["backups/daily/ に出力"]:::batch
        B4["upload-artifact\nneon-db-backup-{run_id}\nretention-days=7"]:::batch
        B1 --> B2 --> B3 --> B4
    end

    NEON --> B2
    BACKUP --> ART["GitHub Actions Artifact\n（7 日保持）"]:::arc
```
