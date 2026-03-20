---
description: "React/Next.jsアプリにおけるCore Web Vitalsのスコア低下要因（LCPの遅延、再レンダリング頻発）を特定・修正するコマンド"
---

# Command: /optimize-performance

## 目的 (Purpose)
アプリケーションの体感速度を向上させ、不要なクライアントバンドルの削減やサーバーサイドレンダリング（SSR/SSG）の恩恵を最大化します。

## 実行時に自動で行われる推論とアクション (Actions)
1. `use client` がファイルの根元に置かれすぎている箇所を検索し、Server ComponentとClient Componentの境界線を再定義する（Compositionパターンへのリファクタリング）。
2. 画像の `next/image` 置換や、フォントの `next/font` 対応が漏れている箇所を修正。
3. `useEffect` によるウォーターフォール通信（レンダリング後のデータフェッチ）を見つけ、`await fetch` を用いたServer Componentsでの並列取得へ書き換える。
