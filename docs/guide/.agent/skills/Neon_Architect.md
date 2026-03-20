---
name: "Neon Architect"
description: "Neon (serverless PostgreSQL) + Firebase Auth の構成で、型安全・パフォーマンス・セキュリティを備えた DB 基盤を構築する専門家"
author: "AI Backend Engineering Team"
version: "1.0.0"
category: "Backend & Architecture"
---

# Neon Architect（Neon + Firebase 基盤設計スペシャリスト）

このプロジェクト（AI Trend Hub）は **Neon (serverless PostgreSQL) + Firebase Auth** の構成を採用している。
Supabase の `auth.uid()` ベース RLS は使用しない。

---

## コア哲学

1. **Database as the Source of Truth**
   データ不整合を防ぐため、アプリ側バリデーションだけに頼らない。
   DB レベルで `NOT NULL` / `UNIQUE` / `CHECK` 制約・外部キー制約を設定し、物理レイヤーで守る。

2. **RLS は必要最小限で適用する**
   このプロジェクトでの RLS は Supabase 型ではなく、PostgreSQL 標準の行レベルセキュリティ。
   公開読取テーブル（`public_articles` 等）は SELECT のみ許可し、書込は DB ユーザー制御で守る。

3. **接続の使い分け**
   - `DATABASE_URL` (pooled): アプリ本体・API ルート（Vercel 上の serverless 関数）
   - `DATABASE_URL_UNPOOLED` (direct): migration・バッチスクリプト・pg_dump

4. **認証は Firebase Admin SDK で行う**
   `firebase-admin` で ID Token を検証し、UID を取得してアプリ層で所有者チェックを行う。
   DB レベルでは `auth.uid()` 関数は存在しない（Supabase でない）。

5. **型安全は Neon + TypeScript で担保**
   `postgres.js` ライブラリ + 手書き TypeScript 型定義でクエリを型安全に保つ。
   `any` は禁止。不明な構造には `unknown` + 型ガードを使う。

---

## テクノロジースタック

| 要素 | 採用技術 |
|---|---|
| DB | Neon (serverless PostgreSQL 16) |
| ORM/Client | `postgres.js` (pooled) / `pg_dump` (backup) |
| 認証 | Firebase Auth (Admin SDK + Client SDK) |
| Migration | 連番 SQL ファイル (`scripts/migrations/NNN-*.sql`) |
| バックアップ | `pg_dump -Fc` via `scripts/backup-neon-all.mjs` |
| ベクトル検索 | `pgvector` (`vector(1536)`) |

---

## 実装ガイドライン

### スキーマ設計

```sql
-- 良いスキーマ例（このプロジェクトの規約）
CREATE TABLE public_articles (
  public_article_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enriched_article_id bigint NOT NULL REFERENCES articles_enriched(enriched_article_id),
  public_key         text NOT NULL UNIQUE,                    -- nanoid(11)
  canonical_url      text NOT NULL,
  display_title      text NOT NULL,
  visibility_status  text NOT NULL DEFAULT 'published'
                     CHECK (visibility_status IN ('published','hidden','suppressed')),
  source_type        text NOT NULL
                     CHECK (source_type IN ('official','blog','news','paper','alerts','video')),
  commercial_use_policy text NOT NULL DEFAULT 'permitted'
                     CHECK (commercial_use_policy IN ('permitted','prohibited','unknown')),
  created_at         timestamptz NOT NULL DEFAULT now()
);
```

### 接続パターン

```typescript
// アプリ層（pooled 接続）
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!);

// バッチ・migration（direct 接続）
const sql = postgres(process.env.DATABASE_URL_UNPOOLED!);
```

### Firebase 認証付きアクセス制御

```typescript
// Server Action での認証例
import { getAuth } from 'firebase-admin/auth';

export async function requireAuth(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');
  const decoded = await getAuth().verifyIdToken(token);
  return decoded.uid;
}
```

### bulk upsert パターン（unnest ベース）

```sql
-- postgres.js での bulk upsert（このプロジェクトの実績パターン）
INSERT INTO public_articles (public_key, display_title, ...)
SELECT * FROM UNNEST(
  $1::text[],
  $2::text[],
  ...
) AS t(public_key, display_title, ...)
ON CONFLICT (public_key) DO UPDATE SET
  display_title = EXCLUDED.display_title,
  ...
```

---

## このプロジェクト固有のルール

1. `hourly-publish` は 200 件チャンクで bulk upsert し、失敗時は 10 件→1 件のフォールバック。
2. `commercial_use_policy = 'prohibited'` の記事は publish 時にフィルタして公開しない。
3. `articles_enriched` は prohibited でも保持する（非商用用途のために残す）。
4. 新規ソース追加時は `commercial_use_policy` を必ず設定し、`observed_article_domains` に ToS 調査結果を記録する。
5. `DATABASE_URL` 未設定でもアプリ全体は起動可能にする。DB 必須 API は `503` を返す。

---

## アンチパターン

- `auth.uid()` を PostgreSQL ポリシーで使う（Supabase ではないので存在しない）
- `service_role` キーの概念でフロントから直接 DB アクセス（Firebase Auth + Admin SDK で制御する）
- pooled 接続で migration を実行（direct 接続 `DATABASE_URL_UNPOOLED` を使う）
- `(sql as any)(rows, ...cols)` 構文（postgres.js 専用のため移植性がない。`unnest` 方式を使う）
