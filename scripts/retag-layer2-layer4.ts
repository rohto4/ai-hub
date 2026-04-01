#!/usr/bin/env npx tsx
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSql } from '@/lib/db'
import { listAdjacentTagKeywords } from '@/lib/db/adjacent-tags'
import {
  refreshAdjacentTagArticleCounts,
  refreshTagArticleCounts,
} from '@/lib/db/enrichment'
import { listActiveTagReferences, listCollectionTagKeywords } from '@/lib/db/tags'
import { buildInternalThumbnailUrl } from '@/lib/publish/thumbnail-template'
import { matchAdjacentTagsFromKeywords, resolveThumbnailBgTheme } from '@/lib/tags/adjacent'
import { matchTagsFromKeywords } from '@/lib/tags/match'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

type ArticleRow = {
  enriched_article_id: number
  canonical_url: string
  title: string
  summary_100: string
  summary_200: string | null
  source_type: 'official' | 'blog' | 'news' | 'video' | 'alerts' | 'paper'
  source_category: 'llm' | 'agent' | 'voice' | 'policy' | 'safety' | 'search' | 'news'
  content_language: 'ja' | 'en' | null
}

type RetagResult = {
  enrichedArticleId: number
  matchedTagIds: string[]
  adjacentTagIds: string[]
  thumbnailBgTheme: string | null
  thumbnailUrl: string | null
}

const CHUNK_SIZE = 200

function toChunks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function hasArg(flag: string): boolean {
  return process.argv.includes(flag)
}

async function main(): Promise<void> {
  const dryRun = hasArg('--dry-run')
  const sql = getSql()
  const [tagRefs, tagKeywords, adjacentKeywords] = await Promise.all([
    listActiveTagReferences(),
    listCollectionTagKeywords(),
    listAdjacentTagKeywords(),
  ])

  const sourceCategoryTagIdByKey = new Map(
    tagRefs.map((ref) => [ref.tagKey, ref.id] as const),
  )
  const paperTagId = sourceCategoryTagIdByKey.get('paper') ?? null

  const rows = (await sql`
    SELECT
      ae.enriched_article_id,
      ae.canonical_url,
      ae.title,
      ae.summary_100,
      ae.summary_200,
      ae.source_type,
      ae.source_category,
      ae.content_language
    FROM articles_enriched ae
    WHERE ae.ai_processing_state = 'completed'
      AND ae.dedupe_status = 'unique'
    ORDER BY ae.enriched_article_id ASC
  `) as ArticleRow[]

  const refById = new Map(tagRefs.map((ref) => [ref.id, ref] as const))
  const retagged: RetagResult[] = rows.map((row) => {
    const summary = row.summary_200 ?? row.summary_100
    let matchedTagIds: string[]
    if (row.source_type === 'paper') {
      matchedTagIds = paperTagId ? [paperTagId] : []
    } else {
      matchedTagIds = matchTagsFromKeywords(tagKeywords, row.title, summary)
      const sourceCategoryTagId = sourceCategoryTagIdByKey.get(row.source_category)
      if (sourceCategoryTagId && !matchedTagIds.includes(sourceCategoryTagId)) {
        matchedTagIds.push(sourceCategoryTagId)
      }
    }

    const adjacentMatches = matchAdjacentTagsFromKeywords(adjacentKeywords, row.title, summary, 2)
    const thumbnailBgTheme = resolveThumbnailBgTheme(adjacentMatches)
    const matchedTags = matchedTagIds
      .map((tagId) => refById.get(tagId))
      .filter((ref): ref is NonNullable<typeof ref> => Boolean(ref))
      .map((ref) => ({ tagKey: ref.tagKey, displayName: ref.displayName }))

    const thumbnailUrl = buildInternalThumbnailUrl({
      canonicalUrl: row.canonical_url,
      title: row.title,
      summary100: row.summary_100,
      summary200: row.summary_200,
      sourceType: row.source_type,
      sourceCategory: row.source_category,
      contentLanguage: row.content_language,
      matchedTags,
      thumbnailBgTheme,
    })

    return {
      enrichedArticleId: row.enriched_article_id,
      matchedTagIds,
      adjacentTagIds: adjacentMatches.map((match) => match.adjacentTagId),
      thumbnailBgTheme,
      thumbnailUrl,
    }
  })

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          total: retagged.length,
          sample: retagged.slice(0, 5),
        },
        null,
        2,
      ),
    )
    return
  }

  await sql`BEGIN`
  try {
    for (const chunk of toChunks(retagged, CHUNK_SIZE)) {
      const enrichedIds = chunk.map((item) => item.enrichedArticleId)
      const thumbnailBgThemes = chunk.map((item) => item.thumbnailBgTheme)
      const thumbnailUrls = chunk.map((item) => item.thumbnailUrl)

      await sql`
        UPDATE articles_enriched ae
        SET
          thumbnail_bg_theme = t.thumbnail_bg_theme,
          thumbnail_url = t.thumbnail_url,
          updated_at = now()
        FROM (
          SELECT
            enriched_id::bigint AS enriched_article_id,
            thumbnail_bg_theme,
            thumbnail_url
          FROM unnest(
            ${enrichedIds}::bigint[],
            ${thumbnailBgThemes}::text[],
            ${thumbnailUrls}::text[]
          ) AS x(enriched_id, thumbnail_bg_theme, thumbnail_url)
        ) t
        WHERE ae.enriched_article_id = t.enriched_article_id
      `

      await sql`DELETE FROM articles_enriched_tags WHERE enriched_article_id = ANY(${enrichedIds}::bigint[])`
      await sql`DELETE FROM articles_enriched_adjacent_tags WHERE enriched_article_id = ANY(${enrichedIds}::bigint[])`

      const tagRows = chunk.flatMap((item) =>
        item.matchedTagIds.map((tagId, index) => ({
          enriched_article_id: item.enrichedArticleId,
          tag_id: tagId,
          is_primary: index === 0,
        })),
      )
      if (tagRows.length > 0) {
        await sql`
          INSERT INTO articles_enriched_tags (enriched_article_id, tag_id, tag_source, is_primary)
          SELECT enriched_article_id::bigint, tag_id::uuid, 'master', is_primary
          FROM unnest(
            ${tagRows.map((row) => row.enriched_article_id)}::bigint[],
            ${tagRows.map((row) => row.tag_id)}::text[],
            ${tagRows.map((row) => row.is_primary)}::boolean[]
          ) AS t(enriched_article_id, tag_id, is_primary)
        `
      }

      const adjacentRows = chunk.flatMap((item) =>
        item.adjacentTagIds.map((adjacentTagId, sortOrder) => ({
          enriched_article_id: item.enrichedArticleId,
          adjacent_tag_id: adjacentTagId,
          sort_order: sortOrder,
        })),
      )
      if (adjacentRows.length > 0) {
        await sql`
          INSERT INTO articles_enriched_adjacent_tags (enriched_article_id, adjacent_tag_id, sort_order)
          SELECT enriched_article_id::bigint, adjacent_tag_id::uuid, sort_order::int
          FROM unnest(
            ${adjacentRows.map((row) => row.enriched_article_id)}::bigint[],
            ${adjacentRows.map((row) => row.adjacent_tag_id)}::text[],
            ${adjacentRows.map((row) => row.sort_order)}::int[]
          ) AS t(enriched_article_id, adjacent_tag_id, sort_order)
        `
      }
    }

    await refreshTagArticleCounts()
    await refreshAdjacentTagArticleCounts()

    await sql`DELETE FROM public_article_tags`
    await sql`DELETE FROM public_article_adjacent_tags`

    await sql`
      INSERT INTO public_article_tags (public_article_id, tag_id, sort_order)
      SELECT
        pa.public_article_id,
        aet.tag_id,
        ROW_NUMBER() OVER (
          PARTITION BY pa.public_article_id
          ORDER BY aet.is_primary DESC, aet.tag_id
        )::int - 1
      FROM public_articles pa
      JOIN articles_enriched_tags aet
        ON aet.enriched_article_id = pa.enriched_article_id
    `

    await sql`
      INSERT INTO public_article_adjacent_tags (public_article_id, adjacent_tag_id, sort_order)
      SELECT
        pa.public_article_id,
        aeat.adjacent_tag_id,
        aeat.sort_order
      FROM public_articles pa
      JOIN articles_enriched_adjacent_tags aeat
        ON aeat.enriched_article_id = pa.enriched_article_id
    `

    const synced = (await sql`
      UPDATE public_articles pa
      SET
        thumbnail_url = ae.thumbnail_url,
        thumbnail_bg_theme = ae.thumbnail_bg_theme,
        updated_at = now()
      FROM articles_enriched ae
      WHERE ae.enriched_article_id = pa.enriched_article_id
        AND (
          pa.thumbnail_url IS DISTINCT FROM ae.thumbnail_url
          OR pa.thumbnail_bg_theme IS DISTINCT FROM ae.thumbnail_bg_theme
        )
      RETURNING pa.public_article_id
    `) as Array<{ public_article_id: string }>

    await sql`COMMIT`

    console.log(
      JSON.stringify(
        {
          retaggedCount: retagged.length,
          publicArticlesSynced: synced.length,
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
