# AI Trend Hub 実装ステータス

最終更新: 2026-03-11

## 進捗サマリ

| タスク | 内容 | 状態 | 備考 |
|---|---|---|---|
| 1 | Home 非モック化 | 完了 | `/api/trends` を基準にし、失敗時のみモックへフォールバック |
| 2 | 検索接続 | 完了 | Enter / ボタン submit で `/api/search` に接続 |
| 3 | 保存 / 共有 / 行動ログ / Topic Group 暫定導線 | 完了 | local save、share popup、return focus、Topic Group スクロール導線を実装 |
| 4 | SP / TB UI 対応 | 完了 | Header / card action bar / sidebar をレスポンシブ化 |
| 5 | OGP / metadata / PWA 基礎 | 完了 | `opengraph-image.tsx`、manifest、service worker、install banner を追加 |
| 6 | ingestion / AI / notification / auth groundwork | 完了 | summary validation、push subscribe API、digest cron 骨格、Firebase client 初期化 |
| 7 | 実装運用ドキュメント | 完了 | `setup-guide.md` と本ファイルを追加 |

## 暫定実装の残し先

- 暫定仕様一覧: `docs/imp/implementation-wait.md`
- 非モック化進行台帳: `docs/imp/non-mock-ledger.md`
- 実装順 / P0 状態: `docs/imp/implementation-plan.md`

## コミット記録

| 順番 | コミット | 内容 |
|---|---|---|
| 1 | `cd622ec` | Home live 化 / 検索接続 |
| 2 | `b77e631` | local save / share / return focus / temporary Topic Group |
| 3 | `545a829` | mobile / tablet UI 対応 |
| 4 | `a15020c` | OGP / metadata / PWA groundwork |
| 5 | `5e25ee0` | notification / auth groundwork |

## 検証結果

| 検証方法 | コマンド / 観点 | 結果 | 補足 |
|---|---|---|---|
| 型検査 | `npm run type-check` | 成功 | `.next/types` 依存があるため、必要に応じて build 後に再実行 |
| 本番ビルド | `npm run build` | 成功 | `/opengraph-image` `/manifest.webmanifest` `/api/push/subscribe` `/api/cron/send-digest` を含めてビルド済み |
| 開発サーバー | `npm run dev` | 既定を変更 | Windows では Turbopack 由来の `_buildManifest.js.tmp.*` ENOENT を避けるため `next dev` を既定化 |
| Home API | `/api/trends` | 既存確認済み | Home はこの API を基準に描画 |
| Search API | `/api/search` | 既存確認済み | submit 型 UI で接続済み |
| UI フォールバック | DB 失敗時の Home / Search | 実装済み | モックへフォールバックして UI を止めない |
| Share popup | コピー / AIHub トグル / Misskey 設定 | 実装済み | 実際の投稿先検証は環境依存 |
| PWA | manifest / service worker / install banner | 実装済み | 実機 install / push は VAPID 設定後に要再確認 |
| digest cron | `/api/cron/send-digest` | 骨格実装 | VAPID 未設定時は `503` 返却 |

## いま残っている主要タスク

| 領域 | 残件 |
|---|---|
| Topic Group | 最終 UX を別ページ / ドロワー / インライン展開から確定 |
| OGP | article 単位テンプレ、共有文面との接続、必要なら ISR キャッシュ |
| Notifications | 実購読 UI、push payload 調整、再送制御の詰め |
| Auth | Firebase login UI、local save とのマージ |
| Ingestion | feed 実投入、embedding / topic grouping 本実装、失敗監視 |
| Setup | Neon / Firebase / VAPID / `NEXT_PUBLIC_APP_URL` の本番値投入 |

## 再開時の推奨確認順

1. `docs/imp/implementation-plan.md`
2. `docs/imp/implementation-wait.md`
3. `docs/imp/non-mock-ledger.md`
4. `docs/imp/setup-guide.md`
5. `docs/imp/imp-status.md`
