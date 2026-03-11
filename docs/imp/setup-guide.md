# AI Trend Hub セットアップガイド

最終更新: 2026-03-11

## 目的

- 実装を前進させるうえで、ユーザー側でやると一気に進みやすくなる準備を整理する。
- いま必須のものと、後から必要になるものを分けて残す。

## 今やると進みやすいもの

| 項目 | 何を用意するか | 使う場所 | 影響 |
|---|---|---|---|
| Neon 接続情報 | `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | API / migration / cron | ingest / push / search の実データ確認が安定する |
| `NEXT_PUBLIC_APP_URL` | 例: `https://aitrend.example.com` | OGP / digest payload / metadata | localhost 固定値を避けられる |
| Firebase Client 設定 | `NEXT_PUBLIC_FIREBASE_API_KEY` `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | client auth 初期化 | 保存同期や通知設定 UI を次段でつなげやすい |
| Firebase Admin SDK | `FIREBASE_PROJECT_ID` `FIREBASE_CLIENT_EMAIL` `FIREBASE_PRIVATE_KEY` | server auth / internal API | ログイン同期や管理画面着手に必要 |
| VAPID キー | `VAPID_PUBLIC_KEY` `VAPID_PRIVATE_KEY` `VAPID_SUBJECT` | push subscribe / digest cron | Web Push 実送信を有効化できる |
| Cron Secret | `CRON_SECRET` | internal cron routes | Vercel Cron から安全に叩ける |

## 後から必要になるもの

| 項目 | 何を決めるか | 使う場所 | 備考 |
|---|---|---|---|
| 重要ソース初期リスト | RSS / Atom / 公式 API の URL 一覧 | `feeds` seed / ingestion | Google Alerts 比率の暫定運用を具体化する |
| Firebase プロジェクト構成 | user / admin の auth provider 方針 | 保存同期 / 管理画面 | Google ログインを入れるならここで決める |
| Push 配信文面 | digest の title/body 方針 | `send-digest` cron | いまは 24h ランキング上位3件の先頭要約を送る骨格のみ |
| Misskey 対応範囲 | 対応インスタンスを固定するか自由入力のままにするか | share popup | 現在は自由入力を local 保存 |
| OGP 画像の最終ブランド調整 | タイトル、色、文言、角丸、アイコン | `opengraph-image.tsx` | 現在は site-level テンプレのみ |

## 推奨手順

1. `.env.local` に Neon / Firebase / VAPID / `NEXT_PUBLIC_APP_URL` を入れる
2. `npm run db:migrate`
3. `npm run db:seed`
4. `npm run build`
5. `npm run type-check`
6. `npm run dev`
7. `/api/trends` `/api/search` `/api/push/subscribe` `/api/cron/send-digest` を順に確認する

## 実運用前にユーザーが判断すること

- Topic Group の最終遷移方式
- 管理画面 MVP の境界
- digest 通知内容の最終仕様
- Google Alerts と補助ソースの配分

## 補足

- `npm run type-check` は `.next/types` に依存するため、環境によっては `npm run build` の後に実行した方が安定する。
- Windows では `next dev --turbopack` で `.next/static/development/_buildManifest.js.tmp.*` の ENOENT が出ることがあるため、既定の開発コマンドは `npm run dev` = `next dev` にしている。Turbopack を試す場合は `npm run dev:turbo` を使う。
- 保存機能は現在 `localStorage` ベース。Firebase 連携後にサーバー同期へ差し替える前提。
