# AI Trend Hub 実装計画

最終更新: 2026-04-05

## 1. 現在のフェーズ

主要機能の実装フェーズはほぼ完了。現在は、タグ再構築 1 周目の結果を踏まえて公開面導線を整え、運用を安定化するフェーズとする。次の 1 回の改善で backend 側をいったん確定させ、その後は公開面の見た目調整を主軸に移る。

実装済み:
- Layer 1 → Layer 2 → Layer 4 パイプライン
- `content_language`
- 日本語ソース 14 件
- `thumbnail_url`
- admin Phase 3
- `daily-tag-dedup`
- OGP / sitemap / robots
- `monthly-public-archive`
- 隣接分野タグ基盤と `thumbnail_bg_theme`
- L2/L4 タグ洗い替えスクリプト
- 定時 batch schedule 復旧

## 2. いま優先すること

1. `docs/spec/11-batch-job-design.md` と `implementation-plan.md` を現行 batch 実装に合わせ、backend の現況を再読可能にする
2. 主タグ・周辺分野タグ・カテゴリのデータ設計を現行コード基準で最新化する
3. publish 系で未反映のまま残っている主タグ / 周辺分野タグ / カテゴリ反映を完了させる
4. カテゴリを公開面サイドバー導線として実装し、主タグ導線と役割が衝突しないよう整理する
5. 周辺分野タグを当面通常タグと同様にクリック可能な導線として実装する
6. 実装した Web を見ながらカテゴリ配置とタグ導線を評価する
7. タグ参照 SQL を使って、新規立項タグ候補の次ラウンド判断を進める
8. enrich 本線と CLI import 線の副作用差を減らす
9. enrich backlog の解消手順を `docs/imp/enrich-queue-taskboard.md` で管理し、通常 enrich と CLI 追いつき線の使い分けを詰める

## 2.1 このセッションの実行計画

1. 現行コードと docs を突き合わせ、主タグ / 周辺分野タグ / カテゴリの保存先・参照先・publish 経路の差分を洗い出す
2. 差分を踏まえて、破壊的変更なしで進められるデータ設計更新を先に反映する
3. `hourly-publish` と関連 join / query / UI で未反映箇所を埋め、L2 → L4 → 公開面の整合を取る
4. 必要な backfill / retag / publish 再実行手順を `batch-ops.md` と `batch-sequence.md` 基準で実施する
5. 公開面でカテゴリ導線とタグ導線を確認し、残件があれば `implementation-wait.md` へ切り出す

今回の主眼:
- backend の主タグ / 親タグ / 子タグ / 周辺分野タグの処理境界を、このセッションで読み直せる形まで固める
- publish 前後に残っている wait をできるだけ解消し、定時 Actions の運用を「通常実行で回る」状態へ寄せる
- 公開面の見せ方に注力する前に、backend・batch・docs 側で先に潰せる残件を優先して処理する

このセッションで特に確認する軸:
- `tags_master` / `adjacent_tags_master` / `SITE_CATEGORIES` の役割境界
- `articles_enriched*` から `public_articles*` への反映漏れ
- publish 後のタグ一覧・カテゴリ一覧・記事詳細での表示整合
- batch 本線と CLI 追いつき線の副作用差が今回の反映対象に残っていないか
- `paper / llm` に偏る未主タグ残件の圧縮経路
- `content_score` をランキング以外の公開露出へどう反映するか

## 3. 現在の固定方針

### 3.1 公開面の軸

1. topic filter: `source_category`
2. source lane: `source_type`
3. trend/entity filter: tags

### 3.2 収集・保持

- `alphaXiv` は source にしない
- `arXiv` を収集 source とし、公開時だけ `alphaXiv` に置換する
- `arxiv-ai` は 5 か月超 raw を enrich 対象外とし、L4 は 2 か月保持上限とする
- ToS / 商用利用可否は `commercial_use_policy` で管理する

### 3.3 サムネイル

- `thumbnail_url` は内部テンプレート方式
- `thumbnail_bg_theme` は隣接分野タグから決定する
- icon 未整備時は `thumbnail_emoji` をフォールバックに使う

### 3.4 タグ再構築 1 周目

- 1 周目は最終カテゴリ確定ではなく、属性としての全件再構築と新規立項タグ候補抽出を目的にする
- 主タグは最大 5 件、平均 4 件超を目標にする
- 隣接分野タグは公開導線用として数百件規模の付与を目指す
- 2 周目着手前にカテゴリ / 主タグ / 周辺分野タグの境界を確定する

主タグの完全除外:
- `llm`
- `generative-ai`
- `rag`
- `agent`
- `huggingface`
- `hugging face`
- `paper`
- `policy`
- `safety`

カテゴリからも不要:
- `llm`
- `agent`
- `voice`

観察中のカテゴリ候補:
- `paper`
- `official`
- `news`
- `search-rag`
- `oss`
- `enterprise-ai`

### 3.5 導線の当面の扱い

- 主タグ: trend / entity の主導線
- 新規立項タグ候補: 公開導線ではなく運用判断用
- カテゴリ: 公開面サイドバーの大枠導線
- 周辺分野タグ: 当面は通常タグと同じクリック導線
- `paper` 専用タグマスタは後続タスクとして保留

### 3.6 今回セッションで固定する実装順

1. データ設計更新
   - 主タグ / 周辺分野タグ / カテゴリの現在地をコード基準で確認
   - publish が依存する selector / mapper / query の責務を揃える
2. publish 反映完了
   - L2 → L4 の upsert 対象
   - `public_article_tags` / `public_article_adjacent_tags` / カテゴリ導線用データ
   - 公開面の一覧 / 詳細 / サイドバー参照
3. backfill / 検証
   - 必要に応じて retag, publish, ranks を再実行
   - UI spot check と docs 追随

### 3.7 enrich / batch 運用

- `hourly-enrich` は毎時 `:05 / :10 / :15 / :20 / :25 / :30 / :35 / :40`
- `enrich-worker` の基本設定は `limit=20`, `summaryBatchSize=20`, `maxSummaryBatches=1`
- `hourly-publish` は毎時 `:50`
- `monthly-public-archive` は毎月 1 日 `03:00 UTC`
- 詳細仕様は `docs/imp/batch-reforme-spec.md`、運用手順は `docs/imp/batch-ops.md` を参照する

## 4. 次の改善候補

1. `import-ai-enrich-outputs.ts` を通常 enrich と同じ副作用へ揃える
2. `hourly-fetch` の source 単位 backoff 制御を導入する
3. `cron-health-check` の要否を判断する
4. `weekly-archive` の要否を判断する

## 4.1 `flowchart.md` にタグ専用フロー節を追加する道筋

目的:
- タグ関連テーブル、候補蓄積、昇格、retag、publish、自動反映の全体像を `docs/imp/flowchart.md` の 1 節で再読できるようにする
- 新しい設計書は増やさず、必要時にこの節を参照すれば現在の構成が追える状態を作る

進め方:
1. 対象範囲を固定する
   - 主タグ系: `tags_master` / `tag_keywords` / `tag_aliases` / `tag_candidate_pool`
   - 周辺分野タグ系: `adjacent_tags_master` / `adjacent_tag_keywords`
   - 自動反映: enrich / `daily-tag-dedup` / retag / publish
2. まず現行コード基準で「本線 enrich」と「CLI import 線」の副作用差を洗い出す
3. `flowchart.md` にタグ専用の章を追加し、少なくとも以下を分けて図示する
   - 辞書テーブル
   - 候補蓄積と review / promote
   - L2 付与
   - L4 同期
   - 例外経路と未一致経路
4. 図を見ながら、公開導線で重要な区別だけを残して粒度を調整する
5. 今後の作業でタグ周りを触る前提資料として使い、差分が出たら同じターンで更新する

この作業で確認したいこと:
1. 主タグと周辺分野タグをどこまで別章で分けるか
2. `tag_candidate_pool` と `daily-tag-dedup` を運用フローとしてどこまで図に出すか
3. `paper` 系の将来分岐を「将来ノード」として先置きするか、現行図からは外すか

完了条件:
1. `docs/imp/flowchart.md` にタグ専用節が追加されている
2. 実装済みの主タグ / 周辺分野タグ / 自動反映の関係を、図だけで追える
3. 本線 enrich と CLI import 線の差が、少なくとも注記で読める
4. 必要なユーザー判断は `implementation-wait.md` に分離されている

## 5. 後回しでよいもの

1. Topic Group
2. `critique` UI
3. `push_subscriptions.genres` rename
5. tag alias 管理 UI
6. `paper` 専用タグマスタと切替ロジック
7. 周辺分野タグの視覚マッピングページ
8. タグ関連テーブルの再編
9. パーソナライズ設定 UI

## 6. 非対象

- DB スキーマの破壊的変更
- 新規依存追加
- `scripts/backup-neon-all.mjs`
- `vercel.json`
- GitHub Actions の大きな運用方針変更
## 2026-04-05 タグ意味論の整理

- `tag_aliases` は、完全に同一意味の表記揺れを canonical tag に正規化する用途に限定する。
- alias の例: `ClaudeCode` -> `claude-code`、`Claude Code` -> `claude-code`
- alias を、親子タグの表現や UI 上の重複抑止ルールとして使ってはいけない。
- 親子タグは alias とは別概念とし、子の canonical tag が一致した場合は子と親の両方を付与する。
- 例: `cowork` は独立した canonical tag のまま残し、`claude` の子として定義されていれば、記事には `cowork` と `claude` の両方が付く。
- 現行 schema には親子タグ relation がないため、タグ個別の IF ではなく専用の relation table を追加する前提で扱う。
- ある canonical tag が存在するとき別の canonical tag を UI で隠すような回避策は採らない。公開面の表示はデータ設計に従わせる。

## 2026-04-05 backend 確定の見立て

- 定時 batch の種類、schedule、入口 route、CLI は現行実装でほぼ固定できている。
- enrich / publish / ranks / archive の主経路は確定済みで、backend 側の残論点は relation 管理運用と CLI import 線の副作用差に絞られている。
- 親子タグ relation は `tag_relations` を使って L2 保存前に展開する方針で実装済み。
- relation 展開は L2 の責務として扱い、`hourly-enrich` と `retag-layer2-layer4` の中で完結させる。
- 新しい定時 batch は増やさない。relation 追加や変更時の既存データ反映は、既存の `retag-layer2-layer4` を正式な backfill 手段として使う。
- `hourly-publish` は L2 で確定した tag join を L4 に転写するだけとし、親子タグの判断や補完は持たせない。
- 次に backend で詰めるのは、relation をどの画面 / SQL / 運用手順で管理するかと、CLI import 線の完全追随である。
- この2点が固まれば、backend は一度固定し、以後は公開面の導線・見た目調整を主軸に進める。
