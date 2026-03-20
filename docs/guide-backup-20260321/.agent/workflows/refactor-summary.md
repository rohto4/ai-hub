---
description: "リファクタリングや整理作業の進捗を、行数中心の見やすい表で要約するための workflow"
---

# Workflow: Refactor Summary

リファクタリング後に「サマリ」を求められたときは、説明より先に、行数ベースで全体像が一目で分かる形にまとめる。

## Target
- 複数ファイルにまたがるリファクタリング
- 分割、統合、削除、barrel 化、責務分離
- docs 更新を含む進捗報告

## Output Rules

1. 全体はおおむね 20〜30 行に収める。
2. 可能な限り表を使う。
3. 文章要約は 5 行以内にする。
4. 長い絶対パスはそのまま表に入れず、短い識別名を優先する。
5. before / after が数値化できるものは必ず行数を出す。

## Primary Table Format

```text
| 区分 | 対象 | before | after | 要約 |
|---|---|---:|---:|---|
| Home | app/page.tsx | 715 | 65 | Home本体を shell のみに縮小 |
```

## Summary Table Format

```text
| 区分      | before合計 | after合計 | 増減 |
|-----------|-----------:|----------:|-----:|
| Home      | ...        | ...       | ...  |
| Public DB | ...        | ...       | ...  |
```

## Total Format

```text
| 総合計 | before合計 | after合計 | 増減 |
|--------|-----------:|----------:|-----:|
| Total  | ...        | ...       | ...  |
```

## Calculation Rules

1. 新規ファイルは `before = -` とする。
2. 削除ファイルは `after = 0` とする。
3. 区分別合計と総合計は、数値がある行だけで集計する。
4. before / after が両方数値のときだけ増減へ反映する。

## Recommended Categories

- Home
- Public DB
- Jobs
- Types
- Common
- Cleanup
- Feed
- Docs

## Closing Summary

最後に 3〜5 行で以下だけを述べる。

1. どの責務単位まで分割できたか
2. どの大きい塊がまだ残っているか
3. 次に着手するのが自然な対象
## Monospace Table Rule

1. サマリの表は Markdown table ではなく、必ず `text` コードブロック内の等幅表で出力する。
2. `|` で列を区切るだけでなく、桁をそろえて視覚的に読みやすい表に整える。
3. 主表、区分別合計、総合計のすべてにこのルールを適用する。

## Rendering Example

```text
| 区分      | 対象                | before | after | 要約                        |
|-----------|---------------------|-------:|------:|-----------------------------|
| Home      | app/page.tsx        |    715 |    65 | Home本体を shell のみに縮小 |
| Public DB | public-feed.ts      |    698 |    15 | 互換 barrel 化              |

| 区分      | before合計 | after合計 | 増減  |
|-----------|-----------:|----------:|------:|
| Home      |       1111 |       153 |  -958 |
| Public DB |        698 |        15 |  -683 |

| 総合計 | before合計 | after合計 | 増減   |
|--------|-----------:|----------:|-------:|
| Total  |       1809 |       168 | -1641  |
```
