# AI Trend Hub Implementation Hangover

最終更新: 2026-03-17（Gemini 100件試験・backlog 1882件 manual export 反映）

## 1. このファイルの役割

セッションが切れても、ここから再開できるように現状を短く固定する。

---

## 2. 現在のフェーズ

**Layer 4 稼働済み。公開面 API は L4 系へ切替済み。Gemini 100件試験は通過。残り 1882 件は manual artifact flow へ切替済み。**

- Layer 1 → 2 → 4 の自動パイプライン完成・動作確認済み
- 745 件が `public_articles` に公開済み
- `daily-enrich` の `100件 / 10 batch` Gemini 試験は完走
- `articles_raw` の未処理は `1882` 件
- `src/app/page.tsx` は `/api/home` ベースへ切替済み
- `hackernews-ai` targeted fetch / enrich は再開確認済み
- backlog 1882 件は `artifacts/ai-enrich-inputs-backlog-1882.json` へ export 済み
- manual 作業しやすいように `part1` 〜 `part8` へ分割済み

---

## 3. バッチ構成（現在稼働中）

```
hourly-layer12（毎時 :05）
  ├── hourly-fetch  → articles_raw（Layer 1）
  └── daily-enrich → articles_enriched（Layer 2）
        ↑ tag_keywords を使った summary_200 ベースのタグマッチ

hourly-publish（毎時 :35）
  └── articles_enriched → public_articles（Layer 4）
        ↑ nanoid(11) の public_key で YouTube 風 URL
```

GitHub Actions: `.github/workflows/hourly-layer12.yml` + `.github/workflows/hourly-publish.yml`

---

## 4. Layer 2 スナップショット（2026-03-17 時点）

| 指標 | 値 |
|---|---|
| `articles_enriched` (総数) | 981件 |
| `articles_raw` 未処理 (enrich待ち) | 1882件 |
| `publication_basis=full_summary` | 611件 |
| `publication_basis=source_snippet` | 148件 |
| `ai_processing_state=manual_pending` | 0件 |

---

## 5. Layer 4 スナップショット（2026-03-17 時点）

| 指標 | 値 |
|---|---|
| `public_articles` published | 745件 |
| `public_article_tags` 総数 | 1,638件 |
| `public_rankings` | 実装済み（activity + content_score の暫定式） |

---

## 6. ソース構成（2026-03-17 確定版）

### 6.1 アクティブソース（32件）

| source_type | 件数 | 主要ソース |
|---|---|---|
| official | 11 | openai, huggingface-blog, nvidia, aws, meta, microsoft, google-ai, anthropic, deepmind, langchain, bair |
| alerts | 9 | Google Alerts 各種（llm/agent/voice/policy/safety/search） |
| blog | 9 | zenn, reddit-ml, reddit-llama, devto, hackernews, simonwillison, the-gradient, last-week-in-ai, towards-data-science |
| paper | 1 | arxiv-ai（437件取得済み） |
| news | 2 | venturebeat-ai, mit-technology-review-ai |

### 6.2 無効化ソース（要対応）

| ソース | 理由 |
|---|---|
| `anthropic-news` | feed URL 404（継続中） |
| `google-ai-blog` | parse error（継続中） |
| `huggingface-papers` | 公式 RSS 存在しない |
| `mistral-ai-news` | 公式 RSS 存在しない |
| `ledge-ai` | feed URL 不明 |
| `paperswithcode` | RSS XML 不正エンコーディング |
| `ai-news-roundup` | placeholder URL のまま無効 |

---

## 7. タグシステム構成（2026-03-17 確定版）

### 7.1 構造

- **Tier 1**（トピック分類）: llm, agent, coding-ai, enterprise-ai, generative-ai, rag, safety, voice-ai, policy, google-ai
- **Tier 2**（製品・企業）: claude, chatgpt, gpt-5, gemini, llama, cursor, openai, anthropic ... 全 67 タグ
- **tag_keywords**: 368 キーワード（収集フィルタ + Web 検索サジェスト）

### 7.2 タグマッチの仕組み

```
daily-enrich 内:
  AI 要約生成（summary_200）
    ↓
  matchTagsFromKeywords(tagKeywords, title, summary_200)
    ↓
  articles_enriched_tags に保存

hourly-publish 内:
  articles_enriched_tags → public_article_tags へ転写
```

### 7.3 既存記事のバックフィル

`npm run db:backfill-article-tags` で 745 件に一括再タグ付け済み。

---

## 8. DB スキーマの主要追加（このセッションで実施）

| migration | 内容 |
|---|---|
| 024 | `articles_enriched` に `source_category` 追加 |
| 025 | `public_articles` に `source_category` / `summary_input_basis` / `publication_basis` / `content_score` 追加 |
| 026 | `source_type`（official/blog/paper/news/video/alerts）を全テーブルに追加 |
| 027 | `critique` を拡張カラムとして追加（初期 NULL、将来付与） |
| 028 | mock3 残骸テーブル削除 |
| 029 | `source_type` CHECK に `paper` 追加 |
| 030 | `tag_keywords` テーブル新規作成 |

---

## 9. 残っている主な課題

1. **manual artifact flow の実施**
   - `artifacts/ai-enrich-inputs-backlog-1882.json` を外部要約フローへ投入
   - `artifacts/ai-enrich-output-template-backlog-1882.json` を埋めて import する
2. **manual import 後の publish 反映**
   - `scripts/import-ai-enrich-outputs.ts` で L2 へ戻す
   - `hourly-publish` を実行して L4 公開面へ反映する
3. **無効化ソースの修復または代替**
   - `anthropic-news` / `google-ai-blog` の feed URL を調査
   - `huggingface-papers` の代替 RSS を探す（例: tldr.takara.ai）
4. **L3 正式運用の詰め**
   - `activity_logs.action_type` の正式マッピングを確定
   - `public_rankings` の係数調整を行う
5. **priority_processing_queue の最小実装**
   - `hide_article` から入るか、別 worker に分けるかを決める

---

## 10. すぐ使うコマンド

```bash
# 全 DB バックアップ
node scripts/backup-neon-all.mjs --output-dir backups/manual

# 型チェック
npm run type-check

# ソース状態確認
npm run db:check-layer12
npm run db:check-source-policies

# Gemini 100件 / 10 batch 試験
npx tsx scripts/run-daily-enrich.ts --limit 100 --summary-batch-size 10 --max-summary-batches 10

# manual backlog export
npx tsx scripts/export-ai-enrich-inputs.ts --limit 1882 --policy all --export-mode seed_only --output artifacts/ai-enrich-inputs-backlog-1882.json
npx tsx scripts/import-ai-enrich-outputs.ts --input artifacts/ai-enrich-inputs-backlog-1882.json --write-template-only --template-output artifacts/ai-enrich-output-template-backlog-1882.json

# 分割済み manual backlog
artifacts/ai-enrich-inputs-backlog-1882-part1.json
artifacts/ai-enrich-inputs-backlog-1882-part2.json
artifacts/ai-enrich-inputs-backlog-1882-part3.json
artifacts/ai-enrich-inputs-backlog-1882-part4.json
artifacts/ai-enrich-inputs-backlog-1882-part5.json
artifacts/ai-enrich-inputs-backlog-1882-part6.json
artifacts/ai-enrich-inputs-backlog-1882-part7.json
artifacts/ai-enrich-inputs-backlog-1882-part8.json

# fetch / enrich / publish
npx tsx scripts/run-hourly-fetch.ts --limit 50
# npx tsx scripts/run-daily-enrich.ts --limit 50  ← スクリプト未作成
npx tsx scripts/run-hourly-publish.ts

# タグ系
npm run db:seed-keywords       # tag_keywords 再投入
npm run db:backfill-article-tags  # 既存記事タグ再付与

# Layer 4 確認 SQL（Neon）
SELECT source_type, COUNT(*) FROM public_articles GROUP BY source_type;
SELECT tag_key, article_count FROM tags_master ORDER BY article_count DESC LIMIT 20;
```

## 10.1 バックアップ運用（2026-03-20 追加）

1. Neon の direct 接続 (`DATABASE_URL_UNPOOLED`) を使う `pg_dump` ベースで全 DB バックアップを取る
2. `scripts/backup-neon-all.mjs` は `pg_dumpall --globals-only` + 各 DB `pg_dump -Fc` を実行する
3. GitHub Actions `daily-db-backup.yml` を追加済み
4. backup artifact は 7 日保持し、その後 GitHub 側で自動削除される
5. `artifacts/` は手動 import/export の残骸なので、バックアップ確認後は削除してよい

---

## 11. 次セッションの推奨読込み順

1. `docs/imp/imp-hangover.md`（このファイル）
2. `docs/imp/implementation-wait.md`（判断待ち）
3. `docs/imp/implementation-plan.md`（全体方針）
4. `docs/imp/screen-flow.md`（画面遷移）
5. `docs/imp/data-flow.md`（cron / L1-L4 / ranking / archive）
5. `docs/spec/04-data-model-and-sql.md`（スキーマ）

---

## 12. 2026-03-18 引き継ぎメモ

### 12.1 backlog 1882 件は登録済み

1. `articles_raw.is_processed = 2863/2863`
2. `articles_enriched = 2861`
3. backlog `1882` 件に限る title 日本語化漏れは `0`
4. 旧データ由来の非日本語 title は全体で `211`

### 12.2 L2/L4 の分類整合は回復済み

1. `source_targets` を正として `articles_enriched.source_type` を再同期済み
2. 修正件数は `1866`
3. 現在の `source_type` 不一致は `0`
4. 補正 SQL は `docs/imp/sql/2026-03-18-l2-l4-data-realign.sql`

### 12.3 publish はまだ遅い

1. `hourly-publish` 再実行で `public_articles` は `745 -> 911` まで増えた
2. ただし job は長時間化し、`job_run_id=93` を停止して `failed` にした
3. 2371 publish candidate を安定反映するには bulk 化が必要

### 12.4 次にやるべきこと

1. `hourly-publish` の bulk upsert 化
2. publish 完走後の `compute-ranks` 再実行
3. Home UI のカテゴリ定義を `source_type` / `source_category` 分離前提で整理 → **2026-03-19 完了**
4. summary 途中切れ対策と snippet 品質 gate の導入

### 12.5 2026-03-18 抜き取り品質監査メモ

1. `articles_enriched.title` の非日本語行は `0` になった
2. ただし公開候補 10 件のランダム監査で、次の問題を確認した
   - summary の途中切れ
   - `source_snippet` の title-summary 内容ずれ
   - `paper` でのタグ誤付与
3. `summary_100` 長さ `100+` は `398` 件、`summary_200` 長さ `200+` は `1016` 件
4. `publication_basis='source_snippet'` は `294` 件あり、Web 表示前に品質 gate が必要

### 12.6 2026-03-18 追加実装

1. `source_snippet` 向け prompt 制約を強化し、明白な title-summary 不一致は `daily-enrich` 側で止めるようにした
2. `source_type='paper'` は `paper` タグのみ付与に変更済み
3. `public_articles.thumbnail_emoji` を追加し、既存 911 件も backfill 済み

---

## 13. 2026-03-19 引き継ぎメモ

### 13.1 Home 本実装完了

1. `/api/home` を `{ ranked, lanes, stats, activity }` 形式に変更
2. `lanes` は source_type 5 種を並列クエリで各 4 件取得（件数保証）
3. `stats` は source_type 別・source_category 別の件数を 1 SQL で返す
4. `page.tsx` を全面更新：Stats ダッシュボード（16 KPI）+ ranked セクション + Source Lanes 常時表示
5. `ArticleCard` のタイトルを `/articles/:publicKey` へ内部遷移 Link に変更
6. `resolveEmoji()` で thumbnail_emoji が 🧠/📝 の場合は source_type ベースで多様化

### 13.3 2026-03-20 追加実装

1. **migration 034 適用済み（Neon 本番）**
   - `source_targets.commercial_use_policy` / `observed_article_domains.commercial_use_policy` / `articles_enriched.commercial_use_policy` / `articles_enriched_history.commercial_use_policy` 追加
   - ToS 調査結果を初期データとして投入: prohibited 6件（itmedia/techcrunch/nikkei/qiita）、permitted 6件（sakana/pfn/zenn/jdla/ainow/publickey）
   - `articles_enriched` の existing データをバックフィル
   - enrich 時に source+domain の最厳値で自動判定・保存
   - hourly-publish 時に `prohibited` を公開対象から除外

2. **hourly-publish の bulk upsert 化完了**
   - `(sql as any)(rows, ...cols)` 構文（postgres.js 専用）を `unnest(array::type[], ...)` 方式に全面書き換え
   - L4 が 911 → 2371 件に増加（upserted: 2371, failed: 0）

3. **ホーム本実装**
   - `/api/home` lanes 化、Stats ダッシュボード（14 KPI）、ランダム/新着/ユニーク 3セクション
   - サマリーモーダル、共有モーダル再設計（URLコピー/紹介文コピー、✅チェックボックス）
   - `/digest` ページ新規作成
   - `/saved`、`/liked` ページ新規作成
   - `/api/articles/[id]` 新規作成

4. **モバイル・タブレット対応**
   - BottomNav（mobile のみ）、ヘッダー auto-hide、Stats 横スクロール、Lane カルーセル

### 13.4 日本語ソース追加候補（ToS確認・RSS動作確認済み）

| ソース | RSS URL | source_type | content_language |
|---|---|---|---|
| Sakana AI Blog | `https://sakana.ai/feed.xml` | official | ja |
| PFN Tech Blog | `https://tech.preferred.jp/ja/feed/` | official | ja |
| ELYZA | `https://note.com/elyza/rss` | official | ja |
| Zenn LLM | `https://zenn.dev/topics/llm/feed` | blog | ja |
| Zenn 生成AI | `https://zenn.dev/topics/生成ai/feed` | blog | ja |
| Zenn AIエージェント | `https://zenn.dev/topics/aiagent/feed` | blog | ja |
| Zenn RAG | `https://zenn.dev/topics/rag/feed` | blog | ja |
| Zenn OpenAI | `https://zenn.dev/topics/openai/feed` | blog | ja |
| Zenn Claude | `https://zenn.dev/topics/claude/feed` | blog | ja |
| Zenn Gemini | `https://zenn.dev/topics/gemini/feed` | blog | ja |
| CyberAgent Dev Blog | `https://developers.cyberagent.co.jp/blog/feed/` | official | ja |
| JDLA | `https://www.jdla.org/news/rss/` | official | ja |
| AINOW | `https://ainow.ai/feed/` | news | ja |
| Publickey | `https://www.publickey1.jp/atom.xml` | news | ja |

追加時は `scripts/seed.mjs` に追記し、`commercial_use_policy: 'permitted'` を設定。
`content_language` カラムは migration 035 で追加予定（実装待ち）。

### 13.5 残件（次セッション向け）

1. **日本語ソース追加**（上記 13.4 の候補を seed に追記）
2. `content_language` カラム追加 migration（migration 035）
3. ArticleCard に language バッジ（JP/EN）を表示
4. Phase 3: 管理画面基盤（推測不能パス + ADMIN_SECRET）
5. Phase 3: `hide_article` キュー最小実装
6. Phase 3: タグレビュー UI
7. Phase 3: `source_targets.is_active` ON/OFF スイッチ（admin UI）
8. `compute-ranks` 再実行（L4 が 2371 件に増えたため）

### 13.3 未コミットの変更一覧

- `src/lib/db/types.ts` — HomeLaneKey/HomeLanes 追加、HomeStats/HomeResponse 拡張
- `src/lib/db/public-feed.ts` — listPublicArticlesLanes/getHomeStats 拡張
- `src/app/api/home/route.ts` — lanes 返却
- `src/components/card/ArticleCard.tsx` — Link 化、元記事ボタン、resolveEmoji
- `src/app/page.tsx` — 全面更新
- `docs/imp/implementation-plan.md` — 本ファイル更新
- `docs/imp/imp-hangover.md` — 本ファイル更新

## 14. 2026-03-20 リファクタリング引き継ぎ

### 14.1 完了

1. `mock4` を削除した
2. `Genre` を `SourceCategory`、`article.genre` を `article.sourceCategory` へ統一した
3. `LaneKey/Lanes` へ型名を整理した
4. `src/app/page.tsx` を分割し、Home ロジックを `src/components/home/useHomeState.ts` へ移した
5. `resolveEmoji` を `src/lib/publish/thumbnail-emoji.ts` へ集約した
6. RSS ルートを `/feed.xml` へ移し、`/feed` の案内ページと競合しない構成にした

### 14.2 残件

1. `src/components/home/useHomeState.ts` 自体は 88 行まで縮小したが、Home 状態系は全体としてまだ 4 ファイルにまたがる
2. `src/app/page.tsx` は 203 行で、計画目標の 150 行未満は未達
3. `src/components/home/useHomeActions.ts` が 216 行あり、share/search/article interaction でまだ分割余地がある
4. コメント整理は `hourly-publish.ts` / `summarize.ts` / `auth/admin.ts` などが未着手
5. `push_subscriptions` テーブル列名はまだ `genres` のままなので、DB 仕様変更を行うなら Human-in-the-Loop 対象

### 14.4 追加完了（2026-03-20）

1. `public-feed` を `public-articles/home/search/tags/shared` に分割した
2. `public-feed.ts` は互換維持の barrel として残した
3. `npm run build` / `npm run type-check` を再確認した
4. `public-articles` を `rankings/listings/detail` へ再分割した
5. Home 状態を `shared/data/actions/state` の4層へ再分割した

### 14.3 確認済み

1. `npx next typegen`
2. `npm run type-check`
3. `npm run build`
### 2026-03-20 追加進捗: Home action 再分割

1. `src/components/home/useHomeActions.ts` は 216 行から 104 行へ縮小
2. article 操作は `src/components/home/useHomeArticleActions.ts` へ分離
3. share modal state は `src/components/home/useHomeShare.ts` へ分離
4. topic filter / KPI / article 集約は `src/components/home/useHomeDerivedArticles.ts` へ分離
5. 検証は `npm run build` / `npx next typegen` / `npm run type-check` を通過
6. 次候補は `src/app/page.tsx` の section 単位分割、または `hourly-publish.ts` などのコメント整理

### 2026-03-21 追加進捗: Home page shell 分割

1. `src/app/page.tsx` は 65 行まで縮小
2. 左カラム UI は `src/components/home/HomePrimaryColumn.tsx` へ移動
3. `HomePage` の責務は shell / sidebar / modal 配置へ限定
4. 次候補は `HomePrimaryColumn.tsx` の further split ではなく、`hourly-publish.ts` など未着手の大物へ移るのが自然
### 2026-03-21 追加進捗: hourly-publish 分割

1. `src/lib/jobs/hourly-publish.ts` は 553 行から 88 行へ縮小
2. 候補取得、source 同期、tag 同期、bulk/per-article upsert、hidden 化を `src/lib/publish/` 配下へ分離
3. `runHourlyPublish()` の公開インターフェースは維持
4. 検証は `npm run build` / `npx next typegen` / `npm run type-check` を通過
5. 次候補は `src/lib/ai/summarize.ts` または `src/lib/db/enrichment.ts`
### 2026-03-21 追加進捗: summarize / enrichment / daily-enrich / topic

1. `src/lib/ai/summarize.ts` は facade のみに縮小し、prompt/provider/fallback を分離
2. `src/lib/db/enrichment.ts` は raw/dedupe/upsert の barrel に変更
3. `src/lib/jobs/daily-enrich.ts` は orchestrator のみに縮小し、prepare/persist/shared を `src/lib/enrich/` へ分離
4. `/api/home?topic=...` を追加し、Home の topic filter を server-side 化
5. build / typegen / type-check は通過
6. 大きい未完了は `scripts` 系の統一と、一部コメント整理

## 15. 2026-03-21 追加進捗: content_language / thumbnail / 日本語ソース前準備

### 15.1 今回完了したこと

1. migration `035_add_content_language_and_topic_groups.sql` を追加した
   - `source_targets.content_language`
   - `articles_enriched.content_language`
   - `articles_enriched_history.content_language`
   - `public_articles.content_language`
   - `articles_enriched.topic_group_id`
   - `articles_enriched_history.topic_group_id`
   - `public_articles.topic_group_id`
   - `topic_groups` テーブル
2. `daily-enrich` で `source_targets.content_language -> articles_enriched.content_language` を伝搬するコードを追加した
3. `hourly-publish` で `articles_enriched.content_language -> public_articles.content_language` を転送するコードを追加した
4. 公開 query / `Article` 型 / `ArticleCard` に `content_language` を通し、`JP / EN` バッジを表示できる状態にした
5. `thumbnail_url` は外部記事画像取得ではなく、内部テンプレート SVG を返す `/api/thumb` 方式で実装した
6. `src/lib/publish/thumbnail-template.ts` を追加し、tags + title/summary 出現順 + hash tie-break でサムネイル URL を決定するようにした
7. `src/lib/publish/thumbnail-tag-registry.ts` を追加し、主要タグは registry、未登録タグは自動生成ラベルで扱えるようにした
8. `daily-enrich` の upsert 時に `thumbnail_url` を L2 へ保存するようにした
9. `scripts/seed.mjs` に日本語ソース 14 件を追加し、`contentLanguage` / `commercialUsePolicy` を投入できるようにした

### 15.2 検証結果

1. `npx next typegen` 通過
2. `npm run type-check` 通過
3. `npm run build` 通過

### 15.3 重要な前提

1. build 時に参照する DB は migration 035 未適用の可能性があるため、公開 query は `public_articles.content_language` がまだ無い場合でも `NULL::varchar(2)` へフォールバックするようにした
2. 一方で `daily-enrich` / `hourly-publish` の write path は migration 035 適用前に実行すると失敗する
3. したがって次の実行順は固定する
   - 先に migration 035 を Neon へ適用
   - 次に `node scripts/seed.mjs`
   - その後に `fetch -> enrich -> publish`

### 15.4 次にやること

1. Human-in-the-Loop として migration 035 の Neon 本番適用可否を確認する
2. `node scripts/seed.mjs` を実行して日本語ソース 14 件と `content_language` を source master に反映する
3. 小さく `fetch -> enrich -> publish` を手動確認する
4. その後に GitHub Actions を有効化する

### 15.5 まだやっていないこと

1. Neon 本番への migration 035 適用
2. `scripts/seed.mjs` の実行
3. 日本語ソースの実 fetch
4. `content_language` backfill 結果の DB 実確認
5. `thumbnail_url` が実データへ入った状態の目視確認
## 2026-03-21 handoff: GitHub Actions 直前までの実装まとめ

### 実装済み

1. `content_language`
   - migration 035 適用済み
   - `source_targets -> articles_enriched -> public_articles` 伝搬済み
   - `ArticleCard` で `JP / EN` バッジ表示済み
2. `thumbnail_url`
   - 外部記事画像取得ではなく内部テンプレサムネイル方式
   - `/api/thumb` で描画
   - `public_articles.thumbnail_url` に保存
3. 日本語ソース
   - 14 件を seed 追加済み
   - warm-up fetch/enrich/publish 実施済み
4. cron 再設計
   - `hourly-fetch` と `hourly-enrich` を分離
   - enrich は 10 件 worker x 毎時 4 回
   - `compute-ranks.maxDuration = 300` へ変更済み
5. L4 月次アーカイブ
   - migration 036 適用済み
   - `public_articles_history` 追加済み
   - 半年超 1073 件を履歴退避済み

### 現在の本番前提

1. `public_articles` は半年以内の公開集合として扱う
2. `public_articles_history` は age-out 履歴を保持する
3. `compute-ranks` は publish 後続 step のまま。ただし timeout 再発時は分離を検討する

### 解決済み（2026-03-21〜22 セッション）

1. `public_article_sources` bigint 型バグ修正・全件バックフィル（2件→2504件）
2. `compute-ranks` 最適化（1回読み込み + 4window 並列 upsert）
3. admin Phase 3 全体
   - `/admin/login`, `/admin`, `/admin/articles`, `/admin/tags`, `/admin/sources`, `/admin/jobs`
   - `ADMIN_SECRET` 認証・`hide_article`・タグ昇格・`is_active` ON/OFF
   - ジョブログ画面（`/admin/jobs`）: 失敗 item の詳細・metadata を展開表示
4. `content_language` を全公開 API に通した（hasDatabaseColumn 廃止）
5. en ソース記事タイトルの日本語翻訳修正
   - enrich プロンプトに `titleJa` / `properNounTags` を追加
   - 既存 1622 件を `backfill-ja-titles.ts` で翻訳・更新済み
6. OGP 画像 API（`/api/og`）+ 記事詳細 `generateMetadata` 追加
7. sitemap.xml + robots.txt 追加
8. タグシステム全面改善
   - タグ候補を固有名詞（CamelCase・全大文字・非文頭大文字）に限定
   - enrich の properNounTags で AI 抽出に切り替え
   - `daily-tag-dedup` 日次バッチ追加（Gemini で候補と既存タグを照合 → 自動統合 + 遡及タグ付け）
   - 昇格時に `tag_key` をハイフン正規化（URL-safe）
   - タグレビュー UI: 文脈表示・保留・棄却・候補に戻す
   - 昇格時の遡及タグ付け（L2/L4 両方）
   - 既存候補 5304件から 2500件超を棄却（STOPWORDS 拡充）
9. `HomeStats` に jaCount / enCount 追加
10. `/api/home` に ranked セクション追加
11. 各ページの dev-mode description を本番テキストに修正

### 残り未解決

1. Topic Group 本実装（pgvector 前提、後回し）
2. `tags_master` のエイリアス追加 UI（現状 SQL 直接）

### 次セッションの確認事項

1. `daily-tag-dedup` の初回 Actions 実行結果を `/admin/jobs` で確認
2. タグ候補の AI 抽出（properNounTags）が正常に機能しているか enrich ログで確認
3. `push_subscriptions.genres` カラム名変更（未対応・Human-in-the-Loop 対象）
