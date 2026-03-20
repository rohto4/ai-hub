---
description: "肥大化したReactコンポーネントをSRP（単一責任の原則）とNext.js 15のCompositionパターンに則って解体・再構築するワークフロー"
---

# 🔧 Workflow: Component Refactoring (コンポーネント・リファクタリング)

このワークフローは、保守性が低下した巨大なファイル（通称：Fat Component）を、責務ごとに美しく分割・整理するための標準作業手順書（SOP）です。

## 対象 (Target)
- 行数が300行を超えるコンポーネント
- `useState`, `useEffect` が大量に記述され、UIとロジックが密結合しているファイル

## 手順 (Steps)

1. **現状の分析 (Analyze)**
   - 対象ファイルの `useHooks` の数とスコープを確認する。
   - どの中間変数がJSXレンダリングのどこに使われているか依存ツリーを把握し、ドメイン機能ごとにグループ化する。

2. **カスタムフックへのロジック分離 (Extract Hooks)**
   - コンポーネントツリー内の状態管理やデータフェッチロジックを切り出し、新しく `hooks/use[FeatureName].ts` として定義する。
   - UIファイル（.tsx）には「見た目に関わる処理」と「イベントハンドラのバインド」だけを残す。

3. **Server / Client Component の境界再設計 (Boundary Review)**
   - ファイルの先頭に `'use client'` があり、その中でDB呼び出し等のServer向け処理を行おうとしていないか確認する。
   - インタラクティブな部分（ボタンやフォーム）だけを別コンポーネントに切り出し、それをServer ComponentのJSXツリー内に差し込む（Composition）アプローチに変えられないか検討する。

4. **冗長な条件分岐のフラット化 (Guard Clauses)**
   - `if...else` が3段以上ネストされている場合、早期リターン（Early Return）を用いてネストを浅くする。

5. **テスト実行と差分確認 (Verify)**
   - リファクタリング前と後で、テストコード（Vitest / Playwright）が引き続きパース（Green）することを確認する。
   - ユーザーにリファクタリング結果のDiffを提示し、変更の意図を説明する。
