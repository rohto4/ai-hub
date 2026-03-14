# AI Trend Hub 実装ハングオーバー

最終更新: 2026-03-15

## 1. このファイルの役割

セッションが切れても、次に戻った人が `Layer1 -> Layer2` の実装と運用をすぐ再開できるようにするための再開ガイド。

今は「広く本文取得する」段階ではない。  
まず `source policy` と `domain review` を前提に、安全に `full_content` を増やす段階である。

## 2. 現在の正しい前提

- 主対象は `Layer1 -> Layer2` の品質改善と毎時運用
- `Layer3 / Layer4` はまだ保留
- スケジューラは GitHub Actions
- enrich の実装名は `daily-enrich` だが、運用上は毎時 enrich として扱う
- 毎時実行は `fetch -> enrich` を直列にする
- enrich は小分け batch で回す
- 本文未取得でも `snippet` ベースで Layer2 に仮蓄積する
- blocked domain は障害ではなく `domain_snippet_only / snippet-only` として扱う
- tag candidate は高閾値の保守運用

## 3. いま壊してはいけない設計判断

### 3.1 Source policy first

`source_targets.content_access_policy` を先に見る。

- `feed_only`
- `fulltext_allowed`
- `blocked_snippet_only`

原則:

- Google Alerts 系 source は `feed_only`
- 公式 source / 公式 blog / 明示的に本文取得を許容してよい source だけ `fulltext_allowed`
- 既知 blocked source は `blocked_snippet_only`

### 3.2 Domain review first

`observed_article_domains.fetch_policy` を見て、未確認ドメインには本文取得しない。

- `needs_review`
- `fulltext_allowed`
- `snippet_only`
- `blocked`

原則:

- `needs_review` は保留状態であり、恒久停止ではない
- `fulltext_allowed` に昇格した domain だけ本文取得へ進める
- `snippet_only` / `blocked` は snippet 仮蓄積に落とす

### 3.3 Summary basis を残す

Layer2 には要約の根拠を残す。

- `full_content`
- `feed_snippet`
- `blocked_snippet`
- `fallback_snippet`

この区別を消さないこと。  
後で本実装へ移行するときに、「何を根拠に要約したか」が追えなくなる。

## 4. 現在の DB / 実装状態

### 4.1 Source 状態

- active source: `11`
- `feed_only = 9`
- `fulltext_allowed = 2`
- `blocked_snippet_only` は source 単位では必要時のみ設定

現在の `fulltext_allowed` source:

- `anthropic-news`
- `google-ai-blog`

`ai-news-roundup` は placeholder source だったため `is_active=false` にしてある。

### 4.2 Layer2 状態

直近確認値:

- `articles_raw = 162`
- `articles_enriched = 162`
- `raw_unprocessed = 0`
- `enriched_ready_total = 2`
- `enriched_provisional_total = 160`
- `content_path full = 2`
- `content_path snippet = 160`

いま `ready` が少ないのは不具合ではなく、source policy を安全側に倒した結果である。  
`ready` を無理に増やすのではなく、「許可済み source / domain からだけ `full_content` を増やす」方針で進める。

### 4.3 Summary basis 状態

直近確認値:

- `full_content = 2`
- `feed_snippet = 160`

意味:

- `feed_snippet` は監視・仮蓄積としては使える
- ただし公開候補母集団は `full_content` 中心で考える

### 4.4 Domain inventory 状態

`observed_article_domains` を導入済み。  
取得済み記事の行き先ドメインを DB に保持し、domain ごとに review できる。

直近確認値:

- observed domains: `138`

既知 blocked / snippet-only として初期投入済み:

- `axios.com`
- `bloomberg.com`
- `youtube.com`
- `cdt.org`

明示的に `fulltext_allowed` にした domain:

- `anthropic.com`
- `blog.google`
- `research.google`

## 5. 主要テーブルと意味

### 5.1 `source_targets`

- source 定義
- `content_access_policy` を持つ

### 5.2 `articles_raw`

- Layer1 の取り込み結果
- raw 再処理対象

### 5.3 `articles_enriched`

- Layer2 の enrich 結果
- `is_provisional`
- `provisional_reason`
- `summary_basis`

### 5.4 `observed_article_domains`

- 記事 URL の行き先ドメイン inventory
- `fetch_policy`
- `summary_policy`
- `observed_article_count`
- `latest_article_url`

## 6. いまの enrich 判定ルール

大筋は次の順。

1. `source_targets.content_access_policy` を確認
2. `observed_article_domains.fetch_policy` を確認
3. どちらも本文取得可能な場合だけ本文 fetch を試みる
4. それ以外は `snippet` 仮蓄積に落とす

現在の実装上の振る舞い:

- source が `feed_only` のとき
  - 本文 fetch しない
  - `provisional_reason = feed_only_policy`
  - `summary_basis = feed_snippet`
- source が `fulltext_allowed` でも domain が `needs_review` のとき
  - 本文 fetch しない
  - `provisional_reason = domain_needs_review`
- domain が `snippet_only` または `blocked` のとき
  - 本文 fetch しない
  - `provisional_reason = domain_snippet_only`

## 7. 再開時にまず打つコマンド

```bash
npm run type-check
npm run db:check-layer12
npm run db:check-source-policies
npm run db:check-domain-policies -- --needs-review
```

見るポイント:

- `ready / provisional` の比率
- `summary_basis`
- `provisional_reason`
- 未判定 domain の上位
- source policy の崩れがないか

## 8. domain review の標準フロー

未確認 domain を review して本文取得へ進める標準手順はこれ。

1. `npm run db:check-domain-policies -- --needs-review`
2. サンプル URL と source を確認
3. domain policy を決める
4. policy 更新と provisional 再キューを行う
5. 次の enrich で `full_content` 化を確認する

コマンド:

```bash
npm run db:promote-domain-policy -- <domain> fulltext_allowed summarize_full
```

あるいは個別更新:

```bash
npm run db:set-domain-policy -- <domain> fulltext_allowed summarize_full
npm run db:requeue-raw -- --domain <domain> --provisional-only
```

重要:

- `needs_review` は止めるための状態ではなく、unlock 前の保留状態
- `fulltext_allowed` にした domain は通常どおり本文取得へ進む

## 9. source review の標準フロー

source 単位で本文取得を許可するときの標準手順。

```bash
npm run db:check-source-policies
npm run db:set-source-policy -- <source-key> fulltext_allowed --requeue
```

ただし、Google Alerts を広く `fulltext_allowed` に戻さないこと。  
Alerts は discovery 用、公開候補生成は公式 source 中心、という役割分離を維持する。

## 10. いま使う主要コマンド

```bash
npm run db:check-layer12
npm run db:check-source-policies
npm run db:set-source-policy -- <source-key> <policy> --requeue
npm run db:sync-observed-domains
npm run db:check-domain-policies
npm run db:check-domain-policies -- --needs-review
npm run db:set-domain-policy -- <domain> <policy> <summary-policy>
npm run db:promote-domain-policy -- <domain> <policy> <summary-policy>
npm run db:requeue-raw -- --domain <domain> --provisional-only
```

補助:

```bash
npm run db:check-snippet-domains
npm run db:promote-tag-candidates
npm run db:repair-stale-job-runs
```

## 11. 次に潰すべき実務

優先順はこれ。

1. `needs_review` 上位 domain の review
2. 公式 source / 公式 domain の追加
3. `full_content` を増やした上で publish 候補母集団を育てる
4. tag candidate の prune / promote を保守運用で続ける

現時点で review 候補になりやすい domain 例:

- `theverge.com`
- `cnbc.com`
- `theguardian.com`
- `wired.com`
- `techbuzz.ai`

## 12. まだ残るリスク

- `ready` はまだ少ない
- source を増やさない限り公開候補母集団は伸びにくい
- `feed_snippet` は監視用途には有効だが、そのまま公開要約にするには質のムラがある
- tag candidate はまだ運用判断が残る

## 13. 直近コミット

- `9517d6c` hourly orchestration と provisional state
- `eac7d3c` layer2 再処理と tag hygiene
- `b50a9b1` blocked domain 分類と `nvidia` 昇格
- `83acf19` source content access policy
- `82e6bda` source policy ops scripts
- `516ec0d` summary basis
- `1dae083` observed article domains
- `23979fd` domain review enforcement
- `9e8258f` domain review promotion flow

## 14. 次に必ず読むファイル

1. `docs/guide` 配下
2. `docs/imp/implementation-plan.md`
3. `docs/imp/imp-status.md`
4. `docs/imp/implementation-wait.md`
5. `docs/memo/20260312_dataflow.md`
6. `docs/spec/11-batch-job-design.md`

必要に応じて:

1. `docs/spec/04-data-model-and-sql.md`
2. `docs/spec/05-ingestion-and-ai-pipeline.md`
3. `src/lib/jobs/daily-enrich.ts`
4. `src/lib/extractors/content.ts`
5. `src/lib/db/enrichment.ts`
6. `scripts/check-layer12.mjs`
7. `scripts/check-domain-policies.mjs`
8. `scripts/promote-domain-policy.mjs`
