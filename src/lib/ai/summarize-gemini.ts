import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildExtendedSummaryPrompt, PROMPT_100, PROMPT_CRITIQUE } from '@/lib/ai/summarize-prompts'
import type { SummaryResult } from '@/lib/ai/summarize-types'

function getGeminiModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
}

export async function generateSummaryWithGemini(
  title: string,
  content: string,
): Promise<SummaryResult> {
  const model = getGeminiModel()
  const trimmedContent = content.slice(0, 3000)

  const [summaryResult, critiqueResult] = await Promise.all([
    model.generateContent(
      PROMPT_100.replace('{title}', title).replace('{content}', trimmedContent),
    ),
    model.generateContent(
      PROMPT_CRITIQUE.replace('{title}', title).replace('{content}', trimmedContent),
    ),
  ])

  return {
    summary_100: summaryResult.response.text().trim().slice(0, 120),
    critique: critiqueResult.response.text().trim().slice(0, 500),
    ai_model: 'gemini-flash',
  }
}

export async function generateExtendedSummaryWithGemini(
  title: string,
  content: string,
  length: number,
): Promise<string> {
  const model = getGeminiModel()
  const result = await model.generateContent(buildExtendedSummaryPrompt(title, content, length))
  return result.response.text().trim().slice(0, length * 1.2)
}
