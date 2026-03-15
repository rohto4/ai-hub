# 技術アーキテクチャ設計

最終更新: 2026-03-12

## 1. 技術スタック

1. Frontend:
   - Next.js (App Router), TypeScript
2. Backend:
   - Next.js Route Handlers + Server Actions
3. Database:
   - Neon (サーバーレス PostgreSQL)
   - pgvector を使用
   - 検索は P0 では `ILIKE` ベースで実装し、Neon で利用可能な検索拡張は後段で再評価する
4. 認証:
   - Firebase Auth（管理者・ユーザー共通）
   - Internal API: 環境変数シークレットトークン
5. AI:
   - Gemini Flash API
6. Batch:
   - Vercel Cron / GitHub Actions
7. OGP:
   - `@vercel/og`
8. Notification:
   - Web Push
9. 問い合わせ通知:
   - Email + Discord Webhook
10. Diagram:
   - Mermaid
11. UX / Prototype:
   - `docs/mock2/` は HTML / CSS / Vanilla JS のインタラクティブプロトタイプで作成する

## 2. 論理構成

1. Ingestion Layer
   - RSS / API 取得、URL 正規化、`articles_raw` 保持
2. Intelligence Layer
   - 本文抽出、要約、タグ照合、確定重複判定、`articles_enriched` 生成
3. Curation Layer
   - 行動ログ、運営ログ、優先処理、集計データの保持
4. Presentation Layer
   - `public_articles` / `public_article_tags` / `public_rankings` を参照して一覧/詳細/共有、PWA、アクティビティ表示
5. Observability Layer
   - ジョブ監視、品質監査、異常通知
6. Personalization Layer
   - 興味分野設定、要約モード設定、通知設定
7. UX Research Layer
   - 導線パターンの検証

## 3. コンポーネント境界

1. `src/lib/collectors`
   - RSS 取得器
2. `src/lib/extractors`
   - 本文抽出器 / 引用元解決
3. `src/lib/ai`
   - プロンプト / バリデータ / プロバイダ抽象
4. `src/lib/dedupe`
   - URL 正規化、確定重複判定、類似候補化
5. `src/lib/tags`
   - タグ候補抽出、タグマスタ照合
6. `src/lib/ranking`
   - スコア計算
7. `src/lib/topic-grouping`
   - 後続フェーズでのクラスタ統合判定
8. `docs/mock2`
   - 導線確認用モック

## 4. API 境界

1. Public API
   - 閲覧用
2. Internal API
   - バッチ / 運用向け（認証必須）
3. Settings API
   - ユーザー設定

## 5. キャッシュ戦略

1. 一覧 API: 30-60 秒
2. 詳細 API: 5 分
3. OGP: CDN 1 日 + 手動 purge
4. AI 結果: `source_name + normalized_url + snippet_hash` をキーに再利用
5. 公開面: 1 時間ごとの `public_articles` 更新を前提にする

## 6. 障害時フォールバック

1. AI 失敗:
   - ルールベース短縮要約へ切替
2. OGP 失敗:
   - デフォルト画像返却
3. 外部統計欠落:
   - 前回統計値を短期利用
4. Neon 制約で未対応拡張がある場合:
   - P0 は標準 SQL または利用可能な拡張で代替する

## 7. 実装方針

1. ドメインロジックは UI から分離
2. 収集処理と表示 API を疎結合化
3. `layer1` / `layer2` はサイト表示層から独立して実装する
4. 生成系 AI 処理は冪等化する
5. Neon 接続は pooled / direct を役割分離する
   - `DATABASE_URL`: アプリ通常接続
   - `DATABASE_URL_UNPOOLED`: migration / 管理処理

## 8. スケール対応方針

### 8.1 DB 接続

1. アプリサーバーは Neon Pooler エンドポイントを使用する
2. マイグレーション実行時のみ直接接続を許可する
3. Serverless 環境では Pooler を前提にする

### 8.2 インジェスト負荷制御

1. 同時実行数を制限する
2. 長時間実行を避けるため 1 ジョブあたりの件数上限を持つ
3. source 単位失敗でジョブ全体を止めない

### 8.3 書き込みバッファリング

1. `event_log` への直接多重 INSERT は避ける
2. 必要に応じて batch INSERT またはキューを使う
3. 失敗 payload は再試行可能な形で保持する

## 9. 主要ドキュメント URL

1. Next.js:
   - https://nextjs.org/docs
2. Neon:
   - https://neon.com/docs/get-started-with-neon/connect-neon
   - https://neon.com/docs/connect/connection-pooling
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
