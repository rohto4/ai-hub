/**
 * タグ候補と既存タグの重複検出
 * Gemini に「この候補語は既存タグのどれかと同じ概念か？」を一括で問い合わせる
 */
import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_MODEL = process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash'

export type TagDedupCandidate = {
  candidateKey: string
  seenCount: number
}

export type ExistingTag = {
  tagId: string
  tagKey: string
  displayName: string
}

export type DedupResult = {
  candidateKey: string
  matchedTagId: string | null
  matchedTagKey: string | null
  relation: 'alias' | 'keyword' | 'separate'
  confidence: 'high' | 'low'
}

type GeminiDedupItem = {
  candidate: string
  matchedTagKey: string | null
  relation?: 'alias' | 'keyword' | 'separate'
  confidence: 'high' | 'low'
}

function buildDedupPrompt(candidates: TagDedupCandidate[], existingTags: ExistingTag[]): string {
  const tagList = existingTags
    .map((t) => `  - "${t.tagKey}" (表示: "${t.displayName}")`)
    .join('\n')

  const candidateList = candidates.map((c) => `  - "${c.candidateKey}" (出現 ${c.seenCount}回)`).join('\n')

  return `
あなたは AI ニュースサイトのタグ管理システムです。
以下の「候補タグ」が「既存タグ」のいずれかと同じ概念・表記ゆれであるかを判定してください。

既存タグ:
${tagList}

候補タグ:
${candidateList}

判定ルール:
1. 完全に同じ概念で厳密な表記ゆれなら relation="alias" とし、matchedTagKey に既存タグのキーを返す
2. 同じタグへ寄せたい検索語・通称・周辺語だが厳密な表記ゆれではない場合は relation="keyword" とする
3. 関連はあるが別概念（例: "gpt-4" と "openai"）は relation="separate" とし、matchedTagKey=null
4. 確信が高い場合は confidence="high", 曖昧な場合は confidence="low"
5. matchedTagKey は alias / keyword のときのみ返す
6. 出力は JSON のみ。説明不要。

出力形式:
{
  "items": [
    { "candidate": "候補キー", "matchedTagKey": "既存タグキー or null", "relation": "alias or keyword or separate", "confidence": "high or low" }
  ]
}

入力候補: ${JSON.stringify(candidates.map((c) => c.candidateKey))}
`.trim()
}

export async function detectTagDuplicates(
  candidates: TagDedupCandidate[],
  existingTags: ExistingTag[],
): Promise<DedupResult[]> {
  if (candidates.length === 0 || existingTags.length === 0) return []

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY2
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

  const prompt = buildDedupPrompt(candidates, existingTags)
  const response = await model.generateContent(prompt)
  const text = response.response.text().trim()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Unexpected dedup response: ${text.slice(0, 200)}`)

  const parsed = JSON.parse(jsonMatch[0]) as { items: GeminiDedupItem[] }
  const tagByKey = new Map(existingTags.map((t) => [t.tagKey, t]))

  return parsed.items.map((item) => {
    const matched = item.matchedTagKey ? tagByKey.get(item.matchedTagKey) : null
    return {
      candidateKey: item.candidate,
      matchedTagId: matched?.tagId ?? null,
      matchedTagKey: matched?.tagKey ?? null,
      relation: item.relation === 'alias' || item.relation === 'keyword' ? item.relation : 'separate',
      confidence: item.confidence ?? 'low',
    }
  })
}
