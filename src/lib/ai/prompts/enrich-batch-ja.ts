export interface BatchSummaryPromptItem {
  id: string
  title: string
  content: string
  summaryInputBasis?: 'full_content' | 'source_snippet' | 'title_only'
  contentLanguage?: 'ja' | 'en' | null
}

export interface AllowedPrimaryTagPromptItem {
  tagKey: string
  displayName: string
}

function toPromptItem(item: BatchSummaryPromptItem): {
  id: string
  title: string
  content: string
  summaryInputBasis: 'full_content' | 'source_snippet' | 'title_only'
  needsTitleTranslation: boolean
} {
  return {
    id: item.id,
    title: item.title,
    content: item.content.slice(0, 5000),
    summaryInputBasis: item.summaryInputBasis ?? 'full_content',
    needsTitleTranslation: item.contentLanguage !== 'ja',
  }
}

export function buildEnrichBatchPrompt(
  items: BatchSummaryPromptItem[],
  allowedPrimaryTags: AllowedPrimaryTagPromptItem[] = [],
): string {
  return `
あなたは AI Trend Hub の Layer2 enrich バッチです。
返答は JSON のみで、説明文・コードフェンス・前置きは不要です。

目的:
- 日本語 title / summary100 / summary200 を作る
- 本文があるときは本文を優先して内容を要約する
- 記事の中心対象に当たる primary tag を allowedPrimaryTags からだけ選ぶ
- 既存タグにない固有名詞候補は properNounTags に出す
- 本文があるときは固有名詞候補のうち既存タグへ寄せられるものを canonicalTagHints に出す

必須ルール:
1. 出力は JSON オブジェクト 1 つのみ。
2. items の件数を入力と完全一致させる。
3. id は入力の値をそのまま返す。
4. summary100Ja は 100 文字以内、summary200Ja は 200 文字以内。
5. 推測で会社名・製品名・数字・出来事を補わない。
6. 入力にない主張や断定を足さない。
7. 本文がある場合は本文に基づき、本文が弱い場合は title と content の共通部分だけを書く。
8. source_snippet / title_only の場合は特に保守的にし、入力にない固有名詞を補わない。
9. needsTitleTranslation=true のときだけ titleJa に自然な日本語タイトルを書く。
10. needsTitleTranslation=false のときは titleJa に入力 title をそのまま返す。
11. properNounTags は既存タグにない固有名詞候補のみ。最大 5 件。英小文字 kebab-case か単語列で返す。
12. 一般語、抽象語、カテゴリ語、研究分野そのもの、単なる手法名は properNounTags に入れない。
13. matchedTagKeys は allowedPrimaryTags からだけ選ぶ。最大 5 件。
14. matchedTagKeys は「記事の中心対象」と言えるものだけに絞る。
15. summaryInputBasis=full_content の場合は本文を読んだうえで matchedTagKeys を選ぶ。
16. summaryInputBasis=source_snippet または title_only の場合は、明示的に読み取れるものだけ matchedTagKeys に入れる。
17. allowedPrimaryTags にない key は matchedTagKeys に出さない。
18. 出力順は重要度順。もっとも中心的なタグを先頭にする。
19. canonicalTagHints は summaryInputBasis=full_content のときだけ返してよい。source_snippet / title_only では空配列にする。
20. canonicalTagHints は properNounTags と別枠でよい。既存タグへ寄せるべき語は properNounTags に入れず、canonicalTagHints のみに入れてよい。最大 5 件。
21. canonicalTagHints は、本文中に出る表記・略称・別表現を allowedPrimaryTags の既存タグへ正規化したいときだけ返す。
22. relation は厳密な表記ゆれなら alias、同一タグへ寄せたい検索語・通称・略称なら keyword にする。上位概念・関連語は入れない。
23. confidence は high / medium / low。自信がない場合は canonicalTagHints に入れない。
24. LLM 一般論・評価手法・抽象研究テーマだけの記事では、OpenAI / ChatGPT / Claude などの有名タグを推測で入れない。
25. 逆に本文中で既存タグに対応する固有名詞・製品名・モデル名・企業名が明確なら、matchedTagKeys は遠慮せず最大 5 件まで返してよい。
26. canonicalTagHints の候補例: "gpt five" -> "gpt-5" は alias, "chatgpt enterprise" -> "chatgpt" は keyword。

出力スキーマ:
{
  "items": [
    {
      "id": "123",
      "titleJa": "日本語タイトル",
      "summary100Ja": "100文字以内の要約",
      "summary200Ja": "200文字以内の要約",
      "properNounTags": ["langchain", "nvidia"],
      "matchedTagKeys": ["openai", "gpt-5"],
      "canonicalTagHints": [
        {
          "candidateKey": "gpt five",
          "matchedTagKey": "gpt-5",
          "relation": "alias",
          "confidence": "high"
        }
      ]
    }
  ]
}

allowedPrimaryTags:
${JSON.stringify(allowedPrimaryTags, null, 2)}

input:
${JSON.stringify({ items: items.map(toPromptItem) }, null, 2)}
  `.trim()
}
