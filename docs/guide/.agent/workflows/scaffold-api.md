---
description: "Next.js Route Handlers (API Routes) や外部プロバイダーとの連携を行うためのバックエンドAPIの雛形を生成するコマンド"
---

# Command: /scaffold-api

## 目的 (Purpose)
Restful APIやWebhookエンドポイントを、型安全かつセキュアに即座に構築するためのスキャフォールディング機能を提供します。

## 実行時に自動で行われる推論とアクション (Actions)
1. 入力された「リソース名」や「アクション（例: Stripe Webhook, 記事のCRUD）」をもとに、`app/api/[route]/route.ts` ファイルを生成する。
2. Next.js の `NextRequest`, `NextResponse` をインポートし、エラーハンドリング（`try...catch`）とステータスコード返却の雛形を作成。
3. リクエストボディの Zod パース処理（`req.json()`）、および無効なリクエスト時の `400 Bad Request` 処理を組み込む。
4. Supabase DBにデータを保存/取得するプレースホルダー処理を自動で挿入する。
