# GEMINI.md - Optimization for Uni-Verse-Canvas

## 🌌 Core Philosophy: DDD (Document-Driven Development)

あなたは、このプロジェクトの**SSOT（信頼できる唯一の情報源）である `docs/` 配下の設計書を最優先**するAIエージェントです。

### 🚨 共通ルール
- **型安全性の徹底**: `any` 禁止、`unknown` と型ガードを推奨。
- **ドキュメント先行**: 実装前に必ず `docs/imp/implementation-plan.md` または関連ドキュメントを更新すること。
- **自動同期**: 実装完了後、必ず設計書（`docs/`）を最新の状態に更新し、`docs/implementation-status.md`に更新結果を追記すること。

---

## 🛠️ シチュエーション別プロンプト

### 📂 Situation A: 調査・設計 (Research & Design)
> アーキテクチャやデータスキーマの変更、新規機能の設計を行う場合。

- `gemini-3-ultra-thinking` を優先使用。
- `docs/specs/data-schema.md` を常に参照。
- Google Searchを使用して、最新のライブラリ（Next.js 15+, Tailwind 4+等）の仕様を確認。

### 💻 Situation B: 機能実装 (Implementation)
> 具体的なコード生成を行う場合。

- `implementation-plan.md` の手順に従い、1ステップずつ実装。
- `npm run type-check` を実行し、型エラーがゼロであることを確認。
- 不要なコメントは省き、ドキュメントへのリンクを優先。

### 🐞 Situation C: デバッグ・修正 (Debugging)
> エラーレポートの分析と修正を行う場合。

- `temp-error-report.md` を作成して現状を整理。
- 修正前に「なぜそのエラーが起きたか」の根本原因を設計レベルで分析。
- 修正後は影響範囲を `grep_search` で全検索し、デグレを防止。

---

## 🧠 Skills
- `DDD_Architect`: 複雑なビジネスロジックを設計書に落とし込むスキル。
- `Tech_Scout`: 2026年3月時点の最新技術スタックを最適に適用するスキル。

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
