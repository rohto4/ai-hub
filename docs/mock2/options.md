# mock2 候補案

最終更新: 2026-03-12

## 採用案

### A. Three-Pane Flow Workspace

- 左にグローバル導線
- 中央に route 本体
- 右にコンテキストと遷移ログ

採用理由:

- 導線確認に最も強い
- どの route にいても「次の行動」が見える
- ページ遷移しない動作も mock として表現しやすい

## 不採用だが検討した案

### B. Feed First Mobile Narrative

- 1カラム縦積みで Home を起点に全部つなぐ
- Search / Digest / Saved も下へ連結して見せる

長所:

- モバイル感は強い
- 一覧からの回遊を感覚的に見せやすい

弱点:

- route の区切りが曖昧になり、導線確認には不向き
- Topic Group や Settings が埋もれやすい

### C. Command Board + Overlay Prototype

- Linear / Raycast 的に command palette を主役にする
- すべての移動を overlay から起こす

長所:

- 上級者向け UX としては速い
- 検索 / フィルタ / 設定を一本化しやすい

弱点:

- AI Trend Hub の初期プロダクトには少し学習コストが高い
- 通知 / Digest / Saved の再開導線が弱くなりやすい

## 判断

今夜の目的は「実装を始める前に、どこからどこへどう移るかを確認すること」なので、A を採用した。

## 今回の参考入力

- Feedly
  - 情報収集の入口を多く持ちつつ、後段で整理する思想
- Product Hunt
  - 一覧からランキング・トピック比較へ流す導線
- Linear
  - 左ナビ + 中央作業面 + 右コンテキストの把握しやすさ
- Raycast
  - 検索起点の回遊を重くしすぎない設計

上記は `docs/spec/research-links.md` と実サイト確認を入力にした。
