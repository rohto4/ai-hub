---
description: "本番デプロイ前の最終チェック、およびパフォーマンス（Core Web Vitals）と型整合性の検証ワークフロー"
---

# 🚀 Workflow: Deployment Preparation (デプロイ準備)

このワークフローは、機能開発が完了し、`main` ブランチへマージ（またはVercel等へデプロイ）する前に行うべき最終フェーズのチェックリストです。

## 対象 (Target)
- 変更の手が加わった全てのコンポーネントとモジュール

## 手順 (Steps)

1. **TypeScript コンパイルエラーの全滅**
   - ターミナルで `npm run type-check` または `npx tsc --noEmit` を実行し、プロジェクト全体で型エラーが存在しないことを確認する。
   - もしエラーがあれば、即座に修正する（`any` や `@ts-ignore` で逃げることは許されない）。

2. **Linter & Formatterの実行**
   - `npm run lint` を実行し、未使用変数の放置、ルールの違反（Hookの依存配列エラー等）がないか確認する。

3. **コンポーネントレベルの LCP / CLS チェック**
   - 追加または変更されたページの最初のビュー（Above the fold）に画像が含まれる場合、`priority` 属性が付与されているか？
   - 画像や動的レイアウトに横幅と高さ（`width` / `height` または `aspect-ratio`）が指定され、レイアウトシフト（CLS）が防止されているか？

4. **ビルド検証**
   - `npm run build` をローカルで実行し、Next.jsの静的生成（Static Generation）と動的レンダリング（Dynamic Rendering）の境界が意図通りかチェックする。
   - 不要に全てがDynamicになっていないか（本来キャッシュできるはずのページがキャッシュされていないか）Routeセグメント構成を確認する。

5. **アーキテクチャ・ドキュメントの同期**
   - 実装した内容が `docs/imp/implementation-plan.md` や `docs/data-schema.md` と完全に一致しているか確認し、コード側で変更があった場合はドキュメント側（SSOT）を最新化する。
