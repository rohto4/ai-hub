# GitHub Copilot / Codex Instructions

## Architectural Guiding Principles

- Pattern: Next.js App Router + shadcn/ui
- Data Flow: Server Actions for mutations, Neon (PostgreSQL) をサーバー側から参照し、認証が必要な処理は Firebase Admin SDK 前提で扱う
- Conventions:
  - Components go in `src/components/`
  - Server Actions go in `src/lib/actions/`
  - Types go in `src/types/`

## Coding Rules

- Use `lucide-react` for icons
- Use `npm run type-check` to verify changes
- Ensure all new pages are placed under the appropriate route group `(admin)` or `(public)`

## Agentic Behavior & Planning

- 実装前に関連する guide / spec / imp を確認する
- `docs/guide/codex/AGENTS.md` の DDD 方針に従う
- 機能実装後は関連する `docs/` を更新する

## Global Agent Skills & Workflows

- `.agent/` 配下の skills / workflows を必要に応じて参照する
- SOP がある作業は、対応する workflow を先に確認する
