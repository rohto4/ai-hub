# 次セッション引継ぎプロンプト

以下をそのまま次セッションの冒頭に貼る想定。

```text
まず以下のファイルを順番に読んでください（参照のみ、変更不可）。
日本語ファイルは必ず UTF-8 前提で読んでください。

1. docs/guide/codex/AGENTS.md
2. docs/guide/COMMON.md
3. docs/guide/PROJECT.md
4. docs/imp/imp-hangover.md
5. docs/imp/imp-status.md
6. docs/imp/implementation-plan.md
7. docs/imp/implementation-checklist.md
8. docs/imp/implementation-wait.md
9. docs/imp/data-flow.md
10. docs/spec/04-data-model-summary.md
11. agents-task-status.md

読了後、最初に以下を短く整理してください。
- 実装予定範囲
- 直近で最優先の確認対象
- 未解決タスク
- 今は触らないもの
- 直近セッションの運用判断注意点

補足:
- この段階ではコード変更・DB変更・バッチ実行はしないでください
- 特に enrich 系ジョブは、件数・影響・Gemini API 負荷を確認してから提案してください
- Mermaid 図が必要になった場合だけ docs/imp/flowchart.md を追加で参照してください
- DB の詳細列や migration を触る必要が出た場合だけ docs/spec/04-data-model-and-sql.md 本文を追加で参照してください
```

## 補足

- 初回読込から `screen-flow.md` を外し、必要時だけ `flowchart.md` を読む前提
- `04-data-model-and-sql.md` 本文の代わりに `04-data-model-summary.md` を初回読込対象にした
- `imp-status` と `agents-task-status` は圧縮済みだが、さらに重くなったら再度見直す
