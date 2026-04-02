# AI Trend Hub 実装ステータス

最終更新: 2026-04-03

運用ルール:
- 先頭には必ず「現在の状態」と「次の確認事項」を置く
- 履歴は要点だけ残し、詳細時系列は `agents-task-status.md` に寄せる
- 未判断事項は `implementation-wait.md` を正にする

## 1. 現在の状態

- Layer 1 → Layer 2 → Layer 4 の自動パイプラインは稼働済み
- `content_language`、日本語ソース 14 件、`thumbnail_url`、admin Phase 3、OGP、sitemap、robots は実装済み
- `daily-tag-dedup`、隣接分野タグ、`thumbnail_bg_theme`、L2/L4 retag まで含めてタグ系の基本運用は実装済み
- `hourly-compute-ranks` は最適化済みだが、係数調整は未着手
- Topic Group はスキーマ受け口のみで、本実装は未着手
- 定時 batch は GitHub Actions schedule を復旧済みで、月次 archive workflow も追加済み
- Home 公開面は自動更新を持たず、明示クリック起点の挙動を前提とする
- 記事カード UI は `ui-memo.md` 反映済みで、footer 比率、白エリア固定高、shadow/hover、外周余白、カスタムカーソルまで調整済み

## 2. 直近の方針

- 1周目ではカテゴリ設計を先に固定しない
- 主タグ / 周辺分野タグ / 新規立項タグ候補を属性として再構築する
- 次の優先は SQL 深掘りではなく、公開面のタグ / カテゴリ / 周辺分野タグ導線を Web 実装して評価すること
- カテゴリはサイドバー導線、周辺分野タグは当面通常タグと同様のクリック導線とする
- `paper` 専用タグ群は必要性が高いが、公開導線確立の後に扱う
- enrich backlog 解消は運用上の優先タスクとして扱い、現況・実測・次アクションは `docs/imp/enrich-queue-taskboard.md` で一時管理する
- backlog 件数、ジョブ状態、推奨フォロープラン、即時実行を見やすくするため、内部ページ `/admin/enrich-queue` を追加した

## 3. 現在有効な運用状態

### 3.1 収集・公開

- `alphaXiv` は収集 source にしない
- `arXiv` を収集 source とし、公開時だけ `alphaXiv` に置換する
- `paper` は同一ドメイン 1 件まで、それ以外は同一ドメイン 2 件までに抑制する
- `arxiv-ai` は例外運用とし、5 か月超 raw は enrich 対象外、L4 は 2 か月保持上限

### 3.2 enrich / publish / ranking

- `enrich-worker` は `limit=20`, `summaryBatchSize=20`, `maxSummaryBatches=1`
- `hourly-enrich` は毎時 8 回、`hourly-publish` は毎時 `:50`
- `hourly-compute-ranks` は publish 後段で実行し、CLI 実行入口も追加済み
- 本文取得記事では `canonicalTagHints` による `tag_aliases` / `tag_keywords` 自動反映が動く前提

### 3.3 タグ再構築 1周目

- 入力は `title + summary100 + summary200`
- 主タグは最大 5 件、平均 4 件超を目標にする
- 隣接分野タグは公開導線用に数百件規模の付与を目指す
- 新規主タグ 13 件の昇格と broad tag の inactive 化までは DB 反映済み

## 4. 次の確認事項

1. 公開面のカテゴリ / 主タグ / 周辺分野タグ導線をどこまで実装するか
2. 実装した Web を見ながらカテゴリ配置とタグ導線を評価する
3. `paper` / `arxiv-ai` に通常記事と別の研究系タグ群が必要かを後続で判断する
4. `hourly-compute-ranks` の係数を実データで見直すタイミングを判断する
5. `flowchart.md` に追加するタグ専用節で、どこまで詳細に経路差分を見せるか
6. enrich backlog を通常本線で吸い切るか、Gemini CLI 追いつき線を主に使うか
7. `/admin/enrich-queue` の推奨実行ボタンをどこまで増やすか
8. `/admin/enrich-queue` の 8 サイクル実行を通常運用ボタンとして残すか

## 5. 残タスク

### 優先

1. 主タグ・新規立項タグ・カテゴリ・周辺分野タグの役割分担を公開面に落とし込む
2. カテゴリをサイドバー導線として実装する
3. 周辺分野タグを通常タグと同様にクリック可能な導線として実装する
4. 実画面を見ながら導線を評価し、必要な修正点を洗う
5. タグ参照 SQL を使って次ラウンドの昇格 / 保留判断を進める

### 後続

1. `hourly-compute-ranks` 係数調整
2. Topic Group 本実装
3. 言語フィルタ UI の要否判断
4. tag alias 管理 UI の要否判断
5. `push_subscriptions.genres` rename の判断
6. 2周目着手前のカテゴリ / 属性設計確定
7. `paper` 専用タグマスタ新設と切替ロジック設計
8. 周辺分野タグの視覚マッピングページ設計
9. タグ関連テーブル再編の要否整理

## 6. 直近の重要変更

1. `docs/imp` / `docs/spec` を現行実装へ追随させ、batch 名称、schedule、`manual_pending`、隣接分野タグ、`hourly-compute-ranks`、カテゴリ導線の記述を整理した
1. 定時 batch の GitHub Actions schedule を復旧し、`monthly-public-archive` workflow を追加した
2. `scripts/run-hourly-compute-ranks.ts` を追加し、route ロジックを `src/lib/jobs/hourly-compute-ranks.ts` に抽出した
3. `canonicalTagHints` を使った alias / keyword 自動反映を enrich と `daily-tag-dedup` に統合した
4. Phase 1 正本に従って新規主タグ 13 件を昇格し、broad tag を inactive 化して L2/L4 付与を除去した
5. 公開導線は図で詰め切るより Web 実装を先に進める方針へ切り替えた
6. `flowchart.md` にタグ専用節を追加するための道筋を `implementation-plan.md` に追記し、ユーザー判断項目を `implementation-wait.md` に分離した
7. enrich backlog 実測と追いつき線の棚卸しを行い、一時管理ファイル `docs/imp/enrich-queue-taskboard.md` を追加した
8. `/admin/enrich-queue` を追加し、backlog 件数、job 状態、推奨フォロープラン、即時実行を 1 画面で見られるようにした
9. `/admin/enrich-queue` の即時実行に 8 サイクル回復ボタンを追加した
