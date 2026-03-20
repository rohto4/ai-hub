# AGENTS.md - AI Trend Hub

Codex が新セッションで読む起点ファイル。

---

## 1. まず読むファイル

1. `docs/guide/codex/AGENTS.md` — 行動規範・DDD ルール・Human-in-the-Loop
2. `docs/guide/COMMON.md` — 全エージェント共通ルール
3. `docs/guide/PROJECT.md` — 恒久方針（ToS・ソース・Home 実装）
4. `docs/imp/imp-hangover.md` — 前セッション引き継ぎ
5. `agents-task-status.md` — 直近の作業記録

---

## 2. 技術スタック

- Next.js 15 (App Router) + TypeScript (strict)
- Neon (serverless PostgreSQL 16) + Firebase Auth
- Tailwind v4 / Gemini Flash API / Vercel Cron

---

## 3. 利用可能なスキル

### プロジェクト固有スキル（このリポジトリ内）

| スキル | パス |
| :--- | :--- |
| Neon_Architect | `docs/guide/.agent/skills/Neon_Architect.md` |
| Nextjs_Server_Action_Expert | `docs/guide/.agent/skills/Nextjs_Server_Action_Expert.md` |
| Tailwind_v4_Virtuoso | `docs/guide/.agent/skills/Tailwind_v4_Virtuoso.md` |
| PencilMCP_Master | `docs/guide/.agent/skills/PencilMCP_Master.md` |

### ECC グローバルスキル（ユーザーホーム配下）

スキルファイルを読んでペルソナや手順を取得できる。

| 用途 | パス |
| :--- | :--- |
| TypeScript コードレビュー | `C:/Users/unibe/.claude/skills/typescript-reviewer/SKILL.md` |
| セキュリティ監査 | `C:/Users/unibe/.claude/skills/security-reviewer/SKILL.md` (agent) |
| TDD ワークフロー | `C:/Users/unibe/.claude/skills/tdd-workflow/SKILL.md` |
| API 設計 | `C:/Users/unibe/.claude/skills/api-design/SKILL.md` |
| フロントエンドパターン | `C:/Users/unibe/.claude/skills/frontend-patterns/SKILL.md` |
| バックエンドパターン | `C:/Users/unibe/.claude/skills/backend-patterns/SKILL.md` |
| コーディング標準 | `C:/Users/unibe/.claude/skills/coding-standards/SKILL.md` |
| コンテキスト最適化 | `C:/Users/unibe/.claude/skills/context-budget/SKILL.md` |

### ECC コマンド（`~/.claude/commands/`）

| コマンド名 | パス |
| :--- | :--- |
| code-review | `C:/Users/unibe/.claude/commands/code-review.md` |
| tdd | `C:/Users/unibe/.claude/commands/tdd.md` |
| plan | `C:/Users/unibe/.claude/commands/plan.md` |
| verify | `C:/Users/unibe/.claude/commands/verify.md` |

ユーザーが `/コマンド名` を指示したときは、対応する `.md` を読んで手順に従う。

---

## 4. プロジェクト固有ワークフロー

| ワークフロー | パス | 用途 |
| :--- | :--- | :--- |
| refactor-summary | `docs/guide/.agent/workflows/refactor-summary.md` | リファクタリング進捗サマリ |

---

## 5. 重要な制約（変更禁止）

- `docs/spec/04-data-model-and-sql.md` の破壊的変更 → ユーザー確認必須
- 新規依存パッケージ追加 → ユーザー確認必須
- `scripts/backup-neon-all.mjs` → 触らない
- `vercel.json` / GitHub Actions → 触らない
