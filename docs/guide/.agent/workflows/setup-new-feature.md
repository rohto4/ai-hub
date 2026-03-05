---
description: "DDDに基づいて新規フルスタック機能の骨組みからデータベース、API、UIまでを一気貫通で構築するワークフロー"
---

# 🏗️ Workflow: Setup New Feature (新規機能スカフォールド)

このワークフローは、全く新しい機能（例：コメント機能、決済モジュール、ダッシュボード）をシステムに追加する際の、フルスタックのスキャフォールディング（足場作り）プロセスを定義します。

## 対象 (Target)
- 新しいビジネスドメイン（機能領域）の追加

## 手順 (Steps)

1. **ドメインモデリング (Strategic Design)**
   - ユーザーへの要件ヒアリングが終わったら、まず `docs/specs/` 配下に新機能のデータスキーマ設計（エンティティ、値オブジェクト、集約ルート）をMarkdownで記述する。
   - Supabaseのテーブル定義（CREATE TABLE, RLS, Trigger）を記述し、ユーザーの承認を得る。

2. **インフラ層の構築 (Database & API)**
   - 承認されたスキーマに基づき、Supabase DashboardのSQLエディタで実行するためのマイグレーションスクリプトを作成する。
   - Next.js側の `types/supabase.ts` に相当する型定義のアップデート手順を明記する。

3. **サーバーアクションの定義 (Server Actions)**
   - `src/actions/[featureName].ts` を作成する。
   - Zodを用いて入力スキーマを定義し、DBへの書き込み・読み込みを行う関数を `use server` で構築する（CRUD操作）。
   - すべてのActionにおいて、冒頭でのユーザー認証（セッションチェック）を実装する。

4. **UIの骨組み作成 (UI Scaffolding)**
   - `src/app/[featureName]/page.tsx` をServer Componentとして作成し、データフェッチロジックを実装する。
   - `src/components/[featureName]/` 配下に、データを表示するClient Component（フォーム、ダイアログ等）の空の枠（Stub）を作成する。

5. **結合のテストと完了報告**
   - サーバーとクライアントの接続が取れることを確認し、エンドツーエンドでの動作フローをMarkdown（Walkthrough）として整理し、ユーザーに引き渡す。
