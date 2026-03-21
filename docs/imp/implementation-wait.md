# AI Trend Hub 実装判断待ち

最終更新: 2026-03-21

ここには実装を止めずに進めるために後から判断したい論点だけを残す。
解決済みの項目はこのファイルに残さない。

---

## 1. 判断待ち一覧

### 1.1 `activity_logs.action_type` の正式マッピング

現在の暫定実装：

| action_type | 集計先 |
|---|---|
| `view` | `impression_count` |
| `expand_200` / `topic_group_open` / `digest_click` | `open_count` |
| `article_open` | `source_open_count` |
| `share_*` | `share_count` |
| `save` | `save_count` |

- `share_open`（共有モーダルを開いただけ）⇒含めない
- `return_focus`（visibilitychange によるフォーカス復帰）⇒含めない
- `unsave` ⇒無視

■ 3点とも方針確定。実装 E で `compute-ranks` の係数調整に入るときにこのマッピングを正式化する。§2 確定済みに移動してよい。

---

### 1.2 `priority_processing_queue` の詳細設計

⇒補足説明ほしい

■ **これは何か:** 管理者が「この記事を今すぐ非表示にしたい」と操作したとき、次の `hourly-publish`（最大1時間後）を待たずに即時反映するための仕組み。キューに積んでおけば、次の publish 冒頭で先に処理される。
　⇒次のPublishとは最大何分後になる想定か。10分以上待つ可能性があるなら、即時実行バッチを考えること。

■ **最大待機時間:** `hourly-publish` は毎時 :35 に実行されるため、最悪 **59分** 待つことになる。

■ **設計の見直し提案:** queue を介さず、管理 API エンドポイントが直接 `public_articles.visibility_status = 'hidden'` を UPDATE する方式を推奨する。
- `priority_processing_queue` テーブルへの積み込み → publish 待ち、という迂回が不要になる
- 管理 API が直接 DB を叩けば**即時反映**（秒単位）
- `admin_operation_logs` への記録は同じターンでできる
- queue テーブル自体は将来の `retag` / `republish` 用に残してよいが、P0 の hide_article には使わない方がシンプル

■ **2点の判断について（修正）:**
- `target_kind` → `public_article` 一択でよい（変わらず）
- 処理タイミング → **管理 API 直接 UPDATE に変更**。queue 経由は廃止。

⇒処理整合性保つために一連の処理はバッチでやった方が再現性が高いのでは？そんなに整合性保つところがない？

■ **整合性の観点から再評価:**
`hide_article` で更新が必要な箇所を列挙する：

| 対象 | 必要な処理 | 直接 UPDATE で対応可能か |
|---|---|---|
| `public_articles.visibility_status` | `'hidden'` に更新 | ✅ |
| `public_rankings` | クエリが `visibility_status='published'` でフィルタ済みなので自動的に除外される | ✅（更新不要） |
| `admin_operation_logs` | 同一トランザクションで INSERT | ✅ |
| キャッシュ/CDN | Next.js の on-demand revalidation で `/articles/:publicKey` を無効化 | ✅（1行追加） |

■ **結論:** hide_article の整合性要件はシンプルで、DB トランザクション1本で全て完結する。バッチにしても一連の処理は同じなので再現性の差はない。**直接 API UPDATE で確定。** queue が活きるのは `retag`（L2 を再処理してから L4 に再 publish）や `republish`（複数テーブルを跨いで再計算）のような、複数ジョブを順序保証して流す必要がある場合。

影響：Phase 3 実装 D の設計

---

### 1.3 Topic Group の最終 URL 設計

- 専用 URL（`/topics/:id`）を持つか、Home 内スクロールのままにするか
  ⇒持つとしたらどんな役割のページになりますか？
- `public_article_sources` ベースの関連ソース表示をそのまま使うか

■ **`/topics/:id` の役割イメージ:** 「同一テーマを複数の視点から読むページ」。例えば「GPT-5 リリース」というトピックに対して、OpenAI 公式ブログ・VentureBeat・Zenn 等の複数記事を1ページに並べる。単一記事詳細とは違い、「話題」が主役になる。

■ **今すぐ作る必要があるか:** なし。Topic Group のグループ化は pgvector の類似度ベースが前提なので、pgvector 活用が本格化するまで設計が定まらない。Home 内スクロール（暫定）のままで問題ない。Phase 3 完了後に改めて判断する。
　⇒pgvector の類似度ベースにどんな準備が必要か記載すること

■ **pgvector 実装に必要な準備（順番）:**
1. **embedding 生成バッチ** — `title + summary_200` を embedding API（OpenAI `text-embedding-3-small` 等）に渡してベクトル化し、`articles_enriched.summary_embedding`（`vector(1536)`、migration 033 で列は追加済み）に保存する
2. **既存 2861 件の backfill** — バッチスクリプトで一括生成する（API コスト約 $0.02 程度）
3. **ベクトルインデックス作成** — `CREATE INDEX ... USING hnsw` を migration で追加する（検索速度に必要）
4. **グループ化ロジック** — 類似度 0.92 以上の記事ペアを検出し、同じ `topic_group_id`（UUID）を付与するバッチを実装する
5. **UI 設計** — グループが十分な件数（例: 3件以上）揃ってから `/topics/:id` の設計を確定する

■ **現在の状態:** 列（`summary_embedding`）は存在するが、値はすべて NULL。ステップ 1 から着手する必要がある。

⇒データベース設計はもう用意しておいて、空きカラムにしておく。この機能はサイトを使用している人にとっての良さの評価に直結する。

■ **方針変更: DB スキーマを先行して準備する**

Topic Group はユーザー体験の核になりうるため、UI 実装前に DB の受け口だけ用意しておく。

migration（次の番号で作成）に含める内容：
```sql
-- articles_enriched に topic_group_id を追加
ALTER TABLE articles_enriched
  ADD COLUMN topic_group_id uuid NULL;

-- public_articles に topic_group_id を追加
ALTER TABLE public_articles
  ADD COLUMN topic_group_id uuid NULL;

-- topic_groups テーブルを新規作成（グループのメタ情報）
CREATE TABLE topic_groups (
  topic_group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label          text NULL,          -- 将来: グループの代表ラベル（例: "GPT-5 リリース"）
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

■ **実装順の修正:**
1. ~~embedding 生成バッチ~~ → **まず migration でスキーマを用意**（値は NULL のまま）
2. embedding 生成 & backfill（コスト $0.02 程度）
3. HNSW インデックス追加
4. グループ化バッチ（`topic_group_id` を埋める）
5. UI 設計・`/topics/:id` 実装

■ この migration は `content_language`（実装 A）と同じタイミングで含めてよい。スキーマ追加のみで既存データに影響なし。

影響：Phase 3 完了後のフェーズ（スキーマのみ先行）

---

### 1.4 無効化ソースの対応方針　（破棄）

以下のソースが `is_active=false` のまま。

■ **Neon で件数を確認した結果:**

| ソース | enriched | published | 言語 | 影響度 |
|---|---|---|---|---|
| `anthropic-news` | 1件 | 1件 | 英語 | 最小（ほぼゼロ） |
| `google-ai-blog` | 1件 | 1件 | 英語 | 最小（ほぼゼロ） |
| `huggingface-papers` | 0件 | 0件 | 英語 | なし |
| `paperswithcode` | 0件 | 0件 | 英語 | なし |

■ **全て英語・全体 2371件のうち計 2件（0.08%）。影響度は事実上ゼロ。**

■ **推奨方針:**
- `anthropic-news` / `google-ai-blog` → 停止維持（B）。2件しかなく、修復コストに見合わない。Anthropic は公式ブログ（別 URL）でカバーできる可能性あり。
- `huggingface-papers` / `paperswithcode` → 不採用（B）。`arxiv-ai` で論文をカバー済みのため不要。

■ この4件はリリース判断の障害にならない。日本語ソース追加（実装 B）を優先してよい。

影響：アクティブソース数・日次取得件数（軽微）

---

### 1.5 OGP 共有ボードの設計

現状：URLコピー・紹介文コピーのみ実装済み。`/api/og?id=xxx` で動的 OGP 画像生成は存在する。

1. 記事詳細ページ（`/articles/:publicKey`）が OGP 着地先としてそのまま機能するか
   ⇒多分そのままでいい、UI改善はあとでやる
   ■ 確定。`/articles/:publicKey` を OGP 着地先とする。

2. X カードの種別（`summary_large_image` vs `summary`）
   ⇒どうちがう？
   ■ **違い:**
   - `summary` → タイトル・説明文のみ。画像は小さく左端に表示。
   - `summary_large_image` → 1200×630 の大きな画像がカード上部に全幅で表示。視覚的に目立つ。
   ■ `/api/og` で既に画像生成できるので追加実装ゼロで `summary_large_image` が使える。**`summary_large_image` 一択を推奨。**
   ⇒OGPが親切だといいよね、ほぼ賛成だけど見え方のサンプルを見せて

   ■ **X タイムラインでの見え方イメージ:**

   ```
   【summary_large_image】
   ┌─────────────────────────────────┐
   │                                 │
   │  🤖 AI Trend Hub               │
   │  [タイトルがここに入る]         │  ← /api/og で生成した画像
   │  llm · 2026-03-21              │
   │                                 │
   ├─────────────────────────────────┤
   │ aitrendhub.com                  │
   │ 記事タイトル全文                │
   │ 100字要約がここに表示される     │
   └─────────────────────────────────┘

   【summary（比較用）】
   ┌──┬──────────────────────────────┐
   │  │ aitrendhub.com              │
   │画│ 記事タイトル                │
   │像│ 要約の冒頭2行ほど           │
   └──┴──────────────────────────────┘
   ```

   ■ `summary_large_image` はタイムラインで面積が大きく、ブランド認知に有利。確定でよい。

3. `share_copy` を `share_url_copy` / `share_text_copy` に分けて記録するか
   ⇒どのチェックをつけた状態でコピーされたかを記録したい
   ■ action_type を増やさず、`meta` フィールドに状態を乗せる方式を推奨:
   ⇒推奨でOK
   ```json
   {
     "type": "url" または "text",
     "includeTitle": true,
     "includeSummary": false,
     "includeHashtag": true
   }
   ```
   `/api/actions` の `meta` は既に `Record<string, unknown>` で受け取れるので実装変更は最小。

影響：Phase 3 完了後のフェーズ

---

### 1.6 `critique` UI の有効化タイミング（保留）

`public_articles.critique` カラムは実装済みだが UI から非表示。
`daily-enrich` で critique 生成を有効化してから UI に追加する。

未確定：いつ critique 生成を有効化するか（API コスト・品質の兼ね合い）

影響：Phase 3 完了後のフェーズ

---

## 2. 確定済み判断（参照用）

| 項目 | 決定内容 |
|---|---|
| source_targets の SSOT | `scripts/seed.mjs` が唯一のマスター |
| pgvector | migration 033 で導入済み。閾値 0.92 |
| commercial_use_policy | migration 034 で実装済み。prohibited は publish 除外 |
| hourly-publish | bulk upsert 化完了（unnest ベース）200件チャンク |
| タグ昇格閾値 | 暫定 `seen_count >= 8` |
| public_rankings 時間減衰 | 1週間でスコアが 1/5 になる |
| source_type=paper のタグ | `paper` タグのみ付与 |
| publication_basis=source_snippet | Home に含める（明白な不整合のみ daily-enrich で止める） |
| 管理画面パス | `ADMIN_PATH_PREFIX` env var + `ADMIN_SECRET` トークンの二重防御 |
| action_type マッピング | share_open / return_focus → 集計対象外。unsave → 無視 |
| hide_article 実装方式 | 管理 API が直接 DB UPDATE（queue 経由なし）。即時反映・同一トランザクション内で admin_operation_logs に記録 |
| priority_processing_queue | hide_article には使わない。retag / republish 等の将来実装用に予約 |
| 無効化4ソース | 全て停止維持 or 不採用。影響度ゼロ |
| OGP 着地先 | `/articles/:publicKey` そのまま |
| X カード種別 | `summary_large_image` |
| share tracking | `meta` フィールドに `{ type, includeTitle, includeSummary, includeHashtag }` を追加 |

## 2026-03-21 Codex 引き継ぎメモ

- 停止地点は GitHub Actions 登録前です。
- Neon へ適用済みの migration:
  - `034_add_commercial_use_policy.sql`
  - `035_add_content_language_and_topic_groups.sql`
- `node scripts/seed.mjs` 実行済みです。
- 実 DB で warm-up 済みの日本語ソース:
  - `sakana-ai-blog`
  - `pfn-tech-blog`
  - `elyza-note`
  - `cyberagent-dev-blog`
  - `jdla-news`
  - `ainow`
  - `publickey`
  - `zenn-llm`
  - `zenn-aiagent`
- 確認済み:
  - `public_articles.content_language = 'ja'` の記事が存在する
  - 日本語記事の多くで `thumbnail_url` が入っている
  - `npm run type-check`
  - `npm run build`

### 未解決

- `public_article_sources` が新規 publish 分にまだ同期されていません。
- 現在の観測値:
  - `public_articles`: 日本語記事あり (`ja_count=64`, `ja_with_thumbnail=50`)
  - `articles_enriched_sources`: 日本語記事に対応する source 行あり (`source_rows=65`)
  - `public_article_sources`: 旧データ 2 行だけが残っている
- [hourly-publish-sources.ts](/G:/devwork/ai-summary/src/lib/publish/hourly-publish-sources.ts) には部分修正を入れてありますが、追加調査が必要です。
## 2026-03-21 次セッション向け待ちメモ

### 1. 今すぐ再着手しなくてよいもの

1. `content_language`
2. `thumbnail_url`
3. 日本語ソース 14 件
4. cron の fetch / enrich 分離
5. `public_articles_history` 導入と初回 age-out

### 2. 再開後の最初の候補

1. `public_article_sources` の同期不備
2. `compute-ranks` の本格軽量化
3. admin Phase 3

### 3. すでに反映済みの運用前提

1. `public_articles` は半年以内の公開集合
2. 半年超は `public_articles_history` に退避
3. `compute-ranks` は現時点で `maxDuration = 300`
4. enrich worker は 10 件単位

### 4. 本番確認で見る順

1. GitHub Actions
2. Vercel function logs
3. `job_runs`
4. `public_articles` / `public_articles_history`
5. `public_rankings`
