import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import {
  buildEnrichBatchPrompt,
  type AllowedPrimaryTagPromptItem,
  type BatchSummaryPromptItem,
} from '@/lib/ai/prompts/enrich-batch-ja'
import {
  sanitizeCanonicalTagHints,
  type CanonicalTagHint,
} from '@/lib/enrich/canonical-tag-hints'

const GEMINI_SUMMARY_MODEL = process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash'
const OPENAI_SUMMARY_MODEL = process.env.OPENAI_SUMMARY_MODEL || 'gpt-5-mini'
const OPENAI_REASONING_EFFORT = 'minimal'
const OPENAI_MAX_OUTPUT_TOKENS = 4000
const DEFAULT_SUMMARY_BATCH_SIZE = 20
const MAX_SUMMARY_BATCH_SIZE = 20
const DEFAULT_SUMMARY_BATCH_PAUSE_MS = 0
const MANUAL_PENDING_SUMMARY_100 = '要約待ち'
const MANUAL_PENDING_SUMMARY_200 = '要約待ち'
const OPENAI_MIN_SPLIT_BATCH_SIZE = 1
const OPENAI_ENRICH_RESPONSE_SCHEMA = {
  name: 'enrich_batch_response',
  type: 'json_schema' as const,
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'titleJa', 'summary100Ja', 'summary200Ja', 'properNounTags', 'matchedTagKeys', 'canonicalTagHints'],
          properties: {
            id: { type: 'string' },
            titleJa: { type: 'string' },
            summary100Ja: { type: 'string' },
            summary200Ja: { type: 'string' },
            properNounTags: {
              type: 'array',
              items: { type: 'string' },
            },
            matchedTagKeys: {
              type: 'array',
              items: { type: 'string' },
            },
            canonicalTagHints: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['candidateKey', 'matchedTagKey', 'relation', 'confidence'],
                properties: {
                  candidateKey: { type: 'string' },
                  matchedTagKey: { type: 'string' },
                  relation: { type: 'string', enum: ['alias', 'keyword'] },
                  confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                },
              },
            },
          },
        },
      },
    },
  },
}

export interface EnrichedSummary {
  titleJa: string | null
  summary100: string
  summary200: string
  summarySource: 'gemini' | 'gemini2' | 'openai' | 'manual_pending'
  properNounTags: string[]
  matchedTagKeys: string[]
  canonicalTagHints: CanonicalTagHint[]
}

export interface EnrichedSummaryInput {
  id: string
  title: string
  content: string
  summaryInputBasis?: 'full_content' | 'source_snippet' | 'title_only'
  contentLanguage?: 'ja' | 'en' | null
}

type ProviderSummaryItem = {
  id: string
  titleJa?: string
  summary100Ja: string
  summary200Ja: string
  properNounTags?: string[]
  matchedTagKeys?: string[]
  canonicalTagHints?: CanonicalTagHint[]
}

type ProviderSummaryResponse = {
  items: ProviderSummaryItem[]
}

const providerCircuitBreaker = {
  gemini: false,
  gemini2: false,
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

function buildManualPendingSummary(): EnrichedSummary {
  return {
    titleJa: null,
    summary100: MANUAL_PENDING_SUMMARY_100,
    summary200: MANUAL_PENDING_SUMMARY_200,
    summarySource: 'manual_pending',
    properNounTags: [],
    matchedTagKeys: [],
    canonicalTagHints: [],
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldOpenCircuit(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const normalizedMessage = error.message.toLowerCase()
  return (
    normalizedMessage.includes('429') ||
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('spending cap')
  )
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

function sanitizeJsonLikeText(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/,\s*([}\]])/g, '$1')
    .trim()
}

function parseJsonWithRecovery(text: string): ProviderSummaryResponse {
  const extracted = extractJsonBlock(text)

  try {
    return JSON.parse(extracted) as ProviderSummaryResponse
  } catch (primaryError) {
    const sanitized = sanitizeJsonLikeText(extracted)
    try {
      return JSON.parse(sanitized) as ProviderSummaryResponse
    } catch (secondaryError) {
      const message = primaryError instanceof Error ? primaryError.message : 'Unknown JSON parse error'
      const recoveryMessage = secondaryError instanceof Error ? secondaryError.message : 'Unknown recovery parse error'
      throw new Error(`Failed to parse provider response JSON (${message}; recovery=${recoveryMessage})`)
    }
  }
}

function parseProviderResponse(
  text: string,
  inputs: EnrichedSummaryInput[],
): Map<string, EnrichedSummary> {
  const fallbackMap = buildFallbackMap(inputs)
  const raw = parseJsonWithRecovery(text)
  const outputMap = new Map<string, ProviderSummaryItem>(
    (raw.items ?? []).map((item) => [String(item.id), item]),
  )

  return new Map(
    inputs.map((input) => {
      const output = outputMap.get(input.id)
      const fallback = fallbackMap.get(input.id) ?? buildManualPendingSummary()
      const titleJa = output?.titleJa?.trim() || null
      const properNounTags = Array.isArray(output?.properNounTags)
        ? (output.properNounTags as unknown[]).filter((t): t is string => typeof t === 'string').map((t) => t.toLowerCase().trim()).filter((t) => t.length >= 2)
        : []
      const matchedTagKeys = Array.isArray(output?.matchedTagKeys)
        ? [...new Set(
            (output.matchedTagKeys as unknown[])
              .filter((value): value is string => typeof value === 'string')
              .map((value) => value.toLowerCase().trim())
              .filter((value) => value.length >= 2),
          )]
        : []
      const canonicalTagHints = sanitizeCanonicalTagHints(output?.canonicalTagHints)
      return [
        input.id,
        {
          titleJa,
          summary100: truncateAtWordBoundary(output?.summary100Ja || fallback.summary100, 100),
          summary200: truncateAtWordBoundary(
            output?.summary200Ja || output?.summary100Ja || fallback.summary200,
            200,
          ),
          summarySource: fallback.summarySource,
          properNounTags,
          matchedTagKeys,
          canonicalTagHints,
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
    summaryInputBasis: input.summaryInputBasis,
    contentLanguage: input.contentLanguage,
  }))
}

async function generateWithGemini(
  inputs: EnrichedSummaryInput[],
  apiKey: string,
  summarySource: 'gemini' | 'gemini2',
  allowedPrimaryTags: AllowedPrimaryTagPromptItem[],
): Promise<Map<string, EnrichedSummary>> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: GEMINI_SUMMARY_MODEL })
  const prompt = buildEnrichBatchPrompt(buildPromptItems(inputs), allowedPrimaryTags)
  const response = await model.generateContent(prompt)
  return withSummarySource(parseProviderResponse(response.response.text(), inputs), summarySource)
}

async function generateWithOpenAI(
  inputs: EnrichedSummaryInput[],
  allowedPrimaryTags: AllowedPrimaryTagPromptItem[],
): Promise<Map<string, EnrichedSummary>> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.create({
    model: OPENAI_SUMMARY_MODEL,
    input: buildEnrichBatchPrompt(buildPromptItems(inputs), allowedPrimaryTags),
    reasoning: { effort: OPENAI_REASONING_EFFORT },
    max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
    text: {
      format: OPENAI_ENRICH_RESPONSE_SCHEMA,
    },
  })
  if (response.status === 'incomplete' && response.incomplete_details?.reason === 'max_output_tokens') {
    throw new Error(`OpenAI response incomplete: max_output_tokens (batch_size=${inputs.length})`)
  }
  const outputText = response.output_text?.trim()
  if (!outputText) {
    throw new Error('OpenAI returned empty output for summary batch')
  }
  return withSummarySource(parseProviderResponse(outputText, inputs), 'openai')
}

async function generateWithOpenAISplitting(
  inputs: EnrichedSummaryInput[],
  allowedPrimaryTags: AllowedPrimaryTagPromptItem[],
): Promise<Map<string, EnrichedSummary>> {
  try {
    return await generateWithOpenAI(inputs, allowedPrimaryTags)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const shouldSplit =
      inputs.length > OPENAI_MIN_SPLIT_BATCH_SIZE &&
      (
        message.includes('max_output_tokens') ||
        message.includes('Failed to parse provider response JSON')
      )

    if (!shouldSplit) {
      throw error
    }

    const midpoint = Math.ceil(inputs.length / 2)
    const left = await generateWithOpenAISplitting(inputs.slice(0, midpoint), allowedPrimaryTags)
    const right = await generateWithOpenAISplitting(inputs.slice(midpoint), allowedPrimaryTags)
    return new Map([...left.entries(), ...right.entries()])
  }
}

function resolveBatchSize(batchSize?: number): number {
  const parsedEnv = Number(process.env.ENRICH_SUMMARY_BATCH_SIZE)
  const candidate = batchSize ?? parsedEnv
  if (!Number.isFinite(candidate)) {
    return DEFAULT_SUMMARY_BATCH_SIZE
  }
  return Math.max(1, Math.min(MAX_SUMMARY_BATCH_SIZE, Math.trunc(candidate)))
}

function resolveBatchPauseMs(): number {
  const parsedEnv = Number(process.env.ENRICH_SUMMARY_BATCH_PAUSE_MS)
  if (!Number.isFinite(parsedEnv)) {
    return DEFAULT_SUMMARY_BATCH_PAUSE_MS
  }
  return Math.max(0, Math.trunc(parsedEnv))
}

async function generateSummaryBatch(
  inputs: EnrichedSummaryInput[],
  allowedPrimaryTags: AllowedPrimaryTagPromptItem[],
): Promise<Map<string, EnrichedSummary>> {
  const fallbackMap = buildFallbackMap(inputs)

  if (process.env.GEMINI_API_KEY) {
    if (!providerCircuitBreaker.gemini) {
      try {
        return await generateWithGemini(inputs, process.env.GEMINI_API_KEY, 'gemini', allowedPrimaryTags)
      } catch (error) {
        if (shouldOpenCircuit(error)) {
          providerCircuitBreaker.gemini = true
        }
        console.error('[enrich] Gemini summary batch failed, falling back to next provider', error)
      }
    }
  }

  if (process.env.GEMINI_API_KEY2) {
    if (!providerCircuitBreaker.gemini2) {
      try {
        return await generateWithGemini(inputs, process.env.GEMINI_API_KEY2, 'gemini2', allowedPrimaryTags)
      } catch (error) {
        if (shouldOpenCircuit(error)) {
          providerCircuitBreaker.gemini2 = true
        }
        console.error('[enrich] Gemini2 summary batch failed, falling back to next provider', error)
      }
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      return await generateWithOpenAISplitting(inputs, allowedPrimaryTags)
    } catch (error) {
      console.error('[enrich] OpenAI summary batch failed, falling back to manual pending', error)
    }
  }

  return fallbackMap
}

export async function generateEnrichedSummaries(
  inputs: EnrichedSummaryInput[],
  batchSize?: number,
  allowedPrimaryTags: AllowedPrimaryTagPromptItem[] = [],
): Promise<EnrichedSummary[]> {
  if (inputs.length === 0) {
    return []
  }

  const normalizedInputs = inputs.map((input) => ({
    ...input,
    id: String(input.id),
    title: normalizeWhitespace(input.title),
    content: normalizeWhitespace(input.content),
    summaryInputBasis: input.summaryInputBasis ?? 'full_content',
  }))

  const summaryMap = new Map<string, EnrichedSummary>()
  const chunks = chunkInputs(normalizedInputs, resolveBatchSize(batchSize))
  const batchPauseMs = resolveBatchPauseMs()

  for (const [index, chunk] of chunks.entries()) {
    const chunkSummaries = await generateSummaryBatch(chunk, allowedPrimaryTags)
    for (const input of chunk) {
      summaryMap.set(
        input.id,
        chunkSummaries.get(input.id) ?? buildManualPendingSummary(),
      )
    }

    if (batchPauseMs > 0 && index < chunks.length - 1) {
      await sleep(batchPauseMs)
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
