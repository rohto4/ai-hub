# AGENTS.md - Codex Agent Optimization

## 🚀 High-Autonomy Mode
以下の条件では、ユーザーの明示的な承認を待たずに作業を進める（Agentic Memoryを活用）：
- リファクタリング（変数名変更、等価なコードへの変換）
- ドキュメントの微修正
- 型エラーの修正（論理が変わらない範囲）

## ⚠️ Human-In-The-Loop
以下の場合は、必ず `AGENTS.md` のステップに従い、ユーザーに確認を求める：
- 新規依存ライブラリの追加
- `docs/spec/04-data-model-and-sql.md` の破壊的な変更
- `docs/guide/codex/AGENTS.md` の根本的なルール変更

---

## 🕒 Agentic Memory (March 2026 Preview)
- 過去のセッションでの命名規則や好みのUIパターンを積極的に学習し、適用すること。
- Repository-specific insights を `AGENTS.override.md` に蓄積していくこと。

---

## 🌐 Global Agent Skills & Workflows
必ずワークスペースのルートにある `.agent/` ディレクトリを確認してください。
ここには16のSkillsと、16のSlash Commands (Workflows) が格納されており、すべてのエージェントで共有されるべき強力なツールキットです。
**タスクを実行する際は、自身の判断だけでコードを書くのではなく、必ず以下のステップを踏んでください：**
1. ユーザーの指示内容から、適用すべきスキルやワークフロー（SOP）を特定する。
2. `.agent/workflows/` 配下の該当SOPファイル（例: `design-component.md` 等）を**実際に読み込む（参照する）**。
3. 読み込んだSOPに記載されたステップと品質基準を厳格に守ってタスクを遂行する。
各コマンドの概要は `README.md` を参照してください。
---

## ⚡ Proactive Workflow & Strict DDD Enforcement (絶対遵守)

1. **Auto-Trigger Commands (ワークフローの自発的起動)**:
   ユーザーの指示が `.agent/workflows/` 内のSOPの意図に合致する場合、明示的なスラッシュコマンドが存在しなくても、**エージェント自らが該当SOPをロードして実行に移ること**。
2. **Forward-Moving DDD (実装と設計の双方向同期)**:
   - **設計先行（デフォルト）**: ユーザーと実装方針を合意したら、直ちにコードは書かず、必ず `docs/imp/implementation-plan.md` にタスクを蓄積し、その計画に沿って着実にコーディングを進めること。
   - **実装先行（アジャイル対応）**: スピード優先でユーザーから直接ソース編集の指示を受け、先行してコードを書き換えた場合は、**事後速やかにその変更内容を `docs/` 配下の仕様書や実装計画へ逆同期（反映）させること**。決してソースとドキュメントを乖離させたままタスクを終えないこと。
