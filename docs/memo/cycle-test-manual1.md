# cycle-test-manual1

最終更新: 2026-03-16

## 目的

毎朝、Codex CLI に最小限の指示だけで `Layer1 -> Layer2` の手動サイクルを回してもらうためのメモ。  
理想は「手でバッチを叩くだけ」で、必要な補足だけを短く足す運用を想定する。

---

## 基本プロンプト

以下をそのまま Codex CLI に渡す。

```text
まず以下を確認してください。
- docs/guide 配下一式
- docs/imp/implementation-plan.md
- docs/imp/imp-status.md
- docs/imp/implementation-wait.md
- docs/imp/imp-hangover.md
- docs/spec/11-batch-job-design.md

今日の Layer1 -> Layer2 手動サイクルを回してください。

やること:
1. 前提条件を確認する
   - DB 接続可否
   - 必要な env の有無
   - API 要約を使うか、manual_pending 前提にするか
2. `hourly-fetch` を実行する
3. `daily-enrich` を必要な回数だけ実行し、Layer2 へ載せる
   - API 要約が不安定なら `manual_pending` で止めてよい
4. 結果確認
   - `db:check-layer12`
   - `job_runs` / `job_run_items`
   - `artifacts/manual-pending/` の有無
5. 今日の結果を docs に反映する
   - implementation-plan.md
   - imp-status.md
   - 判断待ちがあれば implementation-wait.md
   - 宿題があれば imp-hangover.md

注意:
- 日本語ファイルは UTF-8 前提で読む
- docs は日本語で更新する
- ソースコメントは最小限、必要なら日本語
- まず小さく回してから必要なら追加バッチを回す
- 今日の実行日時と件数を絶対日付で残す

実行後に、何件 fetch され、何件 enrich され、manual_pending が何件出たかを報告してください。
```

---

## 最小追記だけで済む補足例

### 1. API 要約も試す日

```text
Gemini / OpenAI が使えそうなら summaryBatchSize=10 で通常要約を試してください。
失敗したら template fallback には落とさず manual_pending にしてください。
```

### 2. manual_pending 前提の日

```text
今日は API 要約を使わず、manual_pending 前提で Layer2 まで進めてください。
manual pending の export を確認してください。
```

### 3. source を絞る日

```text
今日は sourceKey=huggingface-blog だけを対象にしてください。
小さな limit から始めてください。
```

---

## Codex に期待する実行順

1. docs を読む
2. DB と env を確認する
3. 小さく `hourly-fetch` を回す
4. 小さく `daily-enrich` を回す
5. 必要なら追加バッチを回す
6. `db:check-layer12` と job run を確認する
7. `manual_pending` や失敗があれば artifact を確認する
8. docs を更新する
9. 件数と残課題を簡潔に報告する

---

## その日の補足で決める項目

- API 要約を使うか
- `summaryBatchSize=10` を有効にするか
- source を全体で回すか、sourceKey を絞るか
- 何バッチまで回すか
- `manual_pending` をその日のうちに回収するか

---

## 望ましい報告形式

```text
実行日時:
- 2026-03-16 09:00 JST

結果:
- fetch: 12 inserted / 3 updated / 0 failed
- enrich: 25 processed / 21 completed / 4 manual_pending / 0 failed
- layer2 totals: enriched_total=898, manual_pending=4

追記:
- docs 更新済み
- 判断待ちなし
- 明日持ち越し: manual_pending 4件の手動要約
```

---

## 補足

- GitHub Actions 本番投入前の暫定運用を想定している。
- `hourly-layer12` をまとめて叩くより、当面は `hourly-fetch` と `daily-enrich` を分けて確認する方が安全。
- サイクルテストが安定したら、このメモを GitHub Actions 運用手順に置き換える。
