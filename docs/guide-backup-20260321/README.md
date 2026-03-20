# AI Agent Workspace - マスターガイド

最終更新: 2026-03-20

ここは、このプロジェクトに参画する全エージェント（Gemini, Claude, Codex）が
一貫した行動規範とドメイン知識を共有するための **SSOT** です。

---

## ディレクトリ構造

| パス | 役割 |
| :--- | :--- |
| `docs/guide/COMMON.md` | 全エージェント共通ルール（UTF-8・docs 更新・コメント・タスク管理） |
| `docs/guide/PROJECT.md` | AI Trend Hub 固有の恒久ルール（ToS・ソース方針・Home 実装方針） |
| `docs/guide/claude/CLAUDE.md` | Claude Code 固有設定・ECC エージェント活用方針 |
| `docs/guide/codex/AGENTS.md` | Codex 固有設定・Human-in-the-Loop・agents-task-status |
| `docs/guide/gemini/GEMINI.md` | Gemini 固有設定 |
| `docs/guide/.agent/skills/` | 専門 AI ペルソナ 16 種のプロンプト集 |
| `docs/guide/.agent/workflows/` | スラッシュコマンド対応 SOP 16 種 |

---

## プロジェクト固有ガイド

- [`PROJECT.md`](./PROJECT.md) — 恒久ルール（ToS 調査結果・ソース方針・Home 実装方針）

---

## ECC エージェント戦略（Claude Code 向け）

### プロアクティブなエージェント起動（指示不要）

| 条件 | 起動エージェント |
|---|---|
| 複雑な機能実装・リファクタリング | `planner` |
| コード記述・変更後 | `code-reviewer` |
| 新機能実装・バグ修正 | `tdd-guide` |
| アーキテクチャ判断 | `architect` |
| コミット前（認証・入力処理・API） | `security-reviewer` |
| ビルド・TypeScript エラー発生時 | `build-error-resolver` |

### 並列エージェント実行（必須）

独立したタスクは 1 つのメッセージで複数エージェントを同時起動する：

```
# 並列実行の例
- Agent 1: 認証モジュールのセキュリティ監査
- Agent 2: キャッシュ層のパフォーマンスレビュー
- Agent 3: ユーティリティ関数の型チェック
→ 3 エージェントを同じターンで起動する
```

---

## AI Skills 一覧

タスクに応じて適切なペルソナをロードすることで、特定分野で高品質なコードを出力します。

| Skill | 専門領域 | 特徴 |
| :--- | :--- | :--- |
| `UX_Innovator` | User Experience | 直感的で流麗な「触りたくなる」UI を提案。マイクロインタラクション重視。 |
| `Tailwind_v4_Virtuoso` | UI/UX Web Design | Bento UI・Glassmorphism・Neumorphism など 2026 年最新トレンドを適用。 |
| `Animation_Choreographer` | UI/UX Animation | Framer Motion による意味のあるトランジションとスクロール連動アニメーション。 |
| `Accessibility_Advocate` | Accessibility / WCAG | セマンティック HTML・WAI-ARIA・コントラスト比の最適化でインクルーシブな UI を担保。 |
| `PencilMCP_Master` | Visual Tool Integration | Pencil MCP と連携し、視覚フィードバックからピクセルパーフェクトなコンポーネントを再現。 |
| `DDD_Architect` | Software Architecture | Document-Driven Development を先導し、実装前に必ず SSOT を更新させる統括者。 |
| `Neon_Architect` | Backend / Database | Neon (PostgreSQL)・RLS・Firebase Auth を組み合わせた最小権限防御と型安全な DB 基盤。※旧 Supabase_Architect を置換 |
| `Nextjs_Server_Action_Expert` | React / Next.js | Next.js 15+ Server Actions・React 19 フック・RSC 構成を完全理解。セキュアなサーバー通信と楽観的 UI 更新を実装。 |
| `State_Management_Pro` | Global State | Zustand・Jotai 等の最適な状態管理を選定し、不要な再レンダリングを防ぐ効率的なデータフローを構築。 |
| `Type_Safety_Enforcer` | TypeScript / Zod | `any` を絶対に許さず、ジェネリクス・Utility Types・Zod スキーマで堅牢な入力バリデーションを適用。 |
| `Test_Driven_Developer` | Testing | Vitest・Playwright を使い、実装前に境界値・異常系シナリオを満たすユニット/E2E テストを作成。 |
| `Code_Reviewer` | Code Quality | DRY/KISS/SOLID 原則に基づいて PR レベルの厳しくも建設的なフィードバックを提供。 |
| `Security_Auditor` | Security | OWASP Top 10 に基づく脆弱性診断（XSS・CSRF・SQLi 等）でプロジェクトの防壁を強化。 |
| `Performance_Tuner` | Web Vitals | LCP・CLS・INP を監視・改善し、バンドルサイズ削減とロード高速化を図る。 |
| `Refactoring_Specialist` | Technical Debt | 肥大化したコードと技術的負債を検知し、Design Patterns を適用して保守性の高いアーキテクチャへ再構築。 |
| `Agent_Coordinator` | Multi-Agent | 複数エージェント間のタスク分割と連携を最適化し、開発全体の生産性を最大化。 |

> **注意**: 旧 `Supabase_Architect` はこのプロジェクトでは使用しない。
> このプロジェクトは Neon (PostgreSQL) + Firebase Auth の構成。
> Supabase 前提の RLS (`auth.uid()`) は採用しない。

---

## スラッシュコマンド（Workflows）一覧

コマンド入力でエージェントが定義済み SOP を起動・実行します。

| コマンド | 動作 |
| :--- | :--- |
| `/setup-new-feature` | DDD に基づき、新規機能の骨格（DBスキーマ → API → Client Component）を一気通貫でスキャフォールディング。 |
| `/scaffold-api` | Next.js Route Handlers の雛形を型安全な Zod スキーマ付きで自動生成。 |
| `/full-stack-feature` | フロントからバックエンドまで垂直貫通するユーザー機能を一括生成・テスト。 |
| `/design-component` | 対象 React コンポーネントを Tailwind v4 最新トレンド・Bento UI でリデザイン。 |
| `/generate-schema` | 会話の文脈や既存の TypeScript 型定義から堅牢な Zod バリデーションスキーマを生成。 |
| `/refactor-component` | 肥大化した React コンポーネントを SRP と Next.js Composition パターンで安全に解体・再構築。 |
| `/update-docs` | 実装されたソースコードをリバースエンジニアリングし `docs/` を最新状態に同期。 |
| `/explain-architecture` | 複雑なリポジトリ構造・ドメインモデリング・アーキテクチャを新規参画者にも分かりやすく解説。 |
| `/review-pr` | 直近のコミット差分を DDD 原則に基づいて人間と同等の精度でレビュー。 |
| `/review-ux` | UI 美観・レスポンシブ崩れ・WCAG アクセシビリティ・インタラクション品質を多角的に監査。 |
| `/audit-security` | Server Actions と API ルートに OWASP 準拠のセキュリティ監査（認証・入力検証）を実施。 |
| `/fix-type-errors` | プロジェクト全体の TypeScript 警告と Zod エラーを完全に撲滅し、型安全を証明。 |
| `/optimize-performance` | React の不要な再レンダリングと LCP ボトルネックを特定し、Core Web Vitals を改善。 |
| `/write-tests` | 実装済み機能に対して境界値・異常系を網羅するテストコード（Unit/E2E）を生成。 |
| `/deploy-prep` | 本番デプロイ前の最終チェック（ビルドエラー・未使用インポート・リンター警告・パフォーマンス指標）。 |
| `/deep-research` | 既存の調査結果に対し Web 検索を駆使して最新情報を深く検証し、抜け漏れを補完。 |

---

## 共通の絶対ルール

1. **ドキュメント・ファースト**: コードを書く前に必ず `docs/imp/implementation-plan.md` を作成・更新して承認を得る。
2. **型安全性の徹底**: `any` / `@ts-ignore` 禁止。不明なデータ構造には `unknown` + 型ガード（または Zod）を使う。
3. **退屈なデザインの禁止**: HSL カラーパレット・Glassmorphism・繊細な Drop Shadow を用いた Spatial UI を心がける。
4. **セキュリティのデフォルト化**: RLS を有効にし、すべてのクライアント入力をサニタイズ・バリデートする。
5. **商用利用の確認**: 新規ソース追加・収益化機能追加時は必ず ToS を再確認し `observed_article_domains.commercial_use_policy` を更新する。

### 追記: サマリ用 workflow

- `docs/guide/.agent/workflows/refactor-summary.md`
  - リファクタリング進捗を、行数中心の表で要約する専用 workflow
  - `区分 / 対象 / before / after / 要約` の表を優先する
  - 末尾に区分別合計と総合計を付ける
