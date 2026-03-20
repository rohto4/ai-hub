import { generateTemplateSummary, validateSummaryResult } from '@/lib/ai/summarize-fallback'
import { generateExtendedSummaryWithGemini, generateSummaryWithGemini } from '@/lib/ai/summarize-gemini'
import type { SummaryResult } from '@/lib/ai/summarize-types'

export type { SummaryResult } from '@/lib/ai/summarize-types'

export async function generateSummary(
  title: string,
  content: string,
): Promise<SummaryResult> {
  const fallback = generateTemplateSummary(title)

  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await generateSummaryWithGemini(title, content)
      return validateSummaryResult(result, fallback)
    } catch (error) {
      console.error('[summarize] Gemini failed, using template fallback:', error)
    }
  }

  return fallback
}

export async function generateSummaryExtended(
  title: string,
  content: string,
  length: 200,
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return content.slice(0, length)
  }

  return generateExtendedSummaryWithGemini(title, content, length)
}
