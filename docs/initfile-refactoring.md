# initfile refactoring

最終更新: 2026-03-25

## 1. 目的

初期プロンプトで読み込んでいる docs / status 群について、初回読込コンテキストの圧縮余地を判断するための材料を残す。

この文書は「今どのファイルを消すか」を決めるものではなく、どこに重複・陳腐化・役割競合があるかを明確にするためのメモ。

---

## 2. 対象と規模

今回の初期読込対象 12 ファイルの概算規模:

| ファイル | Lines | Chars |
|---|---:|---:|
| `docs/guide/codex/AGENTS.md` | 69 | 1,513 |
| `docs/guide/COMMON.md` | 125 | 3,075 |
| `docs/guide/PROJECT.md` | 182 | 3,742 |
| `docs/imp/imp-hangover.md` | 610 | 20,659 |
| `docs/imp/imp-status.md` | 1211 | 56,680 |
| `docs/imp/implementation-plan.md` | 414 | 12,696 |
| `docs/imp/implementation-checklist.md` | 265 | 7,490 |
| `docs/imp/implementation-wait.md` | 114 | 4,179 |
| `docs/imp/screen-flow.md` | 313 | 7,979 |
| `docs/imp/data-flow.md` | 136 | 3,929 |
| `docs/spec/04-data-model-and-sql.md` | 502 | 13,193 |
| `agents-task-status.md` | 109 | 10,235 |
| **合計** | **4050** | **145,370** |

所感:

- ボトルネックは `imp-status.md` と `imp-hangover.md`
- 次点で `implementation-plan.md`、`implementation-checklist.md`、`agents-task-status.md`
- `guide` 系 3 ファイルと `implementation-wait.md` は比較的軽量

---

## 3. 結論

### 3.1 削減可能量の判断

初期読込セット全体 `145,370 chars` のうち、

- **保守的に見ても 65,000〜75,000 chars 程度**
- **割合でいうと約 45%〜52%**

は削減可能。

さらに、「初回に読むべきもの」と「必要時だけ読むもの」を分離すれば、

- **80,000 chars 前後**
- **約 55%**

まで削減できる可能性が高い。

つまり、今の「初期プロンプトで 50% を使う」状態には、**かなり大きな圧縮余地が含まれている**と判断する。

---

## 4. 主な重複源

### 4.1 `docs/imp/imp-status.md`

最も重い。しかも役割が広すぎる。

含まれているもの:

- 現在の進捗サマリ
- 古い実装履歴
- 完了済みの過去フェーズ説明
- 当時の次タスク
- 旧時点の件数メモ
- 旧時点の backlog / manual import 運用

問題:

- `implementation-plan.md`
- `imp-hangover.md`
- `implementation-checklist.md`
- `agents-task-status.md`

と内容が大きく重複している。

特に `content_language`、`日本語ソース14件`、`admin Phase 3`、`compute-ranks`、`public_article_sources`、`thumbnail_url` は何度も再説明されている。

判断:

- **初期読込対象としては肥大化しすぎ**
- 現在の役割に必要なのは先頭の「現況サマリ」だけで、後半の古い履歴は初回読込には不要

削減余地の目安:

- **70%〜85%**

---

### 4.2 `docs/imp/imp-hangover.md`

本来は「次セッション再開用」だが、過去引継ぎが積み重なっており、最新 section 以外の価値が落ちている。

現状の問題:

- `§16 最新` だけで再開できるのに、`§2〜§15` に旧時点の snapshot が大量に残っている
- `implementation-plan.md` や `implementation-checklist.md` で確定済みの内容を再説明している
- 2026-03-17〜2026-03-21 の途中段階が、今は「履歴資料」であって「起動時必須情報」ではない

判断:

- 初期読込では **最新 section のみでよい**
- 古い section は `docs/imp/history/` などに退避すべき

削減余地の目安:

- **60%〜75%**

---

### 4.3 `docs/imp/implementation-plan.md`

ファイル先頭では「A〜F 完了、残りは UI 調整・係数・Topic Group」と言っている一方で、後半にはすでに完了した A〜G の計画本文が長く残っている。

問題:

- 現在の計画と履歴が混在している
- 完了済みタスクの計画本文を初回読込で毎回読む必要がない
- `implementation-checklist.md` と重複している

判断:

- 現時点の plan は「残りタスク」だけに圧縮可能
- 完了済みフェーズ説明は history へ移せる

削減余地の目安:

- **45%〜60%**

---

### 4.4 `docs/imp/implementation-checklist.md`

完了済みチェックが非常に多い。

問題:

- チェックリストとしては有用だが、起動時コンテキストとしては完了項目の比率が高すぎる
- いま未完了なのはごく少数

判断:

- 初期読込に必要なのは「未完了」「保留」「再開条件」だけ
- 完了済み Phase A〜F は折りたたみ、別ファイル化、もしくは削除候補

削減余地の目安:

- **60%〜75%**

---

### 4.5 `agents-task-status.md`

ルールどおり短くはあるが、初期読込観点では次の問題がある。

問題:

- 直近キューと、古い完了履歴が同居している
- 2026-03-18〜2026-03-22 の done 行の多くは `imp-status.md` や `imp-hangover.md` と重複
- 2026-03-25 の handoff update だけは価値が高い

判断:

- 初回に読むべきなのは「現在キュー」と「最後の handoff 数行」だけ
- それ以前の done 群は履歴圧縮対象

削減余地の目安:

- **45%〜60%**

---

## 5. 比較的残すべきファイル

### 5.1 `docs/guide/codex/AGENTS.md`

- 短い
- Codex 固有ルール
- 初回に読む価値が高い

削減優先度は低い。

### 5.2 `docs/guide/COMMON.md`

- 共通ルールの SSOT
- UTF-8 読解ルールや docs 更新ルールがある
- ここを削るより他を削る方が効果が大きい

削減優先度は低い。

### 5.3 `docs/guide/PROJECT.md`

- 恒久ルールとしての役割は明確
- ToS / Home 方針 / Topic Group / Git 運用がまとまっている

ただし末尾の Git 運用は文字化け断片が残っており、整形し直した方がよい。
それでも全体としては保持価値が高い。

### 5.4 `docs/imp/implementation-wait.md`

- 未確定事項の集約先として役割が明確
- 初回読込価値が高い
- 114 lines / 4,179 chars と軽い

初期読込維持推奨。

### 5.5 `docs/imp/data-flow.md`

- cron / L1-L4 / ranking / tag flow が短くまとまっている
- `screen-flow.md` より初回読込価値が高い

必要性は高め。

---

## 6. 軽くないが残すか再編か迷うファイル

### 6.1 `docs/spec/04-data-model-and-sql.md`

役割自体は重要。

ただし初期読込では次が混在している:

- 現行スキーマの SSOT
- migration 035 / 036 の導入履歴
- 現況説明
- 運用ルール

判断:

- ファイル自体は必要
- ただし **「初回に読むべき要約版」** を別に切り出す余地がある

削減余地の目安:

- **20%〜30%**

### 6.2 `docs/imp/screen-flow.md`

資料としては良いが、Mermaid 図が多く、初回に毎回読む必要があるかは別問題。

判断:

- UI 実装セッションでは有用
- ただし一般的な起動時コンテキストとしては optional に寄せられる

削減余地の目安:

- **20%〜40%** または「初期読込対象から外す」

---

## 7. 圧縮優先順位

最優先で手を入れるべき順:

1. `docs/imp/imp-status.md`
2. `docs/imp/imp-hangover.md`
3. `docs/imp/implementation-plan.md`
4. `docs/imp/implementation-checklist.md`
5. `agents-task-status.md`
6. `docs/spec/04-data-model-and-sql.md`
7. `docs/imp/screen-flow.md`

---

## 8. 実際にどこまで減らせそうか

### 案A: 最小限の整理

やること:

- `imp-status.md` を現況サマリ + 直近変更だけへ圧縮
- `imp-hangover.md` を最新 section のみに圧縮
- `implementation-plan.md` から完了済み大章を削除
- `implementation-checklist.md` から完了済みチェックを別ファイル化
- `agents-task-status.md` を直近 10〜15 行に圧縮

期待効果:

- **約 45% 前後削減**

### 案B: 初期読込セットの再設計

初回に読むものを以下へ絞る:

1. `docs/guide/codex/AGENTS.md`
2. `docs/guide/COMMON.md`
3. `docs/guide/PROJECT.md`
4. `docs/imp/implementation-wait.md`
5. `docs/imp/data-flow.md`
6. `docs/spec/04-data-model-and-sql.md` の要約版
7. `docs/imp/imp-hangover.md` の最新要約版
8. `agents-task-status.md` の現在キューだけ

期待効果:

- **約 55% 前後削減**

---

## 9. 初回読込セットとしての推奨再編

### 推奨: 「読むべきもの」と「必要時だけ読むもの」を分ける

#### 起動時必須

- `docs/guide/codex/AGENTS.md`
- `docs/guide/COMMON.md`
- `docs/guide/PROJECT.md`
- `docs/imp/implementation-wait.md`
- `docs/imp/data-flow.md`
- `docs/imp/imp-hangover.md` の最新 section のみ
- `agents-task-status.md` の current queue のみ

#### 条件付きで読む

- `docs/spec/04-data-model-and-sql.md`
  - DB / migration / query 修正時のみ
- `docs/imp/screen-flow.md`
  - UI / API 接続見直し時のみ
- `docs/imp/implementation-plan.md`
  - 残タスク整理時のみ
- `docs/imp/implementation-checklist.md`
  - 実装開始時のみ
- `docs/imp/imp-status.md`
  - 詳細履歴が必要なときのみ

---

## 10. 具体的なリファクタ候補

### 候補1: `imp-status.md` を二分割

- 残す: `docs/imp/imp-status.md`
  - 現在の状態
  - 残タスク
  - 直近の重要変更 5〜10 件
- 逃がす: `docs/imp/history/imp-status-archive.md`
  - 古い実装履歴

### 候補2: `imp-hangover.md` を「最新のみ」にする

- 残すのは最新 handoff section だけ
- 古い handoff は `docs/imp/history/` へ退避

### 候補3: `implementation-plan.md` を真の現行 plan に戻す

- 完了済み A〜F の本文は削除
- 「今やること / 後回し / 非対象」だけにする

### 候補4: `implementation-checklist.md` を未完了専用にする

- `[x]` 群は archive 化
- `[ ]` と判断待ちだけを残す

### 候補5: `agents-task-status.md` を本当に 40 行以内へ維持

- 特に handoff update を複数行の段落で積まない
- 詳細は `imp-hangover.md` に寄せる

### 候補6: spec 要約ファイルを追加

例:

- `docs/spec/04-data-model-summary.md`

内容:

- 現在使う主要テーブル
- 追加禁止事項
- L1/L2/L3/L4 の基本だけ

これがあると、初回に 500 行の schema 全文を読まなくて済む。

---

## 11. 最終判断

今回の初期読込セットには、**かなり明確な削減可能情報が含まれている**。

特に以下の 5 ファイル:

- `docs/imp/imp-status.md`
- `docs/imp/imp-hangover.md`
- `docs/imp/implementation-plan.md`
- `docs/imp/implementation-checklist.md`
- `agents-task-status.md`

は、役割を失った古い履歴や、他ファイルと重複する説明が多く、初回コンテキストを重くしている。

判断としては:

- **少なくとも 45% は安全に削減できる**
- **設計を少し見直せば 55% 前後まで狙える**

「初期プロンプトでコンテキスト 50% 使用」は、現状の docs 構成上かなり改善余地がある。

---

## 12. 私なら最初にやる順番

1. `imp-hangover.md` を最新 section のみへ圧縮
2. `imp-status.md` を現況サマリだけに縮める
3. `implementation-plan.md` から完了済みフェーズ説明を削る
4. `implementation-checklist.md` を未完了だけ残す
5. `agents-task-status.md` を current queue 中心に戻す
6. 必要なら `04-data-model-summary.md` を作る

これで、初回読込コンテキストの体感はかなり変わるはず。
