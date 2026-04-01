# AI Trend Hub 実装計画

最終更新: 2026-03-28

## 1. 現在のフェーズ

主要機能の実装フェーズはほぼ完了。残りは運用調整と後続機能。
直近は「タグ再構築 1周目」を踏まえて、公開面の導線を図で詰め切るのではなく、先に Web 実装して評価するフェーズとする。

### 実装済み

- Layer 1 → 2 → 4 パイプライン
- `content_language`
- 日本語ソース 14 件
- `thumbnail_url`
- admin Phase 3
- `daily-tag-dedup`
- OGP / sitemap / robots
- `monthly-public-archive`
- 隣接分野タグ基盤（schema / enrich / publish / UI 反映）
- `thumbnail_bg_theme` 伝搬（L2→L4）
- L2/L4 タグ洗い替えスクリプト（`db:retag-layer2-layer4`）

### 未完了

1. `hourly-compute-ranks` 係数調整
2. Topic Group 本実装
3. 必要なら言語フィルタ UI
4. 必要なら tag alias 管理 UI
5. 隣接分野タグの運用監査（6.7）
6. 1周目後の新規立項タグ候補レビュー
7. 2周目着手前のカテゴリ / 属性設計確定
8. 公開面のタグ / カテゴリ / 周辺分野タグ導線の本実装
9. live run で本文ベース `matchedTagKeys` / `canonicalTagHints` の実挙動確認

## 2. いま優先すること

1. 主タグ・新規立項タグ・カテゴリ・周辺分野タグの役割分担を整理する
2. カテゴリを公開面サイドバー導線として使う前提で、先に Web 実装へ落とし込む
3. 周辺分野タグは当面、主タグと同様に通常クリックできるタグとして実装する
4. 実装した Web 導線を見ながら、カテゴリ配置とタグ導線を評価する
5. 人間が TBL を直接確認できる参照 SQL を使って、新規立項タグ候補の次ラウンド判断を進める
6. live run で `tag_aliases` / `tag_keywords` / `tag_candidate_pool` の自動反映を検証する

## 3. 現在の固定方針

### 3.1 公開面の軸

1. topic filter: `source_category`
2. source lane: `source_type`
3. trend/entity filter: tags

### 3.2 サムネイル

- `thumbnail_url` は内部テンプレート方式
- icon が弱い/未登録なら `thumbnail_emoji` fallback
- 後からの見た目変更は `db:backfill-thumbnail-urls` で再同期する

### 3.3 収集方針

- `alphaXiv` は source にしない
- `arXiv` 収集、公開時だけ `alphaXiv` へ置換
- ToS / 商用利用可否は `commercial_use_policy` で管理

### 3.4 タグ再構築 1周目の目的

- 1周目は「最終カテゴリ確定」ではなく「属性としての全件再構築」と「新規立項タグ候補の抽出」を目的にする
- 主タグは最大5件、平均4件超を目標にする
- 隣接分野タグは公開導線用のため、公開時点で最低でも数百件規模の付与を目指す
- 1周目終了時点ではカテゴリ設計を確定しない。2周目着手前にカテゴリ / 主タグ / 隣接タグの境界を確定する

### 3.5 主タグの完全除外リスト（1周目）

- `llm`
- `generative-ai`
- `rag`
- `agent`
- `huggingface`
- `hugging face`
- `paper`
- `policy`
- `safety`

### 3.6 本文ベースのタグ寄せ自動化

- `summaryInputBasis=full_content` の記事では、enrich の同一 AI バッチ応答で `matchedTagKeys` に加えて `canonicalTagHints` を返させる
- `canonicalTagHints` は既存タグへ寄せられる候補のみを対象にし、`relation=alias | keyword` と `confidence` を持つ
- 保存時は `confidence=high` のみ自動反映し、`alias` は `tag_aliases`、`keyword` は `tag_keywords` へ upsert する
- `source_snippet` / `title_only` では `canonicalTagHints` を使わず、従来どおり保守的に扱う
- live run では `summaryBatchSize=20` の実行と OpenAI fallback による本文ベースタグ保存までは確認済み
- `canonicalTagHints` は prompt 調整後に `keyword` として発火し始めた
- 719 / 720 の原因分析は完了済みで、当面はこの論点を掘り下げずに先へ進める
- 特に `paper` / `arxiv-ai` では、通常記事とは別の研究系タグ群を用意する案があるが、専用タグマスタ導入は一旦後回しにする

### 3.7 今は属性として保持するカテゴリ候補

- `paper`
- `official`
- `news`
- `search-rag`
- `oss`
- `enterprise-ai`

補足:
- `llm` / `agent` / `voice` はカテゴリからも不要とする
- `oss` / `enterprise-ai` は 1周目ではカテゴリ確定せず、属性として件数と導線価値を観察する
- 主タグは固有名詞・製品名・企業名・モデル名・OSS名を優先する

### 3.8 直近で先に確定する導線

- 主タグ: trend/entity filter の主導線として使う
- 新規立項タグ候補: 1周目集計結果から昇格候補を選ぶための運用導線として扱う
- カテゴリ: 公開面サイドバーの大枠導線として使うが、1周目では最終固定前提にしない
- 周辺分野タグ: 当面は通常タグと同じクリック導線で扱い、後で「特定タグがどの分野で活用されているか」を見る視覚マッピングページへ発展させる
- 公開面のクライアント挙動は自動更新を持たず、明示クリック時のみ状態変更・action 記録を行う
- まずはこの 4 軸の役割分担と公開導線を整え、`paper` 専用タグマスタは後段タスクへ回す
- Phase 1 正本 (`final-tag-decisions.json`) のうち、新規主タグ 13 件の昇格と broad tag の inactive 化までは DB 反映済み
- 次は、この反映結果を前提に公開面を先に実装し、実画面を見て導線を評価する

### 3.9 `arxiv-ai` の例外運用

- `arxiv-ai` は件数が大きいため通常 source と同じ保持ルールにしない
- 5 か月超の raw は enrich claim 前に処理対象から外し、Gemini API の無駄打ちを防ぐ
- L4 (`public_articles`) では `arxiv-ai` だけ 2 か月を保持上限とする
- 半年保持の一般ルールは他 source に適用し、`arxiv-ai` は公開面だけ例外扱いにする

### 3.10 定時 enrich の基本設定

- `hourly-enrich` は毎時 `:05 / :10 / :15 / :20 / :25 / :30 / :35 / :40` の 8 回実行にする
- 各回の `enrich-worker` は `limit=20`, `summaryBatchSize=20`, `maxSummaryBatches=1` を基本設定とする
- `hourly-publish` は引き続き毎時 `:50` に実行する

## 3.10 追いつきバッチ（CLI フロー）の不足実装

追いつき CLI フロー（`prepare-gemini-cli-enrich-artifacts.ts` → Gemini CLI → `import-ai-enrich-outputs.ts`）は
動作しているが、以下の 2 点が通常 `enrich-worker` と挙動が異なるため補完が必要。

### (a) `properNounTags` → `tag_candidate_pool` の未反映

- `import-ai-enrich-outputs.ts` は Gemini CLI output の `properNounTags` を読み込んでいるが、
  `tag_candidate_pool` への書き込みを行っていない
- 通常 `enrich-worker` では `candidateTags` が `tag_candidate_pool` に蓄積されるため、
  追いつき import 後はその分だけタグ候補が欠落する
- **実装内容:** `import-ai-enrich-outputs.ts` の upsert ループ内で、
  output の `properNounTags` を `tag_candidate_pool` へ upsert する処理を追加する

### (b) adjacent tags / thumbnail_bg_theme が空になる

- `import-ai-enrich-outputs.ts` は `adjacentTagIds: []`、`thumbnailBgTheme: null` 固定で upsert している
- import 直後は `articles_enriched_adjacent_tags` が空になり、L4 公開後も `thumbnail_bg_theme` が設定されない
- **実装内容（運用手順として明文化）:**
  import 完了後に `npm run db:retag-layer2-layer4` を実行することを
  追いつきバッチの完了手順に明示する（新規スクリプトは不要、既存で対応可）

---

## 4. 後回しでよいもの

1. Topic Group
2. `critique` UI
3. `ADMIN_PATH_PREFIX` 動的化
4. `push_subscriptions.genres` rename
5. tag alias 管理 UI
6. `paper` 専用タグマスタの新設と `paper` 判定時の切替ロジック
7. 周辺分野タグを使った視覚的マッピングページ
8. タグ関連テーブルの再編（分割 / 共通化 / `tag_type` 導入の要否整理）
9. パーソナライズ設定 UI の導入検討
   - 興味分野の複数選択
   - ランキング / 通知への反映方式
   - 保存方法（ブラウザ保持 / ログイン同期）の整理

## 5. 非対象

- DB スキーマの破壊的変更
- 新規依存追加
- `scripts/backup-neon-all.mjs`
- `vercel.json`
- GitHub Actions 変更

## 6. 隣接分野タグ + 背景テーマ（新規）

### 6.1 仕様設計（区分追加）
- 実装済み。既存 AI タグ系とは分離し、`adjacent_tags_master` 系テーブルで管理する
- 付与上限は `1〜2` 件（`matchAdjacentTagsFromKeywords(..., 2)`）
- 公開面での主用途は `thumbnail_bg_theme` とする

### 6.2 マスタ追加（隣接分野タグ）
- 実装済み（migration 038）
- `adjacent_tags_master` / `adjacent_tag_keywords` を追加
- 初期タグ（infra/security/robotics/media/finance/healthcare/education/legal/gaming/hardware）を投入

### 6.3 付与ロジック追加（title + summary_200）
- 実装済み
- `title + summary_200` を入力にルールベース判定
- 保存先: `articles_enriched_adjacent_tags`（L2）

### 6.4 背景テーマ出力
- 実装済み
- L2: `articles_enriched.thumbnail_bg_theme`
- L4: `public_articles.thumbnail_bg_theme`
- 判定不可時は既存テーマへ fallback

### 6.5 合成ロジック（emoji + background）
- 実装済み
- `thumbnail_url` 生成時は `thumbnail_bg_theme` を優先利用
- `thumbnail_url` 未設定時は `ArticleThumbnail` が `thumbnail_bg_theme` ベース背景で emoji を描画

### 6.6 スコア・公開優先度連携
- 実装済み（現時点）
- 隣接分野タグは加点に使わず、表示文脈・背景テーマにのみ利用
- 既存のタグ不足ノイズ減点ロジックは維持

### 6.7 検証・運用
- 実装準備済み（未実行）
- `scripts/retag-layer2-layer4.ts` で全件洗い替え可能
- 監査プロンプトを `artifacts/gemini-tag-rebuild/` に追加
- `artifacts/ai-retag-all/` に Gemini 用の input / prompt / manifest / output-template を生成済み
- `ai-retag` は全 12 part 中 `part-001` / `part-002` まで出力済み、`part-003` 以降が未実行
- 全件完走後に `db:summarize-ai-retag-outputs` → `db:generate-ai-retag-sql` の順で集計・反映SQL生成を行う
- DB 側の残件は migration 038 適用、retag 実行、L2/L4 件数整合確認、30〜50件の目視監査
- 今回セッションからは既存の `artifact/` / `artifacts/` 直下を増やさず、今回専用の `af-20260326/` 系ディレクトリへ切り出して運用する
