import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { getSql } from '@/lib/db'
import * as simpleIcons from 'simple-icons'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function getGradient(hex: string) {
  // Simple darkening function to create a gradient from a hex color
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  
  const darken = (c: number) => Math.max(0, c - 40)
  const lighten = (c: number) => Math.min(255, c + 30)

  const start = `#${lighten(r).toString(16).padStart(2, '0')}${lighten(g).toString(16).padStart(2, '0')}${lighten(b).toString(16).padStart(2, '0')}`
  const end = `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`
  
  return { start: `#${hex}`, end }
}

function createIconSvg(tagKey: string, displayName: string): string {
  // Convert tag_key to format that matches simple-icons, e.g. "openai" -> "siOpenai"
  const normalized = tagKey.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  const siKey = `si${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
  
  // Try to find icon
  const icon = (simpleIcons as any)[siKey]

  let hex = '111827'
  let svgPath = ''
  
  if (icon) {
    hex = icon.hex
    svgPath = icon.path
  } else {
    // Generate deterministic color
    const hue = hashString(tagKey) % 360
    hex = hslToHex(hue, 60, 42)
  }

  const { start, end } = getGradient(hex)

  // Provide a beautiful 3D Glass Base and overlay the SVG path or a letter
  const iconInner = svgPath 
    ? `<path d="${svgPath}" fill="white" transform="scale(0.55) translate(9 9)" />`
    : `<text x="12" y="18" fill="white" font-family="system-ui, sans-serif" font-weight="900" font-size="14" text-anchor="middle">${displayName.charAt(0).toUpperCase()}</text>`

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${start}" />
      <stop offset="100%" stop-color="${end}" />
    </linearGradient>
    <linearGradient id="border" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="white" stop-opacity="0.6" />
      <stop offset="100%" stop-color="white" stop-opacity="0.1" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.3" />
    </filter>
  </defs>
  <!-- Base Shape -->
  <rect x="1" y="1" width="22" height="22" rx="6" fill="url(#bg)" filter="url(#shadow)" />
  <!-- Glass Reflection -->
  <path d="M 1 7 Q 1 1 7 1 L 17 1 Q 23 1 23 7 L 23 12 Q 12 10 1 12 Z" fill="white" fill-opacity="0.15" />
  <!-- Inner Content -->
  ${iconInner}
  <!-- Border -->
  <rect x="1" y="1" width="22" height="22" rx="6" fill="none" stroke="url(#border)" stroke-width="0.5" />
</svg>
  `.trim()
}

function hslToHex(h: number, s: number, l: number) {
  l /= 100
  const a = s * Math.min(l, 1 - l) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `${f(0)}${f(8)}${f(4)}`
}

async function main() {
  const sql = getSql()
  const tags = await sql`
    SELECT tag_key, display_name 
    FROM tags_master
    WHERE is_active = true
  `

  const outDir = join(__dirname, '../public/thumbs/assets')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  let generatedCount = 0

  for (const tag of tags as any[]) {
    const svg = createIconSvg(tag.tag_key, tag.display_name)
    const outputPath = join(outDir, `${tag.tag_key}.svg`)
    fs.writeFileSync(outputPath, svg)
    generatedCount++
  }

  console.log(`Generated ${generatedCount} SVG icons.`)
  process.exit(0)
}

main().catch(console.error)
