import { SummarySchema } from '@/lib/validation/schemas'
import type { SummaryResult } from '@/lib/ai/summarize-types'

export function generateTemplateSummary(title: string): SummaryResult {
  const summary_100 = title.length > 100 ? `${title.slice(0, 98)}…` : title

  return {
    summary_100,
    critique: '批評を生成できませんでした。',
    ai_model: 'template',
  }
}

export function validateSummaryResult(result: SummaryResult, fallback: SummaryResult): SummaryResult {
  const parsed = SummarySchema.safeParse({
    summary_100: result.summary_100,
    critique: result.critique,
  })

  if (parsed.success) return result
  return fallback
}
