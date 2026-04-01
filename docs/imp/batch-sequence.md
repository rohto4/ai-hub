# バッチ別データフロー / シーケンス図

最終更新: 2026-04-01

各定時バッチの入出力テーブルと処理順を sequenceDiagram で示す。
全体の俯瞰図は `flowchart.md` を参照。

---

## 1. hourly-fetch（毎時 :00）

外部ソースから記事を取得し `articles_raw` へ投入する。

```mermaid
sequenceDiagram
    participant GHA  as GitHub Actions
    participant API  as /api/cron/hourly-fetch
    participant ST   as source_targets
    participant EXT  as 外部 RSS / API / Alerts
    participant L1   as articles_raw
    participant JR   as job_runs / job_run_items

    GHA->>API: POST Bearer CRON_SECRET ?limit=20
    API->>JR: INSERT job_run (status=running)
    API->>ST: SELECT 有効ソース一覧
    ST-->>API: source list

    loop source ごと（失敗はスキップ）
        API->>EXT: fetch RSS / API / Alerts
        EXT-->>API: items（title / url / snippet / published_at）
        API->>API: Google Alerts URL unwrap
        API->>API: URL 正規化（utm_* 除去・https 統一・末尾 / 統一）
        API->>L1: SELECT 同一 source_target_id + normalized_url
        alt 新着
            API->>L1: INSERT articles_raw
        else 更新検知（source_updated_at 新 or snippet_hash 変化）
            API->>L1: INSERT articles_raw（新 raw）
            API->>L1: UPDATE has_source_update=true
        else 重複・変化なし
            Note over API,L1: スキップ
        end
        API->>JR: INSERT job_run_items（source 単位）
    end

    API->>JR: UPDATE job_run (status=done / failed)
```

---

## 2. enrich-worker / hourly-enrich（毎時 :05〜:40、8 回）

`articles_raw` を AI 要約・タグ照合して `articles_enriched` を生成する。
1 回 20 件・`summaryBatchSize=20`・`maxSummaryBatches=1` で小分け実行。

```mermaid
sequenceDiagram
    participant GHA  as GitHub Actions
    participant API  as /api/cron/enrich-worker
    participant L1   as articles_raw
    participant ST   as source_targets
    participant OAD  as observed_article_domains
    participant BODY as 外部コンテンツ（本文取得）
    participant GEM  as Gemini（primary / secondary）
    participant OAI  as OpenAI gpt-5-mini
    participant L2   as articles_enriched
    participant L2H  as articles_enriched_history
    participant ET   as articles_enriched_tags
    participant EADT as articles_enriched_adjacent_tags
    participant TM   as tags_master / tag_aliases
    participant TCP  as tag_candidate_pool
    participant JR   as job_runs / job_run_items

    GHA->>API: POST Bearer CRON_SECRET ?limit=20&summaryBatchSize=20&maxSummaryBatches=1
    API->>JR: INSERT job_run (status=running)
    API->>L1: SELECT FOR UPDATE SKIP LOCKED（未処理 raw 20 件）
    API->>L1: UPDATE process_after = now()+30min（予約ロック）
    L1-->>API: raw 記事リスト

    loop 記事ごと（失敗はスキップ）
        API->>ST: SELECT content_access_policy
        ST-->>API: fulltext_allowed / feed_only

        alt fulltext_allowed
            API->>OAD: SELECT fetch_policy（domain 単位）
            OAD-->>API: fulltext_allowed / blocked
            alt domain=fulltext_allowed
                API->>BODY: HTTP GET 本文取得
                BODY-->>API: HTML
                API->>API: 本文抽出 → content_path=full
            else blocked domain
                API->>API: content_path=domain_snippet_only
            end
        else feed_only
            API->>API: content_path=snippet（title+snippet のみ）
        end

        API->>API: summary_input_basis 決定
        API->>API: is_provisional / provisional_reason 決定
        API->>API: publication_basis / publication_text 決定

        API->>GEM: 要約リクエスト（summary_100 / summary_200）
        alt Gemini 成功
            GEM-->>API: titleJa / summary100Ja / summary200Ja / properNounTags
        else Gemini 失敗
            API->>OAI: 要約リクエスト（fallback）
            alt OpenAI 成功
                OAI-->>API: titleJa / summary100Ja / summary200Ja / properNounTags
            else 両 provider 失敗
                API->>API: publication_basis=manual_pending
                Note over API: hold のまま DB 保持 + artifacts/manual-pending/ 出力
            end
        end

        API->>TM: SELECT タグ照合（properNounTags vs tags_master + tag_aliases）
        TM-->>API: 一致タグ / 未一致タグ

        API->>API: 隣接分野タグ抽出（title+summary_200 → 1〜2 件）
        API->>API: thumbnail_bg_theme 決定
        API->>API: 確定重複判定（normalized_url / 同一引用元）

        alt 既存 articles_enriched あり（更新）
            API->>L2H: INSERT articles_enriched_history（旧版退避）
            API->>L2: UPDATE articles_enriched（upsert）
        else 新規
            API->>L2: INSERT articles_enriched
        end

        API->>ET: INSERT / UPDATE articles_enriched_tags（一致タグ）
        API->>EADT: INSERT / UPDATE articles_enriched_adjacent_tags
        API->>TCP: INSERT / UPDATE tag_candidate_pool（未一致タグ候補）
        API->>L1: UPDATE is_processed=true（ロック解除）
        API->>JR: INSERT job_run_items
    end

    API->>JR: UPDATE job_run (status=done / failed)
```

---

## 3. hourly-publish + compute-ranks（毎時 :50）

`articles_enriched` を公開層 `public_articles` へ反映し、ランキングを再計算する。

```mermaid
sequenceDiagram
    participant GHA  as GitHub Actions
    participant PUB  as /api/cron/hourly-publish
    participant RNK  as /api/cron/hourly-compute-ranks
    participant L2   as articles_enriched
    participant ET   as articles_enriched_tags
    participant SPR  as source_priority_rules
    participant AMH  as activity_metrics_hourly
    participant PPQ  as priority_processing_queue
    participant PA   as public_articles
    participant PAS  as public_article_sources
    participant PAT  as public_article_tags
    participant PAAT as public_article_adjacent_tags
    participant PR   as public_rankings

    GHA->>PUB: POST Bearer CRON_SECRET
    PUB->>PPQ: SELECT 優先処理キュー（未処理分）
    PPQ-->>PUB: priority items

    opt 優先キューあり
        PUB->>PUB: 優先記事を先頭で処理
    end

    PUB->>L2: SELECT publish_candidate=true の公開候補
    PUB->>ET: SELECT articles_enriched_tags（候補記事分）
    PUB->>SPR: SELECT source_priority_rules
    SPR-->>PUB: 代表ソース選定ルール

    loop dedupe_group ごと
        PUB->>PUB: source_priority_rules で代表ソース決定
        PUB->>PA: UPSERT public_articles（thumbnail_url / thumbnail_emoji 含む）
        PUB->>PAS: UPSERT public_article_sources
        PUB->>PAT: UPSERT public_article_tags
        PUB->>PAAT: UPSERT public_article_adjacent_tags
    end

    PUB->>PPQ: UPDATE processed=true（処理済みキュー）
    GHA->>RNK: POST Bearer CRON_SECRET（publish 後続）
    RNK->>PA: SELECT public_articles（全件）
    RNK->>AMH: SELECT activity_metrics_hourly
    AMH-->>RNK: アクティビティ集計
    RNK->>RNK: 4 window 並列ランキング計算
    RNK->>PR: UPSERT public_rankings
```

---

## 4. daily-tag-dedup（毎日 02:30 UTC）

タグ候補を既存タグマスタと照合し、統合・昇格・保留を振り分ける。

```mermaid
sequenceDiagram
    participant GHA  as GitHub Actions
    participant API  as /api/cron/daily-tag-dedup
    participant TCP  as tag_candidate_pool
    participant TM   as tags_master
    participant TA   as tag_aliases
    participant TK   as tag_keywords
    participant GT   as Google Trends（外部 API）
    participant L2   as articles_enriched_tags
    participant PA   as public_article_tags

    GHA->>API: POST Bearer CRON_SECRET
    API->>TCP: SELECT seen_count >= 8 の高頻度候補
    TCP-->>API: candidate list
    API->>TM: SELECT 既存タグマスタ
    TM-->>API: tags list

    loop 候補ごと
        API->>API: 日本語基準の類似一致チェック vs tags_master / tag_aliases
        alt 既存タグと一致
            API->>TCP: UPDATE review_status=merged（統合済み）
        else 未一致
            API->>GT: Google Trends 照合（候補キーワード）
            GT-->>API: トレンド一致 / 不一致
            alt Trends 一致
                API->>TM: INSERT tags_master（新タグ昇格）
                API->>TK: INSERT tag_keywords
                API->>TA: INSERT tag_aliases（必要なら）
                API->>TCP: UPDATE review_status=promoted
                Note over L2,PA: 次回 hourly-enrich / hourly-publish で再タグ付け
            else Trends 不一致
                API->>TCP: UPDATE review_status=pending（手動レビュー待ち）
            end
        end
    end
```

---

## 5. weekly-archive（週次）

`articles_raw` の 1 か月超データを履歴テーブルへ退避する。

```mermaid
sequenceDiagram
    participant CRON as Cron Trigger
    participant API  as /api/cron/weekly-archive
    participant L1   as articles_raw
    participant L1H  as articles_raw_history

    CRON->>API: POST Bearer CRON_SECRET
    API->>L1: SELECT is_processed=true AND created_at < now()-30days
    L1-->>API: 対象 raw 一覧

    loop バッチごと（大量の場合は分割）
        API->>L1H: INSERT articles_raw_history（コピー）
        API->>L1: DELETE（移動完了分）
    end
```

---

## 6. monthly-public-archive（月次）

`public_articles` の半年超データを履歴テーブルへ退避する（arxiv-ai は 2 か月上限）。

```mermaid
sequenceDiagram
    participant CRON as Cron Trigger
    participant API  as /api/cron/monthly-public-archive
    participant PA   as public_articles
    participant PAH  as public_articles_history
    participant PAS  as public_article_sources
    participant PAT  as public_article_tags
    participant PR   as public_rankings

    CRON->>API: POST Bearer CRON_SECRET
    API->>PA: SELECT published_at < now()-6months（arxiv-ai は 2 か月）
    PA-->>API: 退避対象記事

    loop 対象記事ごと
        API->>PAH: INSERT public_articles_history
        API->>PA: DELETE public_articles
        Note over PAS,PR: cascade delete で関連テーブルも自動削除
        Note over PAS: public_article_sources
        Note over PAT: public_article_tags / public_article_adjacent_tags
        Note over PR: public_rankings
    end
```

---

## 7. daily-db-backup（毎日 18:15 UTC）

Neon DB 全テーブルを `pg_dump` でバックアップし、GitHub Actions artifact として保存する。

```mermaid
sequenceDiagram
    participant GHA  as GitHub Actions
    participant SCR  as scripts/backup-neon-all.mjs
    participant NEON as Neon（DATABASE_URL_UNPOOLED）
    participant ART  as Actions Artifact（7 日保持）

    GHA->>SCR: node backup-neon-all.mjs --output-dir backups/daily
    SCR->>NEON: pg_dump（全テーブル）
    NEON-->>SCR: dump ファイル群
    SCR->>GHA: backups/daily/ に出力
    GHA->>ART: upload-artifact（neon-db-backup-{run_id}）
    Note over ART: retention-days=7
```
