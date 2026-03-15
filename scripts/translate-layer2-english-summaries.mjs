import fs from 'node:fs'
import path from 'node:path'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { neon } from '@neondatabase/serverless'

function loadEnvFile(fileName) {
  const fullPath = path.join(process.cwd(), fileName)
  if (!fs.existsSync(fullPath)) return

  for (const rawLine of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    if (!rawLine || rawLine.trim().startsWith('#')) continue
    const separatorIndex = rawLine.indexOf('=')
    if (separatorIndex === -1) continue
    const key = rawLine.slice(0, separatorIndex)
    const value = rawLine.slice(separatorIndex + 1)
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured')
}
if (!process.env.GEMINI_API_KEY2) {
  throw new Error('GEMINI_API_KEY2 is not configured')
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not configured')
}

const sql = neon(process.env.DATABASE_URL)
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY2)
const geminiModel = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const OPENAI_MODEL = process.env.OPENAI_SUMMARY_MODEL || 'gpt-5-mini'

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function truncateAtWordBoundary(value, maxLength) {
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

function buildTranslationPrompt(article) {
  const sourceSummary = normalizeWhitespace(article.summary_200 || article.summary_100 || article.publication_text || article.title)
  return `
以下の英語記事タイトルと英語要約を、日本語の自然な要約へ変換してください。
- 事実のみを保持し、情報を足さない
- summary100 は100文字以内
- summary200 は200文字以内
- JSONのみを返す
- 形式: {"summary100":"...","summary200":"..."}

title:
${article.title}

english_summary:
${sourceSummary}
  `.trim()
}

function parseJsonObject(text) {
  const trimmed = text.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`JSON object not found: ${trimmed.slice(0, 200)}`)
  }
  return JSON.parse(trimmed.slice(start, end + 1))
}

async function translateWithGemini(article) {
  const response = await geminiModel.generateContent(buildTranslationPrompt(article))
  const parsed = parseJsonObject(response.response.text())
  return {
    provider: 'gemini2',
    summary100: truncateAtWordBoundary(parsed.summary100 || article.title, 100),
    summary200: truncateAtWordBoundary(parsed.summary200 || parsed.summary100 || article.title, 200),
  }
}

async function translateWithOpenAI(article) {
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: buildTranslationPrompt(article),
    reasoning: { effort: 'minimal' },
    max_output_tokens: 400,
  })
  const parsed = parseJsonObject(response.output_text || '')
  return {
    provider: 'openai',
    summary100: truncateAtWordBoundary(parsed.summary100 || article.title, 100),
    summary200: truncateAtWordBoundary(parsed.summary200 || parsed.summary100 || article.title, 200),
  }
}

async function main() {
  const mode = process.argv.includes('--openai-only') ? 'openai-only' : 'split'
  const candidates = await sql`
    SELECT
      enriched_article_id AS id,
      raw_article_id,
      source_target_id,
      normalized_url,
      cited_url,
      canonical_url,
      title,
      thumbnail_url,
      summary_100,
      summary_200,
      summary_basis,
      content_path,
      is_provisional,
      provisional_reason,
      dedupe_status,
      dedupe_group_key,
      publish_candidate,
      publication_basis,
      publication_text,
      summary_input_basis,
      score,
      score_reason,
      source_updated_at,
      processed_at,
      created_at,
      updated_at
    FROM articles_enriched
    WHERE (
      (summary_100 ~ '[A-Za-z]{4,}' AND summary_100 !~ '[ぁ-んァ-ン一-龠々]')
      OR (coalesce(summary_200, '') <> '' AND summary_200 ~ '[A-Za-z]{4,}' AND summary_200 !~ '[ぁ-んァ-ン一-龠々]')
      OR (coalesce(publication_text, '') <> '' AND publication_text ~ '[A-Za-z]{4,}' AND publication_text !~ '[ぁ-んァ-ン一-龠々]')
    )
    ORDER BY processed_at DESC, enriched_article_id DESC
  `

  const total = candidates.length
  const geminiCount = mode === 'openai-only' ? 0 : Math.floor(total / 2)
  const openaiCount = total - geminiCount

  console.log(`mode=${mode} targets=${total} gemini2=${geminiCount} openai=${openaiCount}`)

  for (let index = 0; index < candidates.length; index += 1) {
    const article = candidates[index]
    const translator = index < geminiCount ? translateWithGemini : translateWithOpenAI
    const translated = await translator(article)
    const publicationText =
      article.publication_basis === 'hold'
        ? article.publication_text
        : translated.summary200 || translated.summary100

    await sql`BEGIN`
    try {
      await sql`
        INSERT INTO articles_enriched_history (
          enriched_article_id,
          raw_article_id,
          source_target_id,
          normalized_url,
          cited_url,
          canonical_url,
          title,
          thumbnail_url,
          summary_100,
          summary_200,
          summary_basis,
          content_path,
          is_provisional,
          provisional_reason,
          dedupe_status,
          dedupe_group_key,
          publish_candidate,
          publication_basis,
          publication_text,
          summary_input_basis,
          score,
          score_reason,
          source_updated_at,
          processed_at,
          created_at,
          updated_at
        )
        VALUES (
          ${article.id},
          ${article.raw_article_id},
          ${article.source_target_id},
          ${article.normalized_url},
          ${article.cited_url},
          ${article.canonical_url},
          ${article.title},
          ${article.thumbnail_url},
          ${article.summary_100},
          ${article.summary_200},
          ${article.summary_basis},
          ${article.content_path},
          ${article.is_provisional},
          ${article.provisional_reason},
          ${article.dedupe_status},
          ${article.dedupe_group_key},
          ${article.publish_candidate},
          ${article.publication_basis},
          ${article.publication_text},
          ${article.summary_input_basis},
          ${article.score},
          ${article.score_reason},
          ${article.source_updated_at},
          ${article.processed_at},
          ${article.created_at},
          ${article.updated_at}
        )
      `

      await sql`
        UPDATE articles_enriched
        SET
          summary_100 = ${translated.summary100},
          summary_200 = ${translated.summary200},
          publication_text = ${publicationText},
          processed_at = now(),
          updated_at = now()
        WHERE enriched_article_id = ${article.id}
      `
      await sql`COMMIT`
    } catch (error) {
      await sql`ROLLBACK`
      throw error
    }

    console.log(
      `[${index + 1}/${total}] id=${article.id} provider=${translated.provider} summary100=${translated.summary100.length} summary200=${translated.summary200.length}`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
