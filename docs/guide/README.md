# AI Agent Workspace Optimization - Master Cheat Sheet (マスターチートシート)

ここは、プロジェクトに参画する全てのエージェント（Gemini, Claude, Codex）が、一貫した行動規範とドメイン知識を共有するための **SSOT (唯一の信頼できる情報源)** です。

---

## 📚 ディレクトリ構造 (Directory Structure)

| Directory                  | 役割 (Purpose)                                                                                   |
| :------------------------- | :----------------------------------------------------------------------------------------------- |
| `.agent/skills/`           | 20以上の専門化されたAIペルソナ（フロントエンド、バックエンド、アーキテクチャ、品質管理等）を設定するプロンプト集 |
| `.agent/workflows/`        | 16の多段ステップSOPとスラッシュコマンド（例: `/deep-research` 等）を格納するエージェント起動領域      |
| `claude/`, `gemini/`, `codex/` | 各プラットフォーム（LLM）特有の制約や初期起動インプットを束ねたエントリポイント設定ファイル群             |

---

## 🦸 完全網羅： AI Skills 一覧 (All Agent Skills)

AIエージェントは、以下の「人格（ペルソナ）」をロードすることで、特定の分野で最高品質のコードを出力します。タスクに応じて適切なペルソナを利用してください。

| Skill Name                    | 専門領域 (Domain)         | 特徴 (Features)                                                              |
| :---------------------------- | :------------------------ | :--------------------------------------------------------------------------- |
| `UX_Innovator`                | User Experience           | 従来のレイアウトを破壊しつつ、直感的で流麗な「触りたくなる」UIを提案。マイクロインタラクションの極地を追求。 |
| `Tailwind_v4_Virtuoso`        | UI/UX Web Design          | プレーンな色を禁止し、Bento UIやGlassmorphism、Neumorphismなどの2026年最新トレンドを適用。 |
| `Animation_Choreographer`     | UI/UX Animation           | Framer Motionを駆使し、意味のあるトランジションやダイナミックなスクロール連動アニメーションを構築。 |
| `Accessibility_Advocate`      | Accessibility & WCAG      | セマンティックHTML、WAI-ARIA、コントラスト比の最適化を責務とし、誰もが使えるインクルーシブなUIを担保。 |
| `PencilMCP_Master`            | Visual Tool Integration   | MCPと連携し、描画や視覚的なフィードバックを元にピクセルパーフェクトなコンポーネントを再現する。 |
| `DDD_Architect`               | Software Architecture     | ドメインモデリングと「Document-Driven Development」を先導し、すべての開発作業の前にドキュメント（SSOT）を優先的に作成・更新させる統括者。 |
| `Supabase_Architect`          | Backend / Database        | PostgreSQL, RLS (Row Level Security), Auth機能を駆使し、DBレイヤーでの最小権限防御と型安全なBaaS基盤を構築。 |
| `Nextjs_Server_Action_Expert` | React & Next.js           | Next.js 15+のServer Actions、React 19のフック、RSC構成を完璧に理解し、セキュアなサーバー通信と楽観的UI更新を実装。 |
| `State_Management_Pro`        | Global State Management   | Redux, Zustand, Jotai等の最適な状態管理ツールを選定し、不要な再レンダリングを防ぐ効率的なデータフローを構築。 |
| `Type_Safety_Enforcer`        | TypeScript & Zod          | `any`を絶対に許さず、ジェネリクスやUtility Typesを使った高度な型定義とZodスキーマによる堅牢な入力バリデーションを適用。 |
| `Test_Driven_Developer`       | Testing                   | VitestやPlaywrightを用いて、実装前に境界値や異常系シナリオを満たすユニットテスト/E2Eテストを作成。 |
| `Code_Reviewer`               | Code Quality              | 常に疑いの目を持ち、DRY/KISS/SOLID原則に基づいてPull Requestレベルの厳しくも建設的なフィードバックを提供する。 |
| `Security_Auditor`            | Security                  | OWASP Top 10に基づく脆弱性診断（XSS, CSRF, SQLi等）を実施し、プロジェクトの防壁を極限まで高める。 |
| `Performance_Tuner`           | Web Vitals Optimization   | LCP, CLS, INPなどのCore Web Vitals指標を監視・改善し、バンドルサイズの削減とロードの高速化を図る。 |
| `Refactoring_Specialist`      | Technical Debt            | 肥大化したコードや技術的負債を検知し、Design Patternsを適用して保守性の高いアーキテクチャへ再構築する。 |
| `Agent_Coordinator`           | Multi-Agent Orchestration | 複数のエージェント（プラットフォーム）間のタスク分割と連携を最適化し、チーム全体の開発生産性を最大化する。 |

---

## ⚡ 完全網羅： スラッシュコマンド（Workflows）一覧 (All Slash Commands)

以下のコマンドを入力するだけで、エージェントが定義された多段ステップSOP（Standard Operating Procedure）を起動・実行します。

| Command                  | 動作 (Action)                                                                               |
| :----------------------- | :------------------------------------------------------------------------------------------ |
| `/setup-new-feature`     | DDDに基づき、新規機能の骨格（DBスキーマ定義からAPI層、表示用Client Componentの実装まで）を一気貫通でスキャフォールディングする。 |
| `/scaffold-api`          | Next.js Route Handlers (API Routes) や外部APIハブの雛形を型安全なZodスキーマ付きで自動生成する。 |
| `/full-stack-feature`    | フロントからバックエンドまで、垂直に貫かれるユーザー機能（エンドツーエンドの実装）を一括生成・テストする。 |
| `/design-component`      | 対象のReactコンポーネントを、最新のTailwind v4トレンドやBento UIデザインに合わせて極上リデザインする。 |
| `/generate-schema`       | 会話の文脈や既存のTypeScript型定義から、堅牢で再利用性の高いZod入力バリデーションスキーマを生成・適用する。 |
| `/refactor-component`    | 肥大化したReactコンポーネントをSRP（単一責任の原則）とNext.jsのCompositionパターンに則って安全に解体・再構築する。 |
| `/update-docs`           | 実装されたソースコードの現状をリバースエンジニアリングし、`docs/` 配下の公式ドキュメント（SSOT）を寸分狂わず最新状態に同期させる。 |
| `/explain-architecture`  | 複雑なリポジトリ構造、ドメインモデリング、特定の機能領域のアーキテクチャを新規参画者にも分かりやすく噛み砕いて解説する。 |
| `/review-pr`             | 直近のコミット差分、または現在ステージされている領域をソースコード規約・DDD原則に基づいて人間と同等の精度でレビューする。 |
| `/review-ux`             | プロダクトのUI美観、レスポンシブ崩れ、WCAGアクセシビリティ対応状況、インタラクション品質を多角的に厳格監査・修正提案する。 |
| `/audit-security`        | Server ActionsおよびAPIルートにおいて、OWASP準拠の厳格なセキュリティ監査（認証・認可フローや入力検証チェック）を実施する。 |
| `/fix-type-errors`       | プロジェクト全体のTypeScript（暗黙的/明示的な`any`を含む）起因の警告やZodエラーを完全に撲滅し、型安全を証明する。 |
| `/optimize-performance`  | Reactの不要な再レンダリングやLCPのボトルネックを特定し、Core Web Vitalsのスコアを改善するための最適化パッチを適用する。 |
| `/write-tests`           | 実装済みの既存機能に対して、境界値チェック、異常系ハンドリング、期待される動作挙動を網羅するテストコード（Unit/E2E）を生成する。 |
| `/deploy-prep`           | 本番環境デプロイ前の最終チェックフロー。ビルドエラー、未使用インポート、リンター警告、各種パフォーマンス指標の直前自動検証を行う。 |
| `/deep-research`         | **[NEW]** 既存の調査結果や実装計画に対し、Web検索を駆使して最新情報を深く検証し、抜け漏れを補完して品質を極限まで引き上げる。 |

---

## 🚨 共通の絶対ルール (Global Directives)

1. **ドキュメント・ファースト (Documentation First)**: 
   コードを書く前に必ず `docs/imp/implementation-plan.md` を作成・更新して承認を得ること。これがこのチームにおける SSOT（単一の信頼できる情報源）である。
2. **型安全性の徹底 (Strict Type Safety)**: 
   `any` や `@ts-ignore` の使用は厳禁。不明なデータ構造には `unknown` と型ガード（または Zod バリデーション）を併用すること。
3. **退屈なデザインの絶対禁止 (Ban Bland Designs)**: 
   純色ベタ塗り（#FFFFFFや#000000など）を避け、HSLカラーパレット、Glassmorphism、繊細なDrop Shadowを用いた 「ユーザーが感動する Spatial UI」 を心がけること。
4. **セキュリティのデフォルト化 (Secure by Default)**:
   データベースレイヤーにおいてはRLS（Row Level Security）を必ず有効にし、すべてのクライアント入力は必ずサニタイズ・バリデートすること。
