# AI Trend Hub 実装計画

最終更新: 2026-03-22

---

## 1. 現在のフェーズ

**Phase A〜F 完了。UI調整・係数チューニング・Topic Group が残タスク。**

### 1.1 完了済み（2026-03-22 時点）

- Layer 1 → 2 → 4 の自動パイプライン稼働中
- `content_language` 導入・日本語ソース 14件・タイトル日本語翻訳（en→ja）完了
- `thumbnail_url` 内部テンプレート方式で実装済み
- admin Phase 3 全体（記事管理・タグレビュー・ソース管理・ジョブログ）
- `daily-tag-dedup` 日次自動タグ統合バッチ追加
- OGP画像（/api/og）・sitemap.xml・robots.txt 追加
- `public_article_sources` バグ修正・compute-ranks 最適化
- Phase A / B / C / D / E / F-1 完了、F-2 部分完了

### 1.2 データ現況（2026-03-22）

| 指標 | 値 |
|---|---|
| `public_articles` published | ~2600件 |
| アクティブソース | 46件（日本語ソース 14件追加後） |
| `tag_keywords` | 368件 + 昇格時自動追加分 |
| `tag_candidate_pool` (candidate) | ~3000件 |

### 1.3 稼働中バッチ

```
hourly-fetch（毎時 :00）
hourly-enrich（毎時 :10/:20/:30/:40）← 10件 × 4回
hourly-publish（毎時 :50）
  └── compute-ranks も後続で実行
daily-db-backup（毎日 18:15 UTC）
daily-tag-dedup（毎日 02:30 UTC）← 新規追加
monthly-public-archive（月次）
```

---

## 2. 設計原則（確定）

公開面の3軸は分離して扱う：

1. **topic filter**: `source_category`（llm / agent / voice / policy / safety / search / news）
2. **source lane**: `source_type`（official / blog / paper / news / alerts）
3. **trend/entity filter**: tags（`public_article_tags`）

この3軸を1つの `category` パラメータに押し込まない。

---

## 3. 次の実装順（A → B → C → D → E → F）

### A. migration 035・`content_language` 導入と既存データ整合

1. migration 035 を作成し、以下を一括追加する：
   - `source_targets` / `articles_enriched` / `public_articles` に `content_language varchar(2) NULL`
   - `articles_enriched` / `public_articles` に `topic_group_id uuid NULL`
   - `topic_groups` テーブル新規作成（`topic_group_id uuid PK`, `label text NULL`, `created_at`）
   - ※ `topic_group_id` は当面 NULL のまま。スキーマの受け口だけ先行して用意する
2. backfill SQL を用意し、既存 L2 / L4 を `ja / en` で埋め直す（SSOT は `source_targets`）
3. `source_targets.content_language` を seed に反映し、既存ソースを分類する
4. enrich 時に `source_targets.content_language → articles_enriched.content_language` を伝搬する
5. publish 時に `articles_enriched.content_language → public_articles.content_language` を伝搬する
6. 公開 API / 型定義 / query を更新する
7. `ArticleCard` に `JP / EN` バッジを追加する
8. backfill 結果を確認し、件数差分と例外ソースを記録する

**注意:** migration の Neon 本番実行前にユーザー確認を取ること。

### B. 小型サムネイル（`thumbnail_url`）導入

#### B-1. 目的

- OGP 画像とは別に、一覧カードで安定表示できる小型サムネイルを全記事へ付与する
- enrich 時に AI 画像生成は行わない
- 元記事の `og:image` 取得を主軸にせず、**自前テンプレート合成**を主軸にする

#### B-2. 採用方針

`thumbnail_url` は「外部画像 URL」ではなく、**内部テンプレート画像の割当結果**として扱う。

方式:

1. ベース背景は `source_type` / `source_category` に応じて切り替える
2. 上に載せる主役要素は tags を使って決める
3. ただし **タグ固定優先順位は持たない**
4. 採用するタグ順は次の順で決める
   - title に先に出たタグ
   - title に出ない場合は summary_200 に先に出たタグ
   - 同点時のみ `canonical_url` または `public_key` のハッシュで決定論的に崩す
5. 1タグなら中央、2タグなら斜め重ね、3タグなら小バッジ列、4件以上は `上位2件 + +n` にする

#### B-3. 「固定優先順位を持たない」の意味

- `gpt` を常に `gemini` より優先する、のような**グローバル固定序列を禁止**する
- サイト全体が特定モデル推しに見えないことを優先する
- 記事ごとの文面に現れた順、または決定論的ランダムに近いハッシュ順で採用する

#### B-4. 実装形

1. `public/thumbs/backgrounds/` に背景テンプレを置く
   - `official-llm`
   - `official-agent`
   - `blog-llm`
   - `paper`
   - `news`
   - `alerts`
2. `public/thumbs/icons/` にタグ用アイコンを置く
   - `gpt`
   - `gemini`
   - `claude`
   - `openai`
   - `google`
   - `rag`
   - `agent`
   - `paper`
   - など主要タグから開始する
3. `src/lib/publish/thumbnail-template.ts` を追加し、以下を実装する
   - 採用タグ候補の抽出
   - title / summary 上の出現位置計算
   - 同順位時のハッシュタイブレーク
   - 背景テンプレ選択
   - レイアウト種別決定（single / dual / trio / overflow）
    - 最終 `thumbnail_url` の解決
4. `thumbnail_url` は内部 URL を返す
   - 例: `/thumbs/render/official-llm/gpt+gemini/dual-a.svg`
   - あるいは将来 `/api/thumb/:publicKey` へ寄せてもよいが、初期は静的 URL 優先

#### B-4.1 タグ昇格時の画像資産運用

小型サムネイルを tags ベースで組むため、**新規タグが `tags_master` に追加されたときに画像資産側も追随できる構造**を先に用意する。

必要な構成:

1. `src/lib/publish/thumbnail-tag-registry.ts`
   - `tag_key -> icon asset path / short label / accent color / fallback mode` を持つ
2. `public/thumbs/icons/`
   - 実アイコン SVG / PNG の置き場
3. `icon_pending` の概念
   - `tags_master` には存在するが registry 未登録のタグを指す

運用ルール:

1. tag 昇格時に registry 未登録でも publish は止めない
2. 未登録タグは次の順で処理する
   - 登録済みタグだけでサムネイルを組めるならそれを使う
   - 一部未登録なら `+n` 表示へ吸収する
   - すべて未登録なら `thumbnail_emoji` にフォールバックする
3. 日次タグ昇格処理、または管理画面の tag 昇格操作では次を必ず行う
   - registry 登録有無の確認
   - 未登録なら `icon_pending` として記録
   - 後続の資産追加対象として残す

将来の自動化:

1. `daily-tag-promote` 実装時に、昇格タグを `thumbnail asset review queue` に積む
2. アイコン追加後に registry を更新する
3. 必要なら対象タグを含む `public_articles.thumbnail_url` を再計算する

初期実装では、**自動画像生成ではなく registry ベースの手動追加運用**を採る。

#### B-5. 初期実装の割り切り

1. まずは主要タグだけアイコンを用意する
2. アイコンがないタグはテキストチップ化、または `thumbnail_emoji` にフォールバックする
3. 外部画像取得は後回し
4. 画像欠落時でも一覧崩れしないことを優先する
5. タグ昇格時に即画像が無くても publish を止めない

#### B-6. データの流れ

1. `daily-enrich` 後には tag 情報が `articles_enriched_tags` に揃う
2. `hourly-publish` で `articles_enriched` + tag 情報から `thumbnail_url` を解決する
3. `public_articles.thumbnail_url` へ保存する
4. UI は `thumbnail_url` を優先し、空なら `thumbnail_emoji` を使う

#### B-7. 禁止事項

1. Gemini / OpenAI にサムネイル生成を都度依頼しない
2. 外部記事の画像 URL を必須扱いにしない
3. タグ固定優先順位を入れない
4. アイコン未登録タグを理由に publish を止めない

### C. 日本語ソース 14 件投入（A, B 完了後）

候補ソース（`imp-hangover.md §13.4` 参照）を seed に追記する。

| ソース | RSS URL | source_type |
|---|---|---|
| Sakana AI Blog | `https://sakana.ai/feed.xml` | official |
| PFN Tech Blog | `https://tech.preferred.jp/ja/feed/` | official |
| Zenn LLM | `https://zenn.dev/topics/llm/feed` | blog |
| Zenn 生成AI | `https://zenn.dev/topics/生成ai/feed` | blog |
| CyberAgent Dev Blog | `https://developers.cyberagent.co.jp/blog/feed/` | official |
| JDLA | `https://www.jdla.org/news/rss/` | official |
| AINOW | `https://ainow.ai/feed/` | news |
| Publickey | `https://www.publickey1.jp/atom.xml` | news |
| （他6件は `imp-hangover.md §13.4` 参照） | | |

追加時: `commercial_use_policy: 'permitted'`・`content_language: 'ja'`・`is_active: true` を設定する。

### D. GitHub Actions 登録前確認（C 完了後）

1. `hourly-layer12` が現行の正規入口であることを確認する
2. `hourly-publish` が現行の正規入口であることを確認する
3. `daily-db-backup` が公開系ジョブと独立していることを確認する
4. 旧 `/api/cron/ingest-feeds` を叩く外部 cron がないことを確認する
5. `APP_URL` / `CRON_SECRET` / DB 環境変数の投入先を整理する
6. 日本語ソース投入後に一度手動で `fetch -> enrich -> publish` を確認してから GitHub Actions を有効化する

### E. 言語軸導入後の公開面調整（D 完了後）

1. JP/EN 混在後の表示分布を確認し、Home の lane 件数・見せ方を微調整する
2. 検索・ranking・digest での `content_language` の扱いを整理し、型と集計の受け口を揃える
3. 言語フィルタを実装しない場合は docs に非対象と明記する

### F. Phase 3 管理画面基盤（E 完了後）

1. 管理ルートを `ADMIN_PATH_PREFIX` env var で定義する（推測不能なパス）
2. 既存の `ADMIN_SECRET` トークン認証を全管理 API に適用する
3. `hide_article` を管理 API エンドポイントで直接実装する
   - `POST /api/admin/articles/:id/hide` が `public_articles.visibility_status = 'hidden'` を直接 UPDATE する
   - 同一トランザクションで `admin_operation_logs` に記録する
   - Next.js on-demand revalidation で `/articles/:publicKey` のキャッシュを即時無効化する
   - `priority_processing_queue` は使わない（queue は `retag` / `republish` 等の将来実装用に予約）
4. タグレビュー UI（`tag_candidate_pool → tags_master` 昇格・キーワード追加）を実装する
5. `source_targets.is_active` ON/OFF スイッチを管理画面へ追加する
6. すべての操作を `admin_operation_logs` に記録する

### G. ランキングと運用調整（F 完了後）

`activity_logs` の正式マッピング（確定済み）：

| action_type | 集計先 |
|---|---|
| `view` | `impression_count` |
| `expand_200` / `topic_group_open` / `digest_click` | `open_count` |
| `article_open` | `source_open_count` |
| `share_*` | `share_count` |
| `save` | `save_count` |
| `share_open` / `return_focus` | 集計対象外 |
| `unsave` | 無視（減算しない） |

実装手順：
1. 上記マッピングを `compute-ranks` ロジックに正式反映する
2. `compute-ranks` の係数を確認・調整する
3. `compute-ranks` を再実行し、結果を監査する

---

## 4. Phase 3 完了後に回すもの

### 実装済み（参照のみ）
- **OGP**: `/api/og` 実装済み。`summary_large_image` で記事詳細ページに設定済み。
- **Admin Phase 3**: 全体実装済み（articles / tags / sources / jobs）。

### 次フェーズで実装するもの

- **Topic Group（`/topics/:id`）**
  - pgvector embedding 生成バッチ → 既存記事への backfill（$0.02 程度）
  - HNSW インデックス（migration）
  - グループ化バッチ（類似度 0.92 以上を同 `topic_group_id` に集約）
  - UI: `/topics/:id` = 同テーマの複数視点記事を並べるページ
  - スキーマ（`topic_group_id`, `topic_groups`）は migration 035 で先行追加済み

- **`compute-ranks` 係数チューニング**
  - アクティビティデータが蓄積したら `impression` / `open` / `share` / `save` / `sourceOpen` のウェイトを見直す
  - 時間減衰（1週間で 1/5）が実態と合っているか確認する

- **share tracking 詳細化**
  - `share_copy` の `meta` に `{ type, includeTitle, includeSummary, includeHashtag }` を追加
  - `/api/actions` の meta は `Record<string, unknown>` で受け取り済み、フロント側の送信のみ追加

- **thumbnail アイコン画像資産**
  - 主要タグ用 SVG/PNG を `public/thumbs/icons/` に追加
  - `thumbnail-tag-registry.ts` を更新して実際の画像を参照する

- **critique UI の有効化**
  - `daily-enrich` 側で critique 生成を有効化（コスト・品質確認後）
  - UI に critique 展開セクションを追加

- **`push_subscriptions.genres` カラム rename**
  - `genres` → `source_categories` に変更（Human-in-the-Loop 対象）
  - migration 037 で対応

- **tag alias 管理 UI**
  - `/admin/tags/aliases` で tag_aliases を管理できるようにする（運用頻度次第）

- **retag / republish / rebuild_rank の queue 実装**
  - `priority_processing_queue` を活用（hide_article 以外の用途）

- **通知機能**（週次人気記事通知・更新通知）

## 4.1 2026-03-22 セッションで出たアイデア

このセッション中に浮かんだ中長期的なアイデアを記録しておく。

1. **タグ候補の自動評価スコア表示**
   - 管理画面のタグレビューに「このタグを昇格した場合、過去記事で何件にタグ付けされるか」を昇格前にプレビューする機能
   - 実装: `/api/admin/tags/preview?tagKey=xxx` で ILIKE 件数を返すだけ

2. **タグ重複検出の信頼度フィードバック**
   - `daily-tag-dedup` が low confidence でスキップしたものを別タブで表示し、人間が「統合する/しない」を判断できる
   - 現状 low confidence はサイレントスキップ、管理画面では見えない

3. **記事の言語フィルタ UI**
   - Home / Search に JP / EN フィルタを追加
   - `content_language` は全 API に通し済みなので、URL パラメータと UI 追加のみ

4. **ソース停止時の記事の扱い**
   - `source_targets.is_active = false` にしたとき、既存 L4 記事をどうするか未確定
   - 現状: 公開されたまま（非表示にしない）
   - 案: is_active=false にした日以降の新規取得を止め、既存は残す（現状維持で確定してよいかも）

5. **`daily-tag-dedup` の実行結果サマリーを通知**
   - 何件統合されたかを Slack や管理画面ダッシュボードに出す
   - 現状: `/admin/jobs` で確認できるが、まとめ数字がない

---

## 5. 変更しないもの

- DB スキーマの破壊的変更（migration は必ずユーザー確認）
- `hourly-publish` の bulk upsert ロジック（本番で動作確認済み）
- `scripts/backup-neon-all.mjs`
- Vercel の cron 設定 / GitHub Actions

---

## 6. 次セッション復元用メモ

次に着手する実装順は固定する。

1. `content_language`
2. `thumbnail_url`（テンプレート合成）
3. 日本語ソース 14 件投入
4. 手動 `fetch -> enrich -> publish` 検証
5. GitHub Actions 有効化
6. その後に管理画面・ランキング調整

サムネイルで迷ったら次を守る。

1. 外部画像取得ではなく内部テンプレート合成を優先
2. タグ固定優先順位は禁止
3. title / summary の出現順を優先し、同点だけハッシュで崩す
4. 画像が作れない記事は `thumbnail_emoji` へフォールバック
## 2026-03-21 追加方針: L4 月次アーカイブ

- `public_articles` は半年以内の公開集合として維持する
- 半年超過行は月次バッチで `public_articles_history` に退避して `public_articles` から削除する
- 月次バッチは `monthly-public-archive` として実装し、初期値は `ageMonths=6`
- これにより `compute-ranks` 側は ranking 対象の SQL を大きく変えずに母集団だけを減らせる
## 2026-03-22 残タスク

### 未着手・後回し

1. `thumbnail_url` のアイコン画像資産（主要タグ SVG/PNG）を用意する
2. `compute-ranks` 係数を実アクティビティデータで点検・調整する
3. Topic Group 本実装（pgvector 前提、別フェーズ）
4. `docs/spec/04-data-model-and-sql.md` に migration 035/036 分を反映する

### 完了済み（再実装不要）

- `content_language`・`thumbnail_url`・日本語ソース seed
- cron 分離・L4 月次アーカイブ
- `public_article_sources` バグ修正
- admin Phase 3・OGP・sitemap・robots
- `daily-tag-dedup`・タグ固有名詞抽出・遡及タグ付け
