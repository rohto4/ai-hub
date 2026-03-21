#!/usr/bin/env npx tsx
/**
 * en ソース記事のタイトルを日本語に翻訳してバックフィルする
 * 対象: articles_enriched.content_language='en' かつ title が英語で始まる記事
 * 処理: Gemini で title だけ翻訳 → articles_enriched.title と public_articles.display_title を更新
 *
 * Usage:
 *   npx tsx scripts/backfill-ja-titles.ts               # published のみ（デフォルト）
 *   npx tsx scripts/backfill-ja-titles.ts --all         # enriched 全体
 *   npx tsx scripts/backfill-ja-titles.ts --dry-run     # DB 更新しない（確認用）
 *   npx tsx scripts/backfill-ja-titles.ts --limit 100   # 件数制限
 */
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleGenerativeAI } from '@google/generative-ai'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

import { getSql } from '@/lib/db'

const BATCH_SIZE = 20
const GEMINI_MODEL = process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash'

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const isAll = args.includes('--all')
const limitArg = args.find((a) => a.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : null

type ArticleRow = {
  enriched_article_id: string | number
  title: string
  public_article_id: string | null
}

async function translateTitles(titles: string[]): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

  const prompt = `以下の英語タイトルをそれぞれ日本語に翻訳してください。
固有名詞・製品名・企業名・ライブラリ名は原語のまま残し、それ以外を日本語に訳してください。
60文字以内を目安にしてください。
出力は JSON 配列のみ。順序は入力と同じにしてください。

例:
入力: ["OpenAI releases new model", "Google announces Gemini update"]
出力: ["OpenAI、新モデルをリリース", "Google、Geminiのアップデートを発表"]

入力:
${JSON.stringify(titles)}

出力:`

  const response = await model.generateContent(prompt)
  const text = response.response.text().trim()

  // JSON 配列を抽出
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`Unexpected response: ${text.slice(0, 200)}`)

  const translated = JSON.parse(match[0]) as string[]
  if (translated.length !== titles.length) {
    throw new Error(`Length mismatch: input=${titles.length} output=${translated.length}`)
  }
  return translated
}

async function main() {
  const sql = getSql()

  // 対象記事を取得（LIMIT は JS 側でスライス）
  const fetchLimit = limit ?? 9999
  const rows = isAll
    ? (await sql`
        SELECT ae.enriched_article_id, ae.title, NULL::text AS public_article_id
        FROM articles_enriched ae
        WHERE ae.content_language = 'en'
          AND ae.ai_processing_state = 'completed'
          AND ae.title ~ '^[A-Za-z]'
        ORDER BY ae.processed_at DESC
        LIMIT ${fetchLimit}
      `) as ArticleRow[]
    : (await sql`
        SELECT ae.enriched_article_id, ae.title, pa.public_article_id::text
        FROM public_articles pa
        JOIN articles_enriched ae ON ae.enriched_article_id = pa.enriched_article_id
        WHERE pa.visibility_status = 'published'
          AND pa.content_language = 'en'
          AND pa.display_title ~ '^[A-Za-z]'
        ORDER BY COALESCE(pa.original_published_at, pa.created_at) DESC
        LIMIT ${fetchLimit}
      `) as ArticleRow[]

  console.log(`対象: ${rows.length} 件 (dry-run: ${isDryRun})`)

  let updated = 0
  let failed = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const titles = batch.map((r) => r.title)

    console.log(`[${i + 1}-${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}] 翻訳中...`)

    try {
      const translated = await translateTitles(titles)

      if (!isDryRun) {
        for (const [j, row] of batch.entries()) {
          const newTitle = translated[j]
          if (!newTitle || newTitle === row.title) continue

          // articles_enriched.title を更新
          await sql`
            UPDATE articles_enriched
            SET title = ${newTitle}, updated_at = now()
            WHERE enriched_article_id = ${Number(row.enriched_article_id)}
          `

          // public_articles.display_title を更新（存在する場合）
          if (row.public_article_id) {
            await sql`
              UPDATE public_articles
              SET display_title = ${newTitle}, updated_at = now()
              WHERE public_article_id = ${row.public_article_id}
            `
          }

          updated++
        }
      } else {
        // dry-run: 翻訳結果だけ表示
        for (const [j, row] of batch.entries()) {
          console.log(`  "${row.title}" → "${translated[j]}"`)
        }
        updated += batch.length
      }
    } catch (error) {
      console.error(`バッチ失敗:`, error instanceof Error ? error.message : error)
      failed += batch.length
      // 失敗しても続行
    }

    // レート制限対策で少し待つ
    if (i + BATCH_SIZE < rows.length) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  console.log(`\n完了: 更新=${updated} 失敗=${failed}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
