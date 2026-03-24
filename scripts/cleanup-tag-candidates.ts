#!/usr/bin/env npx tsx
/**
 * tag_candidate_pool の既存候補を固有名詞ルールで洗い直す
 * - origin 記事タイトルに対して extractProperNounCandidates を実行
 * - candidate_key が固有名詞として抽出されなかった場合は 'rejected' に更新
 *
 * Usage:
 *   npx tsx scripts/cleanup-tag-candidates.ts --dry-run   # 確認のみ
 *   npx tsx scripts/cleanup-tag-candidates.ts             # 実行
 */
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

import { getSql } from '@/lib/db'

const isDryRun = process.argv.includes('--dry-run')

// match.ts と同じ定義（依存を避けてインライン）
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'about', 'more',
  'will', 'than', 'over', 'under', 'after', 'before', 'have', 'has', 'had',
  'openai', 'chatgpt', 'claude', 'gemini', 'google', 'anthropic', 'agent',
  'agents', 'model', 'models', 'news', 'update', 'voice', 'policy', 'safety',
  'rag', 'coding', 'code', 'new', 'how', 'why', 'what', 'when', 'using', 'used',
  'announces', 'launches', 'released', 'release', 'latest', 'best', 'ai',
  'asks', 'maps', 'says', 'reveal', 'reveals', 'show', 'shows', 'gets',
  'chatty', 'power', 'control', 'app', 'apps', 'tool', 'tools', 'platform',
  'report', 'reports', 'real', 'world', 'questions', 'question', 'complex',
  'interactive', 'charts', 'diagrams', 'step', 'steps', 'share',
  'within', 'allow', 'allows', 'allowing', 'detailed', 'detail',
  'personal', 'computer', 'visuals', 'strategy', 'raised', 'million', 'cto',
  'would', 'could', 'should', 'your', 'their', 'our', 'his', 'her',
  'search', 'risk', 'risks', 'governance', 'defense', 'pentagon', 'mobile',
  'industry', 'uniformity', 'pilot', 'effort', 'users', 'pricing',
  'building', 'backs', 'coded', 'global', 'former', 'joint',
  'player', 'players', 'bills', 'china', 'chinas', 'buffet', 'lobster',
  'accused', 'murdering', 'introducing', 'amazon', 'offline', 'chatbots',
])

function extractProperNounKeys(title: string): Set<string> {
  const sentenceStartIndices = new Set<number>([0])
  for (const pattern of [':', ' -', ' –', ' —']) {
    let pos = title.indexOf(pattern)
    while (pos !== -1) {
      let wordStart = pos + pattern.length
      while (wordStart < title.length && title[wordStart] === ' ') wordStart++
      sentenceStartIndices.add(wordStart)
      pos = title.indexOf(pattern, pos + 1)
    }
  }

  const rawTokens: Array<{ original: string; startIndex: number }> = []
  const tokenRegex = /[A-Za-z][A-Za-z0-9-]*/g
  let match: RegExpExecArray | null
  while ((match = tokenRegex.exec(title)) !== null) {
    rawTokens.push({ original: match[0], startIndex: match.index })
  }

  const properNounIndices = new Set<number>()
  for (let i = 0; i < rawTokens.length; i++) {
    const { original, startIndex } = rawTokens[i]
    const lower = original.toLowerCase()
    if (lower.length < 3 || STOPWORDS.has(lower)) continue
    const isAllCaps = /^[A-Z]{2,}[A-Z0-9-]*$/.test(original)
    const isCamelCase = /[a-z][A-Z]|[A-Z]{2,}[a-z]/.test(original)
    const isNonSentenceStart = !sentenceStartIndices.has(startIndex) && /^[A-Z]/.test(original)
    if (isAllCaps || isCamelCase || isNonSentenceStart) properNounIndices.add(i)
  }

  const keys = new Set<string>()
  for (const i of properNounIndices) {
    keys.add(rawTokens[i].original.toLowerCase())
    if (properNounIndices.has(i + 1)) {
      keys.add(`${rawTokens[i].original.toLowerCase()} ${rawTokens[i + 1].original.toLowerCase()}`)
    }
  }
  return keys
}

async function main() {
  const sql = getSql()

  // candidate 全件を origin 記事タイトルと一緒に取得
  const rows = (await sql`
    SELECT
      tcp.tag_candidate_id AS pool_id,
      tcp.candidate_key,
      tcp.seen_count,
      ar.title AS origin_title
    FROM tag_candidate_pool tcp
    LEFT JOIN articles_raw ar ON ar.raw_article_id = tcp.latest_origin_raw_id::bigint
    WHERE tcp.review_status = 'candidate'
    ORDER BY tcp.seen_count DESC
  `) as Array<{
    pool_id: string | number
    candidate_key: string
    seen_count: string | number
    origin_title: string | null
  }>

  console.log(`対象候補: ${rows.length} 件 (dry-run: ${isDryRun})`)

  let keepCount = 0
  let rejectCount = 0
  const rejectIds: number[] = []

  for (const row of rows) {
    const key = row.candidate_key
    const title = row.origin_title ?? ''

    // Latin-script タイトルがない場合は非対象（日本語タイトル等）→ 棄却
    if (!title || /[^\x00-\x7F]/.test(title)) {
      rejectIds.push(Number(row.pool_id))
      rejectCount++
      continue
    }

    const properNouns = extractProperNounKeys(title)

    // candidate_key が固有名詞として抽出されるか（完全一致 or bigram の一部）
    const isProperNoun = properNouns.has(key) || [...properNouns].some((pn) => pn.includes(key) || key.includes(pn))

    if (isProperNoun) {
      keepCount++
    } else {
      rejectIds.push(Number(row.pool_id))
      rejectCount++
    }
  }

  console.log(`保持: ${keepCount} / 棄却: ${rejectCount}`)

  if (isDryRun) {
    // dry-run: 棄却候補の上位を表示
    const rejectSamples = rows
      .filter((r) => rejectIds.includes(Number(r.pool_id)))
      .slice(0, 20)
    console.log('\n棄却サンプル（上位20件）:')
    for (const r of rejectSamples) {
      console.log(`  "${r.candidate_key}" (${r.seen_count}回) origin: "${r.origin_title?.slice(0, 60) ?? 'N/A'}"`)
    }
    const keepSamples = rows
      .filter((r) => !rejectIds.includes(Number(r.pool_id)))
      .slice(0, 20)
    console.log('\n保持サンプル（上位20件）:')
    for (const r of keepSamples) {
      console.log(`  "${r.candidate_key}" (${r.seen_count}回) origin: "${r.origin_title?.slice(0, 60) ?? 'N/A'}"`)
    }
  } else {
    if (rejectIds.length > 0) {
      // バッチで UPDATE
      const CHUNK = 500
      for (let i = 0; i < rejectIds.length; i += CHUNK) {
        const chunk = rejectIds.slice(i, i + CHUNK)
        await sql`
          UPDATE tag_candidate_pool
          SET review_status = 'rejected'
          WHERE tag_candidate_id = ANY(${chunk}::bigint[])
        `
        process.stdout.write(`\r棄却更新: ${Math.min(i + CHUNK, rejectIds.length)}/${rejectIds.length}`)
      }
      console.log('\n完了')
    }
  }

  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
