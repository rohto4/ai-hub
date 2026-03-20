# CLAUDE.md - Claude Code 運用方針

最終更新: 2026-03-20

> 共通ルール（文字コード・docs 更新・コメント・タスク完了/中断・委託時の指示）は
> [`docs/guide/COMMON.md`](../COMMON.md) を参照。
> このファイルは Claude Code 固有の設定・ECC エージェント活用に絞る。

---

## 1. 基本姿勢

1. 大きなコンテキストを扱える前提で、状況整理と検証結果を丁寧に残す。
2. Document-Driven Development を徹底し、実装変更に追随して `docs/` を更新する。
3. 進捗、判断、未解決事項、引き継ぎ事項は `docs/imp/` に集約する。
4. `docs/guide`、`docs/spec`、`docs/imp` の役割を混同しない。

---

## 2. ECC エージェント活用方針

### 2.1 プロアクティブなエージェント起動

以下の条件では、ユーザーが指示しなくても自律的にエージェントを起動する：

| 条件 | 起動エージェント |
|---|---|
| 複雑な機能実装・リファクタリング | `planner` |
| コード記述・変更後 | `code-reviewer` |
| 新機能実装・バグ修正 | `tdd-guide` |
| アーキテクチャ判断 | `architect` |
| コミット前（認証・入力処理・API 実装） | `security-reviewer` |
| ビルドエラー発生時 | `build-error-resolver` |
| TypeScript エラー発生時 | `build-error-resolver` |

### 2.2 並列エージェント実行

独立したタスクは **必ず並列** で実行する。

```
# 良い例：並列実行
1 つのメッセージで複数エージェントを同時起動:
- Agent 1: セキュリティ監査（auth モジュール）
- Agent 2: パフォーマンスレビュー（キャッシュ層）
- Agent 3: 型チェック（ユーティリティ関数）

# 悪い例：不必要な直列実行
Agent 1 が終わってから Agent 2 を起動（依存がない場合）
```

### 2.3 Agent ツールの委託ルール

サブエージェントに実装を委託する場合、プロンプトに **必ず** 以下を含める：

```
実装完了後、同一ターンで以下を更新すること：
- docs/imp/ 配下の該当ファイル（実装反映・残件・判断待ち）
- 仕様変更があれば docs/spec/ 配下も
```

サブエージェントはプロジェクト固有のルールを持たないため、明示しない限り docs は更新されない。

### 2.4 Task ツールによる進捗追跡

複数ステップのタスクでは TaskCreate / TaskUpdate を積極的に使う：

- タスク開始時: `TaskCreate` でステップを分解して登録
- ステップ着手時: `TaskUpdate` で `in_progress` に更新
- ステップ完了時: `TaskUpdate` で `completed` に更新
- 中断時: 現在のステップを `in_progress` のまま残し、`imp-hangover.md` に補足

### 2.5 Skill ツール（スラッシュコマンド）

`docs/guide/README.md` に記載の 16 スラッシュコマンドは Skill ツールで起動する。
ユーザーが `/deep-research` 等を指示した場合、Skill ツールで対応する workflow を呼び出す。

---

## 3. このプロジェクト固有の技術補足

1. Neon + Firebase 構成なので、Supabase 前提の `auth.uid()` ベース RLS 説明は採用しない。
2. 認証付き所有者判定が必要な場合は、Firebase Admin SDK で UID 検証後にアプリ層でチェックする。
3. Next.js 15 Server Actions では、回復可能な入力エラーを `throw` しない（`return { error }` で返す）。

---

## 4. 補助資料

1. `docs/guide/README.md` と `docs/guide/PROJECT.md` を guide の基準点として扱う。
2. `docs/guide/.agent/` 配下の skills と workflows は必要時に参照するが、
   プロジェクト固有の判断はこの guide と `docs/spec` を優先する。
3. `docs/guide/COMMON.md` — 共通ルール（UTF-8 / docs 更新 / コメント / タスク管理）
