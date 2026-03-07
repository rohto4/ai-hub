# GitHub Copilot / Codex Instructions

## 🏗️ Architectural Guiding Principles
- **Pattern**: Next.js App Router + shadcn/ui.
- **Data Flow**: Server Actions for mutations, Neon (PostgreSQL) via Route Handlers for data fetching. Auth via Firebase Admin SDK.
- **Conventions**: 
  - Components go in `src/components/`.
  - Server Actions go in `src/lib/actions/`.
  - Types go in `src/types/`.

## 🛠️ Coding Rules
- Use `lucide-react` for icons.
- Use `npm run type-check` to verify changes.
- Ensure all new pages are placed under the appropriate route group `(admin)` or `(public)`.

## 🤖 Agentic Behavior & Planning
- 実装を開始する前に **Planning Mode** を用い、提案フェーズを挟んでください。
- `docs/guides/AGENTS.md` に記載された DDD（ドメイン駆動設計）の哲学を遵守すること。
- 機能の実装後は、関連するドキュメント（`docs/`）の自動更新を徹底すること。

## 🌐 Global Agent Skills & Workflows
必ずワークスペースのルートにある `.agent/` ディレクトリを確認してください。
ここには16のSkillsと、16のSlash Commands (Workflows) が格納されています。
タスクを着手する前に、関連するSOP（例：UI修正なら `.agent/workflows/design-component.md`）を読み込み、その手順に必ず従ってください。

## ⚡ Proactive Workflow & Strict DDD Enforcement (絶対遵守)
1. **Auto-Trigger Commands**: ユーザーの指示がSOPの意図に合致する場合、明示的なスラッシュコマンドがなくても、自ら `.agent/workflows/` 内の該当ファイルを読んで実行に移ること。
2. **Forward-Moving DDD**:
   - 直接コードを書いた場合（インライン補完やチャットからの直接編集等）でも、事後速やかに変更内容を `docs/` の設計書や `implementation-plan.md` に逆同期（反映）させること。ソースとドキュメントを乖離させない。
