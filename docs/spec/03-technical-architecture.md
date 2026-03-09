# 技術アーキテクチャ設計

最終更新: 2026-03-07

## 1. 技術スタック

1. Frontend:
   - Next.js (App Router), TypeScript
2. Backend:
   - Next.js Route Handlers + Server Actions
3. Database:
   - Neon (サーバーレス PostgreSQL)
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
5. ランキング一覧: `mv_rank_scores_current`（Materialized View）を参照。バッチ更新後に `REFRESH MATERIALIZED VIEW CONCURRENTLY` で反映

## 6. 障害時フォールバック

1. AI 失敗:
   - ルールベース短縮要約へ切替
2. OGP 失敗:
   - デフォルト画像返却
3. 外部統計欠落:
   - 前回統計値を短期利用

## 7. 実装方針（重要）

1. ドメインロジックは UI から分離
2. 収集処理と表示 API を疎結合化
3. 生成系 AI 処理は冪等化（同一 hash 再実行抑止）

## 8. スケール対応方針

### 8.1 DB接続

1. アプリサーバーは Neon Pooler エンドポイント（PgBouncer 互換）のみ使用
2. マイグレーション実行時のみ直接接続を許可
3. Vercel Serverless 環境では接続数が急増しやすいため Pooler は必須

### 8.2 インジェスト負荷制御

1. `ingest-feeds` の並列ジョブ数を最大 5 に制限
2. 超過ジョブはキュー待機（Vercel Cron の多重起動防止フラグで制御）
3. 1 ジョブあたりの処理件数上限を設け、長時間実行によるタイムアウトを防ぐ

### 8.3 書き込みバッファリング

1. `event_log` への書き込みは Route Handler から直接 INSERT しない
2. ペイロードをリクエスト単位でバッファし、バッチ INSERT（100件単位）で書き込む
3. 書き込み失敗は握りつぶさず `payload` に退避してリトライ可能にする
