import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import {
  buildEnrichBatchPrompt,
  type BatchSummaryPromptItem,
} from '@/lib/ai/prompts/enrich-batch-ja'

const GEMINI_SUMMARY_MODEL = 'gemini-2.5-flash'
const OPENAI_SUMMARY_MODEL = process.env.OPENAI_SUMMARY_MODEL || 'gpt-5-mini'
const OPENAI_REASONING_EFFORT = 'minimal'
const OPENAI_MAX_OUTPUT_TOKENS = 4000
const DEFAULT_SUMMARY_BATCH_SIZE = 10
const MANUAL_PENDING_SUMMARY_100 = '要約待ち'
const MANUAL_PENDING_SUMMARY_200 = '要約待ち'

export interface EnrichedSummary {
  summary100: string
  summary200: string
  summarySource: 'gemini' | 'gemini2' | 'openai' | 'manual_pending'
}

export interface EnrichedSummaryInput {
  id: string
  title: string
  content: string
}

type ProviderSummaryItem = {
  id: string
  summary100Ja: string
  summary200Ja: string
}

type ProviderSummaryResponse = {
  items: ProviderSummaryItem[]
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
  const lastBoundary = Math.max(
    sliced.lastIndexOf(' '),
    sliced.lastIndexOf('、'),
    sliced.lastIndexOf('。'),
  )
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

function buildManualPendingSummary(): EnrichedSummary {
  return {
    summary100: MANUAL_PENDING_SUMMARY_100,
    summary200: MANUAL_PENDING_SUMMARY_200,
    summarySource: 'manual_pending',
  }
}

function buildFallbackMap(inputs: EnrichedSummaryInput[]): Map<string, EnrichedSummary> {
  return new Map(
    inputs.map((input) => [input.id, buildManualPendingSummary()]),
  )
}

function chunkInputs<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function extractJsonBlock(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return trimmed
}

function parseProviderResponse(text: string, inputs: EnrichedSummaryInput[]): Map<string, EnrichedSummary> {
  const fallbackMap = buildFallbackMap(inputs)
  const raw = JSON.parse(extractJsonBlock(text)) as ProviderSummaryResponse
  const outputMap = new Map<string, ProviderSummaryItem>(
    (raw.items ?? []).map((item) => [String(item.id), item]),
  )

  return new Map(
    inputs.map((input) => {
      const output = outputMap.get(input.id)
      const fallback = fallbackMap.get(input.id) ?? buildManualPendingSummary()
      return [
        input.id,
        {
          summary100: truncateAtWordBoundary(output?.summary100Ja || fallback.summary100, 100),
          summary200: truncateAtWordBoundary(
            output?.summary200Ja || output?.summary100Ja || fallback.summary200,
            200,
          ),
          summarySource: fallback.summarySource,
        } satisfies EnrichedSummary,
      ]
    }),
  )
}

function withSummarySource(
  summaryMap: Map<string, EnrichedSummary>,
  summarySource: EnrichedSummary['summarySource'],
): Map<string, EnrichedSummary> {
  return new Map(
    [...summaryMap.entries()].map(([id, summary]) => [
      id,
      {
        ...summary,
        summarySource,
      },
    ]),
  )
}

function buildPromptItems(inputs: EnrichedSummaryInput[]): BatchSummaryPromptItem[] {
  return inputs.map((input) => ({
    id: input.id,
    title: input.title,
    content: input.content,
  }))
}

async function generateWithGemini(
  inputs: EnrichedSummaryInput[],
  apiKey: string,
  summarySource: 'gemini' | 'gemini2',
): Promise<Map<string, EnrichedSummary>> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: GEMINI_SUMMARY_MODEL })
  const prompt = buildEnrichBatchPrompt(buildPromptItems(inputs))
  const response = await model.generateContent(prompt)
  return withSummarySource(parseProviderResponse(response.response.text(), inputs), summarySource)
}

async function generateWithOpenAI(
  inputs: EnrichedSummaryInput[],
): Promise<Map<string, EnrichedSummary>> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.create({
    model: OPENAI_SUMMARY_MODEL,
    input: buildEnrichBatchPrompt(buildPromptItems(inputs)),
    reasoning: { effort: OPENAI_REASONING_EFFORT },
    max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
  })
  const outputText = response.output_text?.trim()
  if (!outputText) {
    throw new Error('OpenAI returned empty output for summary batch')
  }
  return withSummarySource(parseProviderResponse(outputText, inputs), 'openai')
}

function resolveBatchSize(batchSize?: number): number {
  const parsedEnv = Number(process.env.ENRICH_SUMMARY_BATCH_SIZE)
  const candidate = batchSize ?? parsedEnv
  if (!Number.isFinite(candidate)) {
    return DEFAULT_SUMMARY_BATCH_SIZE
  }
  return Math.max(1, Math.min(10, Math.trunc(candidate)))
}

async function generateSummaryBatch(
  inputs: EnrichedSummaryInput[],
): Promise<Map<string, EnrichedSummary>> {
  const fallbackMap = buildFallbackMap(inputs)

  if (process.env.GEMINI_API_KEY) {
    try {
      return await generateWithGemini(inputs, process.env.GEMINI_API_KEY, 'gemini')
    } catch (error) {
      console.error('[enrich] Gemini summary batch failed, falling back to next provider', error)
    }
  }

  if (process.env.GEMINI_API_KEY2) {
    try {
      return await generateWithGemini(inputs, process.env.GEMINI_API_KEY2, 'gemini2')
    } catch (error) {
      console.error('[enrich] Gemini2 summary batch failed, falling back to next provider', error)
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      return await generateWithOpenAI(inputs)
    } catch (error) {
      console.error('[enrich] OpenAI summary batch failed, falling back to manual pending', error)
    }
  }

  return fallbackMap
}

export async function generateEnrichedSummaries(
  inputs: EnrichedSummaryInput[],
  batchSize?: number,
): Promise<EnrichedSummary[]> {
  if (inputs.length === 0) {
    return []
  }

  const normalizedInputs = inputs.map((input) => ({
    ...input,
    id: String(input.id),
    title: normalizeWhitespace(input.title),
    content: normalizeWhitespace(input.content),
  }))

  const summaryMap = new Map<string, EnrichedSummary>()
  const chunks = chunkInputs(normalizedInputs, resolveBatchSize(batchSize))

  for (const chunk of chunks) {
    const chunkSummaries = await generateSummaryBatch(chunk)
    for (const input of chunk) {
      summaryMap.set(
        input.id,
        chunkSummaries.get(input.id) ?? buildManualPendingSummary(),
      )
    }
  }

  return normalizedInputs.map(
    (input) => summaryMap.get(input.id) ?? buildManualPendingSummary(),
  )
}

export async function generateEnrichedSummary(
  title: string,
  content: string,
): Promise<EnrichedSummary> {
  const [summary] = await generateEnrichedSummaries([{ id: 'single', title, content }], 1)
  return summary
}
