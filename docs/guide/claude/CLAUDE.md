# CLAUDE.md - Memory & Context Management

## 🎯 Role & Objective
あなたは、大規模なコンテキストを効率的に管理し、検証（Verification）を重視するClaude Codeエージェントです。

---

## 🧠 Context Management

### 1. The 3 Pillars of Persistence
- `CLAUDE.md`: プロジェクト全体のルール、技術スタック、アーキテクチャ方針を記録。
- `plan.md`: 現在進行中の実装計画、タスクリスト、未解決の課題を記録。
- `notes.md`: 調査結果、APIレスポンスのサンプル、エラーログの分析結果を記録。

### 2. Session Hygiene
- 1つの大きなタスクが完了するたびに `/clear` を推奨。
- セッション開始時に必ず `plan.md` を読み込み、前回までの進捗を同期すること。

---

## 🛠️ Verification-First Workflow

### Logic Verification
コードを生成したら、必ず以下のXMLタグを使用して自己検証を行う。

<verification_checklist>
- [ ] 型エラーがゼロであること (`npm run type-check`)
- [ ] エッジケース（null/undefined処理）を考慮しているか
- [ ] バグが発生した際の影響範囲が特定されているか
</verification_checklist>

---

## 🔀 Strategy by Situation

### [A] Research (notes.md)
調査時は `@` を使用して関連ファイルを明示し、複雑な調査は専用の `subagent` に任せること。

### [B] Coding (plan.md)
`plan.md` に基づいたステップバイステップの実行。1ステップごとに `git commit` を行う。

### [C] Debugging (temp-error-report.md)
エラー発生時は、直接修正せず、まず `temp-error-report.md` を作成して根本原因を分析すること。

---

## 🚀 2026 Core Tech Directives (Deep Research Additions)
最新のWeb検証に基づく、Claudeエージェントが順守すべき技術基準です。

1. **Next.js 15 Server Actions**
   - バリデーションエラーは `throw` せず、状態として `return { error: '...' }` を返す。
   - クライアント側で `useActionState` を用いて、エラーをインラインで即座に表示させること。
2. **Tailwind v4 & Spatial UI**
   - v4 の 3D transform ユーティリティを利用し、ペタンコのUIを避けてZ軸の奥行き（Spatial UI）を表現する。
   - `col-span-` や `row-span-` を駆使したBento Gridレイアウトを積極的に提案する。
3. **Supabase RLS 究極の最適化**
   - ポリシーの `USING` 句に含まれるカラム（`user_id` 等）には**必ずインデックスを付与**する（100倍のパフォーマンス向上）。
   - ポリシー内で `auth.uid()` を呼ぶ際は `(SELECT auth.uid())` とラップし、PGキャッシュを効かせること。

---

## 🌐 Global Agent Skills & Workflows
必ずワークスペースのルートにある `.agent/` ディレクトリを確認してください。
ここには16のSkillsと、16のSlash Commands (Workflows) が格納されており、すべてのエージェントで共有されるべき強力なツールキットです。
各コマンドの詳細は `README.md` を参照してください。

---

## ⚡ Proactive Workflow & Strict DDD Enforcement (絶対遵守)

1. **Auto-Trigger Commands (ワークフローの自発的起動)**:
   ユーザーの指示が `.agent/workflows/` 内のSOP（例: UI修正なら `/design-component`）の意図に合致する場合、ユーザーが明示的にスラッシュコマンドを入力しなくても、**エージェント自らが該当SOPをロードして実行に移ること**。
2. **Forward-Moving DDD (実装と設計の双方向同期)**:
   - **設計先行（デフォルト）**: ユーザーと実装方針を合意したら、直ちにコードは書かず、必ず `docs/imp/implementation-plan.md` にタスクを蓄積し、その計画に沿って着実にコーディングを進めること。
   - **実装先行（アジャイル対応）**: スピード優先でユーザーから直接ソース編集の指示を受け、先行してコードを書き換えた場合は、**事後速やかにその変更内容を `docs/` 配下の仕様書や実装計画へ逆同期（反映）させること**。決してソースとドキュメントを乖離させたままタスクを終えないこと。
