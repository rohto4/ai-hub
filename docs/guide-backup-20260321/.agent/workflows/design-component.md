---
description: "指定されたコンポーネントを、PencilMCPやTailwind v4の最新トレンドに合わせて美しくリデザインするコマンド"
---

# Command: /design-component

## 目的 (Purpose)
UI/UXのクオリティを底上げするため、指定されたファイル（またはコンポーネント名）に対して、モダンなスタイル（Bento UI、Spatial UI、Fluid Typography）を適用します。

## 実行時に自動で行われる推論とアクション (Actions)
1. 対象の `.tsx` / `.js` ファイルを読み込み、現在のDOMツリーとスタイリング状態（Tailwind Class）を解析する。
2. 古いTailwindパターン（例: 不要なマージンの乱用、ベタ塗りの色）を排除し、透明度やシャドウを使った多層的な表現に置き換える。
3. `framer-motion` をインポートし、必須のホバー（Scale, Glow）および登場（Fade-in, slide-up）アニメーションを付与する。
4. （可能であれば）ユーザーに対してプレビュープロンプトを返す、またはArtifactとして新旧デザインの比較を提示する。
