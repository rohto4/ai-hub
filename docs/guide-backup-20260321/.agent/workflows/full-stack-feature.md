---
description: "DBスキーマの定義から、Server Actions、および表示用のClient Componentまでを一括で自動生成する強力なコマンド"
---

# Command: /full-stack-feature

## 目的 (Purpose)
「新しい機能（例: /full-stack-feature 'User Profile'）」を入力するだけで、DDDに基づいたフロント・バックエンド・データベースの3層モデルを一発でスキャフォールディングします。

## 実行時に自動で行われる推論とアクション (Actions)
1. **DB設計**: Neon（PostgreSQL）用のテーブル定義SQLとRLS（Row Level Security）のドラフトを作成。`docs/spec/04-data-model-and-sql.md` に追記する。
2. **API設計**: Next.js (App Router)用の `use server` Server Actionsファイル（Zodバリデーション含む）を生成。
3. **UI設計**: Server Component（データ取得）とClient Component（フォーム送信・最適化アニメーション付）を生成し、対象ディレクトリに配置する。
4. 全ての配備が完了したら、ユーザーにレビュー依頼（notify_user）を行う。
