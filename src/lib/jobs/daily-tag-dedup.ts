/**
 * タグ候補の自動重複検出ジョブ
 * - seen_count >= 4 の候補を既存タグと Gemini で照合
 * - マッチした候補 → tag_keywords に追加して status='promoted'
 * - マッチしなかった候補 → status='candidate' のまま（管理画面レビュー待ち）
 */
import { getSql } from '@/lib/db'
import { finishJobRun, startJobRun } from '@/lib/db/job-runs'
import { detectTagDuplicates, type ExistingTag, type TagDedupCandidate } from '@/lib/tags/dedup'

const MIN_SEEN_COUNT = 4
const BATCH_SIZE = 30  // Gemini への 1 回あたりの候補数

export type TagDedupResult = {
  checked: number
  merged: number
  noMatch: number
}

export async function runDailyTagDedup(): Promise<TagDedupResult> {
  const sql = getSql()
  const jobRunId = await startJobRun({ jobName: 'daily-tag-dedup', metadata: {} })

  let merged = 0
  let noMatch = 0
  let lastError: string | null = null

  try {
    // 照合対象の候補を取得
    const candidates = (await sql`
      SELECT candidate_key, seen_count
      FROM tag_candidate_pool
      WHERE review_status = 'candidate'
        AND seen_count >= ${MIN_SEEN_COUNT}
      ORDER BY seen_count DESC
      LIMIT 200
    `) as Array<{ candidate_key: string; seen_count: string | number }>

    // 既存タグを取得
    const existingTags = (await sql`
      SELECT tag_id::text, tag_key, display_name
      FROM tags_master
      WHERE is_active = true
      ORDER BY display_name
    `) as Array<{ tag_id: string; tag_key: string; display_name: string }>

    if (candidates.length === 0 || existingTags.length === 0) {
      await finishJobRun({ jobRunId, status: 'completed', processedCount: 0, successCount: 0, failedCount: 0, metadata: { checked: 0, merged: 0, noMatch: 0 }, lastError: null })
      return { checked: 0, merged: 0, noMatch: 0 }
    }

    const dedupCandidates: TagDedupCandidate[] = candidates.map((c) => ({
      candidateKey: c.candidate_key,
      seenCount: Number(c.seen_count),
    }))
    const dedupTags: ExistingTag[] = existingTags.map((t) => ({
      tagId: t.tag_id,
      tagKey: t.tag_key,
      displayName: t.display_name,
    }))

    // バッチに分けて Gemini で照合
    for (let i = 0; i < dedupCandidates.length; i += BATCH_SIZE) {
      const batch = dedupCandidates.slice(i, i + BATCH_SIZE)

      try {
        const results = await detectTagDuplicates(batch, dedupTags)

        for (const result of results) {
          if (result.matchedTagId && result.confidence === 'high') {
            // 既存タグに candidate_key をキーワードとして登録
            await sql`
              INSERT INTO tag_keywords (tag_id, keyword)
              VALUES (${result.matchedTagId}::uuid, ${result.candidateKey})
              ON CONFLICT (tag_id, keyword) DO NOTHING
            `
            // 候補を promoted に
            await sql`
              UPDATE tag_candidate_pool
              SET review_status = 'promoted'
              WHERE candidate_key = ${result.candidateKey}
            `
            merged++
            console.log(`[tag-dedup] "${result.candidateKey}" → "${result.matchedTagKey}" にマージ`)
          } else {
            noMatch++
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'batch error'
        console.error('[tag-dedup] batch error:', lastError)
        noMatch += batch.length
      }
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'Unknown error'
  }

  const checked = merged + noMatch
  await finishJobRun({
    jobRunId,
    status: lastError && merged === 0 ? 'failed' : 'completed',
    processedCount: checked,
    successCount: merged,
    failedCount: 0,
    metadata: { checked, merged, noMatch },
    lastError,
  })

  return { checked, merged, noMatch }
}
