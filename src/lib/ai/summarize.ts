import { GoogleGenerativeAI } from '@google/generative-ai'
import { SummarySchema } from '@/lib/validation/schemas'

const PROMPT_100 = `
以下の記事を日本語で100文字以内に要約してください。
- 主要な事実・数値を含めること
- 断定調で書くこと
- 見出しや記号は不要
- 100文字を超えないこと

記事タイトル: {title}
記事本文:
{content}
`.trim()

const PROMPT_CRITIQUE = `
以下の記事について、AIの観点から200文字以内で批評してください。
- 技術的な意義・課題・懸念点を指摘すること
- 中立的・客観的な論調で書くこと

記事タイトル: {title}
記事本文:
{content}
`.trim()

interface SummaryResult {
  summary_100: string
  critique: string
  ai_model: 'gemini-flash' | 'template'
}

/**
 * Gemini Flash で要約・批評を生成
 * API障害時はテンプレートフォールバック
 */
export async function generateSummary(
  title: string,
  content: string
): Promise<SummaryResult> {
  const fallback = generateTemplate(title)

  if (process.env.GEMINI_API_KEY) {
    try {
      return validateSummaryResult(await generateWithGemini(title, content), fallback)
    } catch (err) {
      console.error('[summarize] Gemini失敗、テンプレートへフォールバック:', err)
    }
  }
  return fallback
}

async function generateWithGemini(
  title: string,
  content: string
): Promise<SummaryResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  // 本文は最初の3000文字に制限（コスト・速度）
  const trimmedContent = content.slice(0, 3000)

  const [sumResult, critiqueResult] = await Promise.all([
    model.generateContent(
      PROMPT_100
        .replace('{title}', title)
        .replace('{content}', trimmedContent)
    ),
    model.generateContent(
      PROMPT_CRITIQUE
        .replace('{title}', title)
        .replace('{content}', trimmedContent)
    ),
  ])

  const summary_100 = sumResult.response.text().trim().slice(0, 120)
  const critique = critiqueResult.response.text().trim().slice(0, 500)

  return { summary_100, critique, ai_model: 'gemini-flash' }
}

/** API障害時のテンプレートフォールバック */
function generateTemplate(title: string): SummaryResult {
  const summary_100 = title.length > 100
    ? title.slice(0, 98) + '…'
    : title

  return {
    summary_100,
    critique: '（批評を生成できませんでした）',
    ai_model: 'template',
  }
}

function validateSummaryResult(result: SummaryResult, fallback: SummaryResult): SummaryResult {
  const parsed = SummarySchema.safeParse({
    summary_100: result.summary_100,
    critique: result.critique,
  })

  if (parsed.success) return result
  return fallback
}

/**
 * 200 / 300字要約はオンデマンド生成（初回アクセス時にキャッシュ）
 */
export async function generateSummaryExtended(
  title: string,
  content: string,
  length: 200 | 300
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) return content.slice(0, length)

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `
以下の記事を日本語で${length}文字以内に要約してください。
- 重要な詳細・数値・背景を含めること
- ${length}文字を超えないこと

記事タイトル: ${title}
記事本文:
${content.slice(0, 4000)}
  `.trim()

  const result = await model.generateContent(prompt)
  return result.response.text().trim().slice(0, length * 1.2)
}
