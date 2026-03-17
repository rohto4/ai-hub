export interface BatchSummaryPromptItem {
  id: string
  title: string
  content: string
  summaryInputBasis?: 'full_content' | 'source_snippet' | 'title_only'
}

function toPromptItem(item: BatchSummaryPromptItem): {
  id: string
  title: string
  content: string
  summaryInputBasis: 'full_content' | 'source_snippet' | 'title_only'
} {
  return {
    id: item.id,
    title: item.title,
    content: item.content.slice(0, 5000),
    summaryInputBasis: item.summaryInputBasis ?? 'full_content',
  }
}

export function buildEnrichBatchPrompt(items: BatchSummaryPromptItem[]): string {
  return `
あなたは AI Trend Hub の Layer2 要約生成オペレータです。
入力 JSON の各記事について、日本語要約を作成してください。

目的:
- Layer2 登録用の summary100 / summary200 を作る
- 元記事にない情報を加えない
- 誇張しない
- 日本語として自然で、そのまま公開面に載せられる品質にする

最重要ルール:
1. 出力は JSON のみ。説明文や前置きは不要。
2. 入力 item ごとに必ず 1 件だけ出力する。
3. id はそのまま返す。
4. summary100Ja, summary200Ja を必ず埋める。
5. summary100Ja は 100 文字以内。
6. summary200Ja は 200 文字以内。
7. 事実の追加・推測・一般論の補完は禁止。
8. 不要な英語は残さない。ただし固有名詞・製品名・企業名・ライブラリ名は原語維持を優先する。
9. 本文が十分にある場合は本文優先で要約する。
10. 本文が乏しい場合は title と content から確実に言える範囲だけで書く。
11. 箇条書き禁止。プレーンな 1 文または 2 文まで。
12. 「この記事では」「このブログでは」などのメタ表現は禁止。
13. 根拠の薄い評価語は禁止。
14. summary200Ja は summary100Ja の言い換えではなく、確実に言える範囲で少しだけ情報を足す。
15. summaryInputBasis が source_snippet または title_only のときは、入力にない会社名・製品名・数字・出来事を絶対に補わない。
16. summaryInputBasis が source_snippet のときは、title と content の両方に整合する内容だけを書く。

content の扱い:
1. item.content が十分にある場合は、それを最優先の情報源にする。
2. item.content が空文字、短すぎる、または実質的に本文情報を持たない場合は、title から言える範囲だけで書く。
3. 本文がない case で背景・影響・用途などを勝手に補足しない。

出力 JSON 形式:
{
  "items": [
    {
      "id": "123",
      "summary100Ja": "100文字以内の日本語要約",
      "summary200Ja": "200文字以内の日本語要約"
    }
  ]
}

入力 JSON:
${JSON.stringify({ items: items.map(toPromptItem) }, null, 2)}
  `.trim()
}
