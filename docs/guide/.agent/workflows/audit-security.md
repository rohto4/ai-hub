---
description: "Server ActionsおよびAPIルートに対するOWASP Top 10準拠の厳格なセキュリティ監査ワークフロー"
---

# 🛡️ Workflow: Security Audit (セキュリティ監査)

このワークフローは、新規に作成されたAPI、Server Actions、またはデータベース接続処理に対して、デプロイ前に実施すべきセキュリティ検証の手順（SOP）を定義します。

## 対象 (Target)
- データベースの読み書きを行う全てのファイル
- ユーザー入力を受け付けるコンポーネント
- `use server` ディレクティブが使用されているファイル

## 手順 (Steps)

1. **認証（Authentication）の検証**
   - エンドポイントの先頭で `supabase.auth.getUser()` または同等のセッション確認が行われているか確認する。
   - `service_role` キーがフロントエンド（Client Components）に漏洩していないか全文検索で確認する。

2. **認可（Authorization / IDOR対策）の検証**
   - リソース（例：ドキュメントやプロファイル）に対して `UPDATE` または `DELETE` 操作を行う際、リクエスト送信者の `user.id` とリソースの `owner_id` が一致するかプログラムレベルで確認しているか。
   - Supabaseのダッシュボード（またはMigration SQL）において、該当テーブルの Row Level Security (RLS) が有効であり、パーミッションが設定されているか確認する。

3. **入力バリデーションの監査**
   - クライアントから送信されたデータ（FormData等）をそのままDB拡張関数やクエリに渡していないか確認する。
   - データの入り口で必ず `Zod` スキーマ等を用いて `safeParse` が実行され、型と長さを制限しているか検証する。

4. **XSS / HTMLサニタイズのチェック**
   - `dangerouslySetInnerHTML` を使用している箇所を `grep_search` し、使用されている場合は前段に `DOMPurify` などのサニタイズ処理が挟まれているか確認する。

5. **監査レポートの出力**
   - 以上の結果を `security-audit-report.md` アーティファクトとしてまとめ、ユーザーに報告する。
   - もし脆弱性を発見した場合は、直ちに修正差分（Diff）を作成して提示すること。
