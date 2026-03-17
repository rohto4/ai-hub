# AI Trend Hub 実装計画

最終更新: 2026-03-17（snippet 整合強化、paper タグ制限、絵文字サムネイル暫定導入を反映）／2026-03-17 Phase 3 タスクを具体化（hide_article + タグレビュー UI、管理 UI セキュリティ方針を確定）

## 1. この計画の位置づけ

このファイルは、現状の実装進捗メモではなく、**これから Web 公開面を作り切るための計画兼要件定義**として使う。  
特に今回は、`docs/dim2_memo` を参考資料に留めつつ、**現行 L2 をどう L4 に載せるか**を明文化する。

前提:

1. `docs/dim2_memo` は参考資料であり SSOT ではない
2. SSOT は `docs/spec` と `docs/imp`
3. 公開面は `layer4` のみを読む
4. `source_category` と `source_type` は既に本番データに入っているため、まずは **既存軸を壊さずに L4 側で使い切る**

## 2. 2026-03-18 時点の確認済み現況

### 2.1 データ到達点

1. `articles_raw = 2863`
2. `articles_raw.is_processed = 2863`
3. `articles_enriched = 2861`
4. `articles_enriched.ai_processing_state='completed' = 2861`
5. `articles_enriched.publish_candidate = 2371`
6. `public_articles.visibility_status='published' = 911`

### 2.2 backlog 1882 件の状態

1. backlog `1882` 件は Neon へ登録済み
2. backlog 分の title 日本語化漏れ `13` 件は補正済み
3. backlog `1882` 件に限ると、**title の日本語化漏れは現在 `0`**
4. `articles_enriched.title` の非日本語行は現在 `0`

### 2.3 分類カラムの現況

`articles_enriched.source_type` は backlog import の影響で古い `news` 既定値が大量混入していたが、  
`source_targets` を正として `1866` 行を再同期し、現在の不一致は `0`。

現在の L2 分布:

1. `official = 1902`
2. `paper = 437`
3. `alerts = 328`
4. `blog = 176`
5. `news = 18`

現在の L4 公開分布:

1. `official = 736`
2. `alerts = 145`
3. `blog = 30`
4. `paper / news / video = 0`

補足:

1. `hourly-publish` は 1 件ずつ upsert しており遅い
2. 2026-03-18 の再 publish は長時間化したため途中で停止
3. 停止前に `public_articles` は `745 -> 911` まで増加
4. **L4 反映の完全化には publish job の高速化が必要**

### 2.4 抜き取り品質監査の結果

`articles_enriched` の公開候補からランダム `10` 件を確認した結果、**そのまま全面公開で安全と言い切れる状態ではない**。

確認できた主な問題:

1. `summary_100` / `summary_200` / `publication_text` が固定長で途中切れしている行がある
2. `source_snippet` 記事で title と summary の内容がずれている行がある
3. `paper` 記事で tags が本文内容と噛み合っていない行がある
4. 一部 summary が記事内容要約ではなく、メタ情報紹介に寄っている

補助観測:

1. `summary_100` 長さ `100+` 件数: `398`
2. `summary_200` 長さ `200+` 件数: `1016`
3. `publication_basis='source_snippet'` 件数: `294`
4. `summary_input_basis='source_snippet'` 件数: `415`
5. `source_type='paper'` publish candidate: `437`

## 3. 今回確定した設計原則

### 3.1 `source_category`

`source_category` は **トピック軸**として使う。

値:

1. `llm`
2. `agent`
3. `voice`
4. `policy`
5. `safety`
6. `search`
7. `news`

### 3.2 `source_type`

`source_type` は **ソース種別 / UI レーン軸**として使う。

値:

1. `official`
2. `blog`
3. `paper`
4. `news`
5. `alerts`
6. `video`（将来）

### 3.3 タグ

タグは `source_category` / `source_type` の代替ではなく、**横断的な話題・企業・製品軸**として使う。

例:

1. `openai`
2. `huggingface`
3. `rag`
4. `agent`
5. `policy`

## 4. 現 Web 実装とのズレ

### 4.1 現在の UI が混在させている軸

`src/app/page.tsx` と `src/components/sidebar/RightSidebar.tsx` のカテゴリ UI は:

1. `all`
2. `video`
3. `official`
4. `blog`
5. `agent`

となっており、`source_type` と `source_category` を同列に混ぜている。

問題:

1. `agent` だけトピック軸
2. `official / blog / video` はソース種別軸
3. `paper / news / alerts` が UI から落ちている
4. `llm / voice / policy / safety / search` の topic filter が UI に存在しない
5. `/api/search` / `/api/trends` の `genre` は実質 `source_category` であり、UI のカテゴリ概念と一致していない

### 4.2 dim2_memo との関係

`docs/dim2_memo` の `news / community / paper / overseas / oss` は、  
現在 DB に存在する `source_category` ではなく、**表示分類の草案**として解釈する。

この 5 分類を今後も使いたい場合は、L2 の列を壊して合わせるのではなく、**L4/API で派生分類を作る**。

## 5. L2 -> L4 要件定義

### 5.1 今回の結論

P0/P1 では次の 3 軸を分離して扱う。

1. topic filter: `source_category`
2. source lane: `source_type`
3. trend/entity filter: `tags`

### 5.2 L4 API の責務

`/api/home` / `/api/search` / `/api/trends` は、少なくとも次の観点を切り替えられる形へ寄せる。

1. `sourceType`
2. `topic`
3. `tag`
4. `period`
5. `sort`

初期方針:

1. Home のメインレーンは `source_type` ベース
2. 右サイドバーや上部 chips は `source_category` / tag ベース
3. dim2 的な「国内トピック / エンジニア界隈 / 論文 / 海外メディア / OSS」は後段で `display_category` として派生定義する

### 5.3 `display_category` の扱い

現時点では DB カラム追加を確定しない。  
まずは **API / view / SQL 派生列**で扱う前提にする。

理由:

1. `oss` は現行 source seed に存在しない
2. `community` と `blog` は完全一致しない
3. `overseas` はソース所在・言語・媒体種別が混ざる
4. L2 の `source_category` を流用すると topic 軸が壊れる

## 6. 実装フェーズ

### Phase 0: データ整合と公開基盤安定化

目的:

1. L2/L4 の分類整合を確実にする
2. L4 への再公開を安全に回せるようにする

タスク:

1. `docs/imp/sql/2026-03-18-l2-l4-data-realign.sql` を基準に分類是正を維持する
2. `hourly-publish` を bulk upsert 化して `2371` publish candidate を完走できるようにする
3. publish 後に `compute-ranks` を再実行し、`public_rankings` を更新する
4. 残 `211` 件の旧 title 日本語化漏れを別バッチで整理する
5. summary の途中切れを禁止する整形ルールへ直す
6. `source_snippet` 記事の title-summary 内容ずれ検知を追加する
7. `source_type='paper'` は `paper` タグのみ付与する
8. `thumbnail_url` が空の間は `thumbnail_emoji` でカード先頭を補う

### Phase 1: Home を設計に近づける

目的:

1. 現在の「導線図だけ」の状態から、実データで意味のある Home へ進める

タスク:

1. Home の primary tabs を `source_type` ベースへ整理する
2. `agent` 単独タブは廃止し、topic chips へ移す
3. `paper` / `alerts` / `news` の表示導線を追加する
4. `source_type` ごとのカード / リスト差分を `ArticleCard` 周辺で吸収する
5. `/api/home` を「ランキング」「最新」「source_type 別レーン」「tag / topic chips」を返せる形へ拡張する
6. Home は定量フィルタで間引かず、できるだけ全体をまんべんなく出す
7. ただし `daily-enrich` 側で明白な snippet 整合崩れだけは publish 前に止める

2026-03-18 実装反映:

1. Home の右サイドバーを `official / alerts / blog / paper / news` の source lane 基準へ更新
2. `agent` 単独タブは廃止し、Home 上部の topic chips 側へ寄せた
3. `paper / alerts / news` の表示導線を Home / category / mock4 に追加
4. `ArticleCard` を絵文字サムネイル前提で整備し、source lane 表示を統一
5. Home は ranking / latest / unique の切り替えと topic/source の組み合わせで全体を広く見せる形へ整理
6. `/api/home` の source_type 別 lane 返却までは未完。現時点は 1 本の公開記事列を UI 側で lane/topic 表示に分解している

### Phase 2: 公開ページ群の実装

対象:

1. `/articles/:public_key`
2. `/category/:slug`
3. `/tags/:slug`
4. `/ranking`
5. `/search`
6. `/tags`
7. `/about`
8. `/feed`

最低要件:

1. すべて `layer4` だけを読む
2. URL は `public_key` / slug を使う
3. article detail は `public_articles + public_article_tags + public_article_sources` で完結する

2026-03-18 実装反映:

1. `/ranking`
2. `/search`
3. `/articles/:public_key`
4. `/category/:slug`
5. `/tags`
6. `/tags/:tagKey`
7. `/about`
8. `/feed`
9. `/mock4`

補足:

1. 公開ページ群はすべて Layer4 読み取りで構成した
2. article detail は `getPublicArticleDetail()` 経由で `public_articles + public_article_tags + public_article_sources` を読む
3. 一覧 query でも `public_key` を返すようにし、公開リンクは `/articles/:public_key` へ寄せた
4. `mock4` は `l3-l4-screen-flow.md` の Home / Ranking / Search / Detail / Category / Tag / About / Feed / PWA / Share / Topic Group を順に触れる確認用モック

### Phase 3: L3 運用面の最小完成

完了条件: `hide_article` + タグレビュー UI が動作すること

#### 3.1 前提タスク（他のタスクに先行する）

1. `activity_logs.action_type` の正式マッピングを確定する
   - 暫定実装済みの対応: `view → impression_count` / `expand_200・topic_group_open・digest_click → open_count` / `article_open → source_open_count` / `share_* → share_count` / `save → save_count`
   - 未確定の扱いを決める: `share_open` / `return_focus` の集計対象可否、`unsave` の減算可否（`implementation-wait.md` 8.1 参照）
   - 確定後に `compute-ranks` の係数調整を実施する

#### 3.2 管理 UI 基盤

1. 管理ルートのパスプレフィックスを env var（`ADMIN_PATH_PREFIX`）で定義する
   - `/admin` のような推測可能なパスは使わない
   - `src/app/[ADMIN_PATH_PREFIX]/` 相当のルートに管理画面を配置する
2. 既存の `ADMIN_SECRET` トークン認証（`src/lib/auth/admin.ts`）をそのまま流用する
3. 推測不能パス + トークン認証の二重防御を管理 API すべてに適用する

#### 3.3 `priority_processing_queue` 最小実装

対象: `hide_article` のみ

1. `hide_article` キューを処理するロジックを実装する
2. 処理タイミング: `hourly-publish` の先頭で queue を消化してから publish に進む
3. 操作を `admin_operation_logs` に記録する
4. `retag` / `republish` / `rebuild_rank` は後続フェーズ

#### 3.4 タグレビュー UI

1. `tag_candidate_pool` の一覧を管理画面に表示する
   - 表示項目: `candidate_key` / `seen_count` / `review_status` / `latest_trends_score`
   - 操作: 昇格（`tags_master` へ追加）/ 却下
2. 昇格時に `tag_keywords` へのキーワード追加も合わせて行えるようにする
3. 操作を `admin_operation_logs` に記録する

#### 3.5 Phase 3 完了後に回すもの

1. `retag` / `republish` / `rebuild_rank` の queue 実装
2. `compute-ranks` 係数の本格調整（3.1 の action_type 確定後に実施）
3. Topic Group の最終 URL 設計

## 7. 分類検証の結論

### 7.1 問題がない点

1. `source_category` は現行設計どおり topic 軸として一貫している
2. `tags_master` / `tag_keywords` の構造は topic/entity 横断軸として成立している
3. `source_targets` 側の `source_type` seed は現行 Web 設計の土台として使える

### 7.2 修正が必要だった点

1. `articles_enriched.source_type` の大量ドリフト
2. Home UI のカテゴリ定義がデータ軸と噛み合っていない
3. `paper / news / alerts` が UI から落ちている
4. 公開候補の一部で summary / tags の品質が掲載水準に達していない
5. `thumbnail_url` が全空のため、視覚導線の補助が必要だった

### 7.3 ここでまだやらないこと

1. dim2_memo の 5 分類へ L2 カラムを合わせるための破壊的変更
2. `source_category` の語彙を `community / overseas / oss` へ戻すこと
3. `tags_master` を source 分類の代替にすること

## 8. 今回の成果物

1. backlog `1882` 件 import 完了
2. `articles_enriched.title` の非日本語行 `211 -> 0`
3. `source_type` 再同期 SQL:
   - `docs/imp/sql/2026-03-18-l2-l4-data-realign.sql`
4. L2/L4 分類整合の検証結果を本計画へ反映
5. ランダム `10` 件の抜き取り品質監査を実施
6. `source_snippet` 向け prompt 制約と整合チェックを追加
7. `paper` タグを新設し、論文ソースは `paper` のみ付与へ変更
8. `public_articles.thumbnail_emoji` を追加し、既存 `911` 件も backfill
9. 判断待ちは `implementation-wait.md` へ分離
10. L4 公開ページ群と `mock4` の動作確認用導線を実装

## 9. 次に読むファイル

1. `docs/guide/codex/AGENTS.md`
2. `agents-task-status.md`
3. `docs/imp/implementation-wait.md`
4. `docs/imp/imp-status.md`
5. `docs/imp/imp-hangover.md`
6. `docs/imp/l3-l4-screen-flow.md`
7. `docs/spec/04-data-model-and-sql.md`
