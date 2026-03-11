# 技術アーキテクチャ設計

最終更新: 2026-03-10

## 1. 技術スタック

1. Frontend:
   - Next.js (App Router), TypeScript
2. Backend:
   - Next.js Route Handlers + Server Actions
3. Database:
   - Neon (サーバーレス PostgreSQL)
   - pgvector を使用
   - 検索は P0 では `ILIKE` ベースで実装し、Neon で利用可能な検索拡張（例: `pg_search`）は後段で再評価する
4. 認証:
   - Firebase Auth（管理者・ユーザー共通）
   - Internal API: 環境変数シークレットトークン（`x-internal-secret` ヘッダー）
5. AI:
   - Gemini Flash API（要約・批評生成）
6. Batch:
   - Vercel Cron
7. OGP:
   - `@vercel/og`
8. Notification:
   - Web Push（Service Worker）
9. 問い合わせ通知:
   - Email + Discord Webhook
10. UX / Prototype:
   - `docs/mock2/` は HTML / CSS / Vanilla JS のインタラクティブプロトタイプで作成する
   - 導線確認を優先し、画面遷移しない要素も動的状態として表現する

## 2. 論理構成

1. Ingestion Layer
   - RSS 取得、URL 正規化、source_items 保持
2. Intelligence Layer
   - 本文抽出、要約、批評、タグ、クラスタ判定
3. Presentation Layer
   - 一覧/詳細/共有、PWA、アクティビティ表示
   - デバイス別表示制御（SP/TB/PC）
4. Observability Layer
   - ジョブ監視、品質監査、異常通知
5. Personalization Layer
   - 興味分野設定、要約モード設定、通知設定
6. UX Research Layer
   - Feedly / Product Hunt / Linear / Raycast 系の導線パターンを入力に、情報探索と回遊のしやすさを先に検証する

## 3. コンポーネント境界

1. `src/lib/collectors`
   - RSS 取得器
2. `src/lib/extractors`
   - 本文抽出器
3. `src/lib/ai`
   - プロンプト/バリデータ/プロバイダ抽象
4. `src/lib/ranking`
   - スコア計算
5. `src/lib/topic-grouping`
   - クラスタ統合判定
6. `docs/mock2`
   - 導線確認用モック
   - SPA 風プロトタイプと画面遷移メモ

## 4. API 境界

1. Public API
   - 閲覧用
2. Internal API
   - バッチ/運用向け（認証必須）
3. Settings API
   - ユーザー設定（要約モード/通知時刻/興味分野）

## 5. キャッシュ戦略

1. 一覧 API: 30-60 秒
2. 詳細 API: 5 分
3. OGP: CDN 1 日 + 手動 purge
4. AI 結果: `content_hash` をキーに半永続化

## 6. 障害時フォールバック

1. AI 失敗:
   - ルールベース短縮要約へ切替
2. OGP 失敗:
   - デフォルト画像返却
3. 外部統計欠落:
   - 前回統計値を短期利用
4. Neon 制約で未対応拡張がある場合:
   - P0 は標準SQLまたは利用可能な拡張で代替し、ブロッカーにしない

## 7. 実装方針（重要）

1. ドメインロジックは UI から分離
2. 収集処理と表示 API を疎結合化
3. 生成系 AI 処理は冪等化（同一 hash 再実行抑止）
4. Neon 接続は pooled / direct を役割分離する
   - `DATABASE_URL`: アプリ通常接続
   - `DATABASE_URL_UNPOOLED`: migration / 管理処理

## 8. 主要ドキュメント URL

1. Next.js:
   - https://nextjs.org/docs
2. Neon:
   - https://neon.com/docs/get-started-with-neon/connect-neon
   - https://neon.com/docs/connect/connection-pooling
   - https://neon.com/docs/changelog/2025-03-21
3. Firebase Auth:
   - https://firebase.google.com/docs/auth
4. Gemini API:
   - https://ai.google.dev/gemini-api/docs
5. Vercel Cron:
   - https://vercel.com/docs/cron-jobs
6. `@vercel/og`:
   - https://vercel.com/docs/og-image-generation
7. Web Push（MDN）:
   - https://developer.mozilla.org/docs/Web/API/Push_API
8. Pencil:
   - https://docs.pencil.dev/
