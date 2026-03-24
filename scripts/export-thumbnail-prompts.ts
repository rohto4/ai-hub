#!/usr/bin/env npx tsx
/**
 * 昇格済みタグから高品質サムネイルアセット生成用のプロンプトを書き出す
 * Usage: npx tsx scripts/export-thumbnail-prompts.ts --output artifacts/thumbnail-prompts.md
 */
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

import { getSql } from '@/lib/db'
import { hasThumbnailTagRegistryEntry } from '@/lib/publish/thumbnail-tag-registry'

async function exportThumbnailPrompts() {
  const sql = getSql()
  const outputPath = process.argv.find(arg => arg.startsWith('--output'))?.split('=')[1] ?? 'artifacts/thumbnail-prompts.md'

  const tags = (await sql`
    SELECT tag_key, display_name, description, article_count
    FROM tags_master
    WHERE is_active = true
    ORDER BY article_count DESC
  `) as Array<{ tag_key: string; display_name: string; description: string | null; article_count: number }>

  let markdown = `# Thumbnail Asset Generation Prompts\n\n`
  markdown += `Generated at: ${new Date().toLocaleString()}\n\n`

  for (const tag of tags) {
    const hasAsset = hasThumbnailTagRegistryEntry(tag.tag_key)
    const status = hasAsset ? '✅ Registered' : '❌ Pending'
    
    markdown += `## ${tag.display_name} (\`${tag.tag_key}\`)\n`
    markdown += `- **Status**: ${status}\n`
    markdown += `- **Articles**: ${tag.article_count}\n`
    markdown += `- **Description**: ${tag.description || 'No description'}\n\n`
    
    markdown += `### Gemini Prompt\n`
    markdown += `> A high-quality 3D isometric icon representing **${tag.display_name}**. ${tag.description ? `Concept: ${tag.description}. ` : ''}Minimalist, sleek, modern tech aesthetic. Glossy metallic and glass textures, soft volumetric lighting. Clean lines, futuristic look. Isolated on a pure transparent background. 8k resolution, cinematic render, Octane style.\n\n`
    markdown += `---\n\n`
  }

  const dir = dirname(outputPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(outputPath, markdown)

  console.log(`Prompts exported to: ${outputPath}`)
  process.exit(0)
}

exportThumbnailPrompts().catch((error) => {
  console.error(error)
  process.exit(1)
})
