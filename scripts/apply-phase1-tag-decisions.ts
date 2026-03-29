#!/usr/bin/env npx tsx
import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSql } from '@/lib/db'
import {
  buildPhase1TagDecisionPlan,
  toComparablePhase1DecisionToken,
  type Phase1FinalDecisions,
} from '@/lib/tags/phase1-final-decisions'
import { refreshTagArticleCounts } from '@/lib/db/enrichment'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

function readArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function hasArg(flag: string): boolean {
  return process.argv.includes(flag)
}

function loadDecisions(filePath: string): Phase1FinalDecisions {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Phase1FinalDecisions
}

async function main(): Promise<void> {
  const decisionsPath = readArg(
    '--file',
    path.join(process.cwd(), 'af-20260326', 'phase1-retag', 'outputs', 'final-tag-decisions.json'),
  )
  const apply = hasArg('--apply')
  const skipRetag = hasArg('--skip-retag')
  const decisions = loadDecisions(decisionsPath)
  const plan = buildPhase1TagDecisionPlan(decisions)

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          decisionsPath,
          adoptedPrimaryTags: plan.adoptedPrimaryTags,
          deactivateComparableKeys: plan.deactivateComparableKeys,
          rejectedCandidateKeys: plan.rejectedCandidateKeys.length,
          holdCandidateKeys: plan.holdCandidateKeys.length,
          nextAction: skipRetag
            ? 'Run with --apply to persist decisions'
            : 'Run with --apply to persist decisions, then run db:retag-layer2-layer4',
        },
        null,
        2,
      ),
    )
    return
  }

  const sql = getSql()
  await sql`BEGIN`
  try {
    const adoptedSummary: Array<{ tagKey: string; tagId: string }> = []

    for (const adopted of plan.adoptedPrimaryTags) {
      const inserted = (await sql`
        INSERT INTO tags_master (tag_key, display_name, description, is_active, updated_at)
        VALUES (
          ${adopted.normalizedKey},
          ${adopted.displayName},
          ${'Promoted from af-20260326/phase1-retag/outputs/final-tag-decisions.json'},
          true,
          now()
        )
        ON CONFLICT (tag_key) DO UPDATE
          SET display_name = EXCLUDED.display_name,
              is_active = true,
              updated_at = now()
        RETURNING tag_id::text
      `) as Array<{ tag_id: string }>

      const tagId = inserted[0]!.tag_id
      adoptedSummary.push({ tagKey: adopted.normalizedKey, tagId })

      for (const keyword of adopted.keywords) {
        await sql`
          INSERT INTO tag_keywords (tag_id, keyword, use_for_collection, use_for_search)
          VALUES (${tagId}::uuid, ${keyword}, true, true)
          ON CONFLICT (tag_id, keyword) DO NOTHING
        `
      }

      await sql`
        UPDATE tag_candidate_pool
        SET
          review_status = 'promoted',
          promoted_tag_id = ${tagId}::uuid,
          updated_at = now()
        WHERE ${toComparablePhase1DecisionToken(adopted.sourceKey)} =
          regexp_replace(lower(candidate_key), '[^[:alnum:]]', '', 'g')
      `
    }

    if (plan.deactivateComparableKeys.length > 0) {
      await sql`
        UPDATE tags_master
        SET is_active = false, updated_at = now()
        WHERE regexp_replace(lower(tag_key), '[^[:alnum:]]', '', 'g') = ANY(${plan.deactivateComparableKeys}::text[])
      `

      const deactivatedRows = (await sql`
        SELECT tag_id::text
        FROM tags_master
        WHERE regexp_replace(lower(tag_key), '[^[:alnum:]]', '', 'g') = ANY(${plan.deactivateComparableKeys}::text[])
      `) as Array<{ tag_id: string }>
      const deactivatedTagIds = deactivatedRows.map((row) => row.tag_id)

      if (deactivatedTagIds.length > 0) {
        await sql`
          DELETE FROM public_article_tags
          WHERE tag_id = ANY(${deactivatedTagIds}::uuid[])
        `

        await sql`
          DELETE FROM articles_enriched_tags
          WHERE tag_id = ANY(${deactivatedTagIds}::uuid[])
        `
      }
    }

    if (plan.rejectedCandidateKeys.length > 0) {
      const rejectedComparableKeys = plan.rejectedCandidateKeys.map(toComparablePhase1DecisionToken)
      await sql`
        UPDATE tag_candidate_pool
        SET review_status = 'rejected', updated_at = now()
        WHERE regexp_replace(lower(candidate_key), '[^[:alnum:]]', '', 'g') = ANY(${rejectedComparableKeys}::text[])
      `
    }

    await refreshTagArticleCounts()
    await sql`COMMIT`

    console.log(
      JSON.stringify(
        {
          applied: true,
          adoptedPrimaryTags: adoptedSummary.map((item) => item.tagKey),
          deactivatedComparableKeys: plan.deactivateComparableKeys,
          rejectedCandidateCount: plan.rejectedCandidateKeys.length,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    await sql`ROLLBACK`
    throw error
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
