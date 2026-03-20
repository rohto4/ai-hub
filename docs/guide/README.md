# AI Trend Hub - プロジェクトガイド

最終更新: 2026-03-21

汎用スキル・コマンドは Everything Claude Code（ECC）が提供する `~/.claude/` に委譲する。
このディレクトリはこのプロジェクト固有の情報だけを管理する。

---

## ドキュメント構成

| ファイル | 役割 |
| :--- | :--- |
| `PROJECT.md` | AI Trend Hub 固有の恒久ルール（ToS・ソース方針・Home 実装方針） |
| `COMMON.md` | 全エージェント共通ルール（UTF-8・docs 更新・コメント・タスク管理） |
| `claude/CLAUDE.md` | Claude Code 固有設定・ECC エージェント活用方針 |
| `codex/AGENTS.md` | Codex 固有設定・Human-in-the-Loop |
| `codex/copilot-instructions.md` | GitHub Copilot 向け設定 |
| `gemini/GEMINI.md` | Gemini 固有設定 |

---

## プロジェクト固有スキル（`.agent/skills/`）

ECC では補えないこのプロジェクト固有の専門スキル。

| スキル | 用途 |
| :--- | :--- |
| `Neon_Architect` | Neon (PostgreSQL) + Firebase Auth の DB 設計・unnest bulk upsert・接続使い分け |
| `Nextjs_Server_Action_Expert` | Next.js 15 Server Actions の固有ルール（`return { error }` パターン等） |
| `Tailwind_v4_Virtuoso` | Tailwind v4 + Bento UI によるこのプロジェクトのデザイン方針 |
| `PencilMCP_Master` | Pencil MCP を使ったデザイン生成・検証 |

---

## プロジェクト固有ワークフロー（`.agent/workflows/`）

| ワークフロー | 用途 |
| :--- | :--- |
| `refactor-summary` | リファクタリング進捗を行数中心の表で要約する |

---

## ECC スキル・コマンド（`~/.claude/` 配下）

汎用スキルは ECC に委譲済み。Claude Code では `/command-name` で呼び出せる。
Codex では `AGENTS.md`（プロジェクトルート）経由でアクセスする。

よく使うもの：

| コマンド | 用途 |
| :--- | :--- |
| `/code-review` | コードレビュー（typescript-reviewer agent） |
| `/tdd` | テスト駆動開発ワークフロー |
| `/plan` | 実装計画作成 |
| `/audit-security` | セキュリティ監査 |
| `/context-budget` | コンテキスト使用量分析 |
| `/verify` | ビルド・型チェック・テストの検証ループ |

全コマンドは `~/.claude/commands/` を参照。

---

## 共通の絶対ルール

1. **ドキュメント・ファースト**: コード実装前に `docs/imp/` で設計承認を得る
2. **型安全性の徹底**: `any` / `@ts-ignore` 禁止
3. **セキュリティのデフォルト化**: RLS 有効・入力検証必須
4. **商用利用の確認**: 新規ソース追加時は ToS 再確認し `observed_article_domains.commercial_use_policy` を更新する
