# Enrich Queue Taskboard

最終更新: 2026-04-03

## 1. 目的

- enrich 待ち行列の解消タスクを、一時運用メモとして 1 ファイルで管理する
- backlog 実測、既存スクリプト、進行中タスク、再開ポイントを同じ場所で追えるようにする
- 恒久仕様は増やさず、解消フェーズが終わるまでの作業盤として扱う

## 2. 現在のスナップショット

取得時刻:
- `2026-04-03 01:40 JST` 前後

`npm run db:check-layer12` の要点:
- `articles_raw.raw_unprocessed = 1325`
- `articles_raw.raw_with_error = 0`
- `articles_enriched.total = 6454`
- `candidate_pool_total = 11849`
- 最新 `enrich-worker` は 20 件成功

未処理の大きい source:
- `arxiv-ai = 508`
- `mercari-engineering-blog = 61`
- `google-alerts-gemini-google-ai-studio = 60`
- `google-alerts-rag-retrieval-augmented-generation = 41`
- `google-alerts-ai-regulation-policy = 40`
- `google-alerts-openai-chatgpt-codex = 40`

観測メモ:
- schedule 上の通常 enrich は毎時 8 回、1 回 20 件なので理論値は `160件/時`
- backlog 1325 件だけを見ると、純減できる前提なら約 `8.3時間` で吸える
- ただし fetch 流入が継続するので、実際には source ごとの偏りと流入量を見ないと純減しない
- backlog の偏りは `arxiv-ai` が最大で、ここを別扱いにする価値が高い

## 3. 既存の追いつき資産

CLI / script:
- `npm run db:run-enrich-worker -- --limit 20 --summary-batch-size 20 --max-summary-batches 1`
- `npm run db:prepare-gemini-cli-enrich`
- `npm run db:import-ai-enrich-outputs`
- `npm run db:retag-layer2-layer4`
- `npm run db:check-layer12`
- `node scripts/requeue-raw.mjs`
- `node scripts/skip-raw-backlog.mjs`

既存 artifact:
- `artifact/gemini-cli-enrich-backlog-1500/manifest.json`
- `artifact/gemini-cli-enrich-backlog-1500/README.md`
- `artifact/gemini-cli-enrich-backlog-1500/outputs/ai-enrich-outputs-part-001.json` 〜 `part-008.json`

確認できたこと:
- Gemini CLI は導入済み (`gemini 0.35.1`)
- `prepare-gemini-cli-enrich-artifacts.ts` は chunk 分割、`manifest.json`、`README.md`、prompt ファイル生成まで持っている
- 既存 artifact は `1500 件 / 8 chunk` 構成で、出力 JSON も揃っている
- 既存 output の rawArticleId `1500` 件のうち、現 `articles_enriched` に残っているのは `1489` 件
- 残り `11` 件は `articles_raw.is_processed=true` かつ `articles_enriched_history` には存在する

## 4. 現在のギャップ

### 4.1 今すぐ backlog を減らす線

- 通常 `enrich-worker` を追加で回す
- Gemini CLI 追いつき線を再利用する
- source 単位で `arxiv-ai` を別枠処理する

### 4.2 仕組み上の弱点

- `import-ai-enrich-outputs.ts` は `adjacentTagIds: []` 固定、`thumbnailBgTheme: null` 固定
- `import-ai-enrich-outputs.ts` の `OutputItem` は `properNounTags` を読んでおらず、CLI 出力側の候補タグが import で使われない
- docs 既知論点どおり、通常 enrich と CLI import 線で副作用差が残る
- `prepare-gemini-cli-enrich-artifacts.ts` は chunk と manifest を出すが、heartbeat / 進捗ファイル / 再開状態の管理までは持っていない

意味:
- backlog 解消だけなら既存線で進められる
- ただし backlog を CLI で大量処理したあと、タグ候補・周辺分野タグ・背景テーマが通常 enrich と一致しない恐れがある
- 「寝ている間に自動で進む」運用にするには、進捗可視化と part 再開の仕組みを足したい

## 5. タスク表

| ID | 状態 | タスク | 目的 | 結果 / 次 |
|---|---|---|---|---|
| EQ-01 | done | backlog 実測を取る | 行列規模を固定する | `raw_unprocessed=1325`, 最大は `arxiv-ai=508` |
| EQ-02 | done | 既存 script / artifact の棚卸し | 追いつき線の再利用可否を確認する | Gemini CLI 導入済み、旧 artifact も残存 |
| EQ-03 | doing | backlog 解消手順を具体化する | 実行順と再開点を決める | 下記「6. 実行順」へ反映 |
| EQ-04 | done | 旧 `gemini-cli-enrich-backlog-1500` の import 状態を確認する | 未反映 chunk の有無を切り分ける | output は 1500 件完走、現 L2 残存は 1489 件、欠落 11 件は history 側に存在 |
| EQ-05 | todo | 現 backlog に対して新しい artifact を切るか判断する | 再利用か再生成かを決める | 旧 artifact 残件 11 件の扱いと、現 `raw_unprocessed=1325` の重なり確認が必要 |
| EQ-06 | todo | 通常 enrich 追加実行でどこまで純減するか測る | CLI 線なしで吸える量を確認する | 1〜2 時間ぶんの before/after を見たい |
| EQ-07 | todo | CLI 追いつき線の副作用差を解消する修正方針を固める | 大量 import 後の整合性を守る | `properNounTags`, adjacent, theme の共通保存化が本命 |
| EQ-08 | todo | 20 分 heartbeat 前提の進捗管理を設計する | 長時間 Gemini 実行のブラックボックス化を防ぐ | part 単位 status / heartbeat / resume が必要 |

## 6. 実行順

### Phase A. 現在地の確定

1. `db:check-layer12` の結果を保存する
2. 既存 `artifact/gemini-cli-enrich-backlog-1500/` の生成時点と chunk 構成を記録する
3. 旧 artifact が DB に import 済みかを確認する
4. 現 `articles_enriched` に無い 11 件が history のみ存在する理由を切り分ける

### Phase B. backlog をどの線で吸うかを決める

1. まず通常 `enrich-worker` を追加で回して、純減速度を観測する
2. `arxiv-ai` が全体を押し上げているなら source 単位運用を検討する
3. backlog が純減しない、または時間がかかりすぎるなら Gemini CLI 追いつき線へ切る

### Phase C. CLI 追いつき線を安全に回す

1. 入力は chunk 単位で維持する
2. part ごとに output を保存する
3. 20 分以内に更新が見えない part は停止疑いとして扱う
4. import は part 単位で可能にし、完了済み part は再実行しない
5. import 後は必ず `retag-layer2-layer4` を続ける

### Phase D. 追いつき後の整合性確認

1. `raw_unprocessed` がどこまで下がったか確認する
2. `articles_enriched` 件数の増分を確認する
3. `public_article_adjacent_tags` と `thumbnail_bg_theme` の反映差がないか spot check する
4. `tag_candidate_pool` が CLI import 線でも増えているか確認する

## 7. いまの結論

- enrich 待ち行列の解消は、現時点で明確に主タスク候補
- backlog 自体は `1325` 件で、ただちに破綻している量ではない
- ただし `arxiv-ai` 偏重と CLI import 線の副作用差があるため、「数を流す」だけでは解決しない
- 既存の Gemini CLI artifact は「完走済みだが現 L2 に 11 件欠落あり」という状態まで確認できた
- つまり再生成より前に、「現 backlog 1325 件」と「旧 artifact の残件 11 件」を分けて扱うのがよい
- 完全自動化を狙うなら、先に heartbeat / resume 設計を入れてからの方が安全

## 8. 次に埋める項目

1. 現 L2 に無い 11 件が削除・上書き・移送のどれかを切り分ける
2. 通常 enrich を追加で回した前後差分
3. CLI import 線の副作用差を直す実装タスクへの分解
4. 20 分 heartbeat をどこに保存するかの方針
