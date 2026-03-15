import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

const GEMINI_SUMMARY_MODEL = 'gemini-2.5-flash'
const OPENAI_SUMMARY_MODEL = process.env.OPENAI_SUMMARY_MODEL || 'gpt-5-mini'

const SUMMARY_TARGETS = [
  { key: 'summary100', length: 100 },
  { key: 'summary200', length: 200 },
] as const

type SummaryKey = (typeof SUMMARY_TARGETS)[number]['key']

export interface EnrichedSummary {
  summary100: string
  summary200: string
  summarySource: 'gemini' | 'openai' | 'template'
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function truncateAtWordBoundary(value: string, maxLength: number): string {
  const normalized = normalizeWhitespace(value)
  if (normalized.length <= maxLength) {
    return normalized
  }

  const sliced = normalized.slice(0, maxLength + 1)
  const lastBoundary = Math.max(sliced.lastIndexOf(' '), sliced.lastIndexOf('。'), sliced.lastIndexOf('、'))
  if (lastBoundary >= Math.floor(maxLength * 0.7)) {
    return sliced.slice(0, lastBoundary).trim()
  }
  return normalized.slice(0, maxLength).trim()
}

function splitSentences(content: string): string[] {
  return normalizeWhitespace(content)
    .split(/(?<=[.!?。！？])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function scoreSentence(sentence: string, keywordSet: Set<string>): number {
  const lowered = sentence.toLowerCase()
  let score = Math.min(sentence.length, 220) / 20

  for (const keyword of keywordSet) {
    if (keyword && lowered.includes(keyword)) {
      score += 3
    }
  }

  if (/\d/.test(sentence)) {
    score += 1
  }

  if (sentence.length >= 50 && sentence.length <= 220) {
    score += 1
  }

  return score
}

function buildKeywordSet(title: string, content: string): Set<string> {
  const source = `${title} ${content}`.toLowerCase()
  const tokens = source
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)

  return new Set(tokens.slice(0, 12))
}

function buildTemplateSummary(title: string, content: string, maxLength: number): string {
  const normalizedTitle = normalizeWhitespace(title)
  const sentences = splitSentences(content)
  const keywordSet = buildKeywordSet(title, content)

  const rankedSentences = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: scoreSentence(sentence, keywordSet),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)

  const selected: string[] = []
  for (const item of rankedSentences) {
    const candidate = normalizeWhitespace([...selected, item.sentence].join(' '))
    if (candidate.length > maxLength * 1.4) {
      continue
    }
    selected.push(item.sentence)
    if (candidate.length >= maxLength * 0.75) {
      break
    }
  }

  const body = normalizeWhitespace(selected.join(' ')) || normalizeWhitespace(content)
  const summaryBase = body.startsWith(normalizedTitle) ? body : `${normalizedTitle}. ${body}`
  return truncateAtWordBoundary(summaryBase || normalizedTitle, maxLength)
}

function promptForLength(title: string, content: string, maxLength: number): string {
  return `
次の記事を日本語で要約してください。
- 何が起きたか
- なぜ重要か
- 誰に関係するか
- 断定しすぎず、煽らない
- ${maxLength}文字以内

タイトル:
${title}

本文:
${content.slice(0, 5000)}
  `.trim()
}

function openAiPromptForLength(title: string, content: string, maxLength: number): string {
  return `
Summarize the article below in Japanese.
- Keep it factual and concise.
- Do not add information not present in the source.
- Output plain text only.
- Keep the result within ${maxLength} characters.

Title:
${title}

Content:
${content.slice(0, 5000)}
  `.trim()
}

async function generateWithGemini(title: string, content: string): Promise<EnrichedSummary> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: GEMINI_SUMMARY_MODEL })

  const entries = await Promise.all(
    SUMMARY_TARGETS.map(async (target) => {
      const response = await model.generateContent(promptForLength(title, content, target.length))
      return [target.key, truncateAtWordBoundary(response.response.text(), target.length)] as const
    }),
  )

  const summaryMap = Object.fromEntries(entries) as Record<SummaryKey, string>
  return {
    summary100: summaryMap.summary100,
    summary200: summaryMap.summary200,
    summarySource: 'gemini',
  }
}

async function generateWithOpenAI(title: string, content: string): Promise<EnrichedSummary> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const entries = await Promise.all(
    SUMMARY_TARGETS.map(async (target) => {
      const response = await client.responses.create({
        model: OPENAI_SUMMARY_MODEL,
        input: openAiPromptForLength(title, content, target.length),
        max_output_tokens: 220,
      })
      return [target.key, truncateAtWordBoundary(response.output_text, target.length)] as const
    }),
  )

  const summaryMap = Object.fromEntries(entries) as Record<SummaryKey, string>
  return {
    summary100: summaryMap.summary100,
    summary200: summaryMap.summary200,
    summarySource: 'openai',
  }
}

function generateTemplateSummaries(title: string, content: string): EnrichedSummary {
  return {
    summary100: buildTemplateSummary(title, content, 100),
    summary200: buildTemplateSummary(title, content, 200),
    summarySource: 'template',
  }
}

export async function generateEnrichedSummary(
  title: string,
  content: string,
): Promise<EnrichedSummary> {
  const fallback = generateTemplateSummaries(title, content)

  if (process.env.GEMINI_API_KEY) {
    try {
      return await generateWithGemini(title, content)
    } catch (error) {
      console.error('[enrich] Gemini summary failed, falling back to next provider', error)
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      return await generateWithOpenAI(title, content)
    } catch (error) {
      console.error('[enrich] OpenAI summary failed, falling back to template', error)
    }
  }

  return fallback
}
