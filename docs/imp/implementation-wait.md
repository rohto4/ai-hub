# AI Trend Hub 実装判断待ち

最終更新: 2026-04-05

ここには「まだ確定していないが、実装を止めずに後で判断したい論点」だけを残す。確定済みの内容や履歴はここに残さない。

## 1. 判断待ち一覧

### 1.1 `hourly-compute-ranks` 係数調整

現状:
- activity weight は `impression=0.5`, `open=1.0`, `share=1.0`, `save=1.0`, `sourceOpen=2.0`
- 時間減衰は 1 週間でスコアが 1/5
- 実データがまだ少なく、妥当性評価ができない

判断時に見ること:
- 上位が「新鮮な記事」寄りか「高エンゲージメント記事」寄りか
- 時間減衰が急すぎるか
- `sourceOpen` を最大ウェイトにする妥当性

### 1.2 tag alias 管理 UI の要否

現状:
- `tag_aliases` は機能している
- 管理 UI はなく、追加は SQL 操作前提
- `daily-tag-dedup` で keyword 寄せは自動化済み

判断:
- 運用頻度が高いなら `/admin/tags/aliases` を作る
- 低いなら SQL 運用のままにする

### 1.5 `critique` UI の有効化タイミング

現状:
- `public_articles.critique` はあるが UI では未使用

判断:
- critique 生成のコストと品質を見て有効化時期を決める

### 1.7 `arxiv-ai` の流入監視と再判断

現状:
- `arxiv-ai` は raw へは通常取り込み
- 5 か月超 raw は enrich 対象外
- L4 は 2 か月保持上限
- throughput 増加後も backlog と露出を監視中

継続監視:
- `articles_raw` の未処理件数
- 24h の fetch 件数
- 24h の enrich 処理件数 / 成功件数
- Home / ranking / search での露出量

再判断条件:
- backlog が縮小しない
- Gemini API コストや待ち行列が不安定
- 公開面で露出が強すぎる

### 1.9 `paper` 専用タグ群の要否

現状:
- `paper` / `arxiv-ai` は既存主タグへ落ちにくい記事が多い
- 論文導線では一般研究語が有効な可能性がある

判断:
- `paper` 専用の別タグ領域を確保する方針は先に固定する
- 実際の洗い替え・backfill・公開面への反映は後続タスクで扱う

### 1.11 周辺分野タグの将来導線

現状:
- いまは `thumbnail_bg_theme` と文脈補助が主用途
- 主タグと周辺分野タグは公開 UI で見せ方を分ける前提
- 当面は 2 段表示に分けるが、クリック先のふるまいは両者とも `/tags/:tagKey` で揃える
- 専用 UI や将来の視覚マッピングページまでは未確定

判断:
- 現在の 2 段表示 + 同一挙動で十分か
- その後に専用一覧・視覚マッピング・関係探索 UI が必要かを判断する

### 1.12 `flowchart.md` のタグ専用節でユーザーが確定したいこと

現状:
- タグ関連テーブルと自動反映は実装済み要素が多く、口頭や断片的 docs では再把握しにくい
- 新しい設計書は増やさず、`docs/imp/flowchart.md` にタグ専用節を追加する方針
- この節は実装前提の SSOT ではなく、必要時に構成を素早く読み直すための私用フローとして扱う

判断時に決めること:
- 主タグ系と周辺分野タグ系を 1 図にまとめるか、同一節内で図を分けるか
- `tag_candidate_pool` / `daily-tag-dedup` / promote を詳細に出すか、要点だけに縮約するか
- `import-ai-enrich-outputs.ts` など本線外の経路差分を図中に出すか、注記だけに留めるか
- `paper` 専用タグ群や将来のタグ再編案を「将来論点」として薄く置くか、現行図からは外すか
## 2026-04-05 タグ意味論の残課題

- `tag_aliases` は、親子関係ではなく表記揺れの正規化専用として確定した。
- 親子タグの自動展開は `tag_relations` で実装済みだが、relation 自体の管理運用は未整備。
- L2 で tag set を確定し、L4 は表示用転写だけに留める方針は確定した。
- 新しい定時 batch は追加せず、relation 更新時の既存データ反映は `retag-layer2-layer4` を使う前提で運用する。
- 目標挙動:
  - `ClaudeCode` / `Claude Code` のような完全な同義表記は alias 正規化で 1 つの canonical tag に寄せる
  - `claude` と `cowork` のように意味を持って併存するものは別 canonical tag のまま残す
  - `cowork` が `claude` の子として定義されている場合は、enrich / retag の L2 確定時点で両方のタグを付与し、publish はその結果を転写する
- `/admin/tags/aliases` は任意だが、親子タグを導入したので relation 管理経路は別途必要。

## 2026-04-05 ユーザー判断の反映

- `push_subscriptions.genres` は意味が正しい名前へ倒して改修する方針で確定。実施時は migration とアプリ側修正を同一タスクで行う。
- Topic Group という英語名は UI では廃止し、日本語名称へ置き換える方針で確定。実装は後回し。
- `ADMIN_PATH_PREFIX` は env ベースの推測困難な prefix に切り替える方針で確定し、実装済み。
- `arxiv-ai` は一旦改善済み。タグ構成変更後に Actions を回していないため、必要なら retag / publish / ranks の洗い替えを再実行して再評価する。
- 1 周目 retag 後のカテゴリ / 属性設計論点は古い可能性が高く、現行 wait の主論点からは外す。
- タグ関連テーブルの再編は改善済み前提で、現時点の主要 wait から外す。
- 周辺分野タグは主タグと別段表示にするが、挙動は当面同じ `/tags/:tagKey` に揃える方針で確定。
