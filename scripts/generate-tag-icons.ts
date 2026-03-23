import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { getSql } from '@/lib/db'
import * as simpleIcons from 'simple-icons'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

const CUSTOM_ICONS: Record<string, { path: string; hex: string }> = {
  openai: {
    hex: '412991',
    path: 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.033 6.033 0 0 0 5.438-3.172 5.96 5.96 0 0 0 3.9293-2.9001 6.056 6.056 0 0 0-.3453-8.1068ZM10.5186 22.3831a4.237 4.237 0 0 1-2.859-1.1448l.0673-.0382 5.4851-3.1614a.9255.9255 0 0 0 .4631-.8061v-6.937l2.0006 1.155a.083.083 0 0 1 .0427.0716v5.3371a4.2562 4.2562 0 0 1-5.2014 5.5255ZM4.1165 17.151a4.2464 4.2464 0 0 1-.806-2.9664l.0626.0475 5.4852 3.1662a.916.916 0 0 0 .931-.0047l6.0094-3.4682v2.308a.0877.0877 0 0 1-.0427.076l-4.6205 2.6687a4.2562 4.2562 0 0 1-7.019-1.827ZM2.2536 9.387A4.2657 4.2657 0 0 1 4.31 6.6433l-.0333.076 2.738 4.7431a.9255.9255 0 0 0 .4678.403l6.0046 3.473-2.0006 1.155a.083.083 0 0 1-.0853 0L6.7806 13.824a4.261 4.261 0 0 1-4.527-4.437Zm11.233-7.14a4.2464 4.2464 0 0 1 2.859 1.1449l-.0673.0381-5.4852 3.1614a.9255.9255 0 0 0-.463.8062v6.9369L8.3305 13.18a.083.083 0 0 1-.0428-.0715V7.7712a4.2562 4.2562 0 0 1 5.2005-5.5255Zm6.3985 5.232a4.2464 4.2464 0 0 1 .806 2.9664l-.0626-.0475-5.4852-3.1661a.916.916 0 0 0-.931.0047l-6.0094 3.4682V8.3967a.0877.0877 0 0 1 .0427-.0761l4.6205-2.6687a4.2562 4.2562 0 0 1 7.019 1.827Zm1.861 7.764a4.2657 4.2657 0 0 1-2.0564 2.7437l.0333-.076-2.738-4.7431a.9255.9255 0 0 0-.4678-.403l-6.0046-3.473 2.0006-1.155a.083.083 0 0 1 .0853 0l4.6205 2.6688a4.261 4.261 0 0 1 4.527 4.437ZM8.8687 14.887l-3.4682-2.0005 3.4682-2.0006v4.0011Zm6.2625 0v-4.001l3.4683 2.0005-3.4683 2.0006ZM12 10.3791l-2.6006 1.5003 2.6006 1.5003 2.6006-1.5003L12 10.379Z'
  },
  chatgpt: {
    hex: '10A37F',
    path: 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.033 6.033 0 0 0 5.438-3.172 5.96 5.96 0 0 0 3.9293-2.9001 6.056 6.056 0 0 0-.3453-8.1068ZM10.5186 22.3831a4.237 4.237 0 0 1-2.859-1.1448l.0673-.0382 5.4851-3.1614a.9255.9255 0 0 0 .4631-.8061v-6.937l2.0006 1.155a.083.083 0 0 1 .0427.0716v5.3371a4.2562 4.2562 0 0 1-5.2014 5.5255ZM4.1165 17.151a4.2464 4.2464 0 0 1-.806-2.9664l.0626.0475 5.4852 3.1662a.916.916 0 0 0 .931-.0047l6.0094-3.4682v2.308a.0877.0877 0 0 1-.0427.076l-4.6205 2.6687a4.2562 4.2562 0 0 1-7.019-1.827ZM2.2536 9.387A4.2657 4.2657 0 0 1 4.31 6.6433l-.0333.076 2.738 4.7431a.9255.9255 0 0 0 .4678.403l6.0046 3.473-2.0006 1.155a.083.083 0 0 1-.0853 0L6.7806 13.824a4.261 4.261 0 0 1-4.527-4.437Zm11.233-7.14a4.2464 4.2464 0 0 1 2.859 1.1449l-.0673.0381-5.4852 3.1614a.9255.9255 0 0 0-.463.8062v6.9369L8.3305 13.18a.083.083 0 0 1-.0428-.0715V7.7712a4.2562 4.2562 0 0 1 5.2005-5.5255Zm6.3985 5.232a4.2464 4.2464 0 0 1 .806 2.9664l-.0626-.0475-5.4852-3.1661a.916.916 0 0 0-.931.0047l-6.0094 3.4682V8.3967a.0877.0877 0 0 1 .0427-.0761l4.6205-2.6687a4.2562 4.2562 0 0 1 7.019 1.827Zm1.861 7.764a4.2657 4.2657 0 0 1-2.0564 2.7437l.0333-.076-2.738-4.7431a.9255.9255 0 0 0-.4678-.403l-6.0046-3.473 2.0006-1.155a.083.083 0 0 1 .0853 0l4.6205 2.6688a4.261 4.261 0 0 1 4.527 4.437ZM8.8687 14.887l-3.4682-2.0005 3.4682-2.0006v4.0011Zm6.2625 0v-4.001l3.4683 2.0005-3.4683 2.0006ZM12 10.3791l-2.6006 1.5003 2.6006 1.5003 2.6006-1.5003L12 10.379Z'
  },
  'gpt-5': {
    hex: '10A37F',
    path: 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.033 6.033 0 0 0 5.438-3.172 5.96 5.96 0 0 0 3.9293-2.9001 6.056 6.056 0 0 0-.3453-8.1068ZM10.5186 22.3831a4.237 4.237 0 0 1-2.859-1.1448l.0673-.0382 5.4851-3.1614a.9255.9255 0 0 0 .4631-.8061v-6.937l2.0006 1.155a.083.083 0 0 1 .0427.0716v5.3371a4.2562 4.2562 0 0 1-5.2014 5.5255ZM4.1165 17.151a4.2464 4.2464 0 0 1-.806-2.9664l.0626.0475 5.4852 3.1662a.916.916 0 0 0 .931-.0047l6.0094-3.4682v2.308a.0877.0877 0 0 1-.0427.076l-4.6205 2.6687a4.2562 4.2562 0 0 1-7.019-1.827ZM2.2536 9.387A4.2657 4.2657 0 0 1 4.31 6.6433l-.0333.076 2.738 4.7431a.9255.9255 0 0 0 .4678.403l6.0046 3.473-2.0006 1.155a.083.083 0 0 1-.0853 0L6.7806 13.824a4.261 4.261 0 0 1-4.527-4.437Zm11.233-7.14a4.2464 4.2464 0 0 1 2.859 1.1449l-.0673.0381-5.4852 3.1614a.9255.9255 0 0 0-.463.8062v6.9369L8.3305 13.18a.083.083 0 0 1-.0428-.0715V7.7712a4.2562 4.2562 0 0 1 5.2005-5.5255Zm6.3985 5.232a4.2464 4.2464 0 0 1 .806 2.9664l-.0626-.0475-5.4852-3.1661a.916.916 0 0 0-.931.0047l-6.0094 3.4682V8.3967a.0877.0877 0 0 1 .0427-.0761l4.6205-2.6687a4.2562 4.2562 0 0 1 7.019 1.827Zm1.861 7.764a4.2657 4.2657 0 0 1-2.0564 2.7437l.0333-.076-2.738-4.7431a.9255.9255 0 0 0-.4678-.403l-6.0046-3.473 2.0006-1.155a.083.083 0 0 1 .0853 0l4.6205 2.6688a4.261 4.261 0 0 1 4.527 4.437ZM8.8687 14.887l-3.4682-2.0005 3.4682-2.0006v4.0011Zm6.2625 0v-4.001l3.4683 2.0005-3.4683 2.0006ZM12 10.3791l-2.6006 1.5003 2.6006 1.5003 2.6006-1.5003L12 10.379Z'
  },
  gemini: { hex: '8E75B2', path: simpleIcons.siGooglegemini.path },
  'meta-ai': { hex: '0467DF', path: simpleIcons.siMeta.path },
  'google-deepmind': { hex: '4285F4', path: simpleIcons.siGoogle.path },
  grok: { hex: '000000', path: simpleIcons.siX.path },
  'github-copilot': { hex: '181717', path: simpleIcons.siGithubcopilot.path },
  'microsoft-copilot': { hex: '0078D4', path: 'M11.4 24l-3.26-3.87a9.23 9.23 0 01-1.34-11.75l-.2-.23c-1.38 1.4-2.14 3.32-2.14 5.3 0 2.22.95 4.3 2.62 5.76l2.12 1.84v3.83l2.2-2.88z M22.25 15.65v-3.76L20 8.87l-2.34.82L19.42 12v3.3l-5.63 3.68v2.4l8.46-5.73z M12.87 2.06a9.34 9.34 0 016.54 3.12l-1.63 1.9a7 7 0 00-4.9-2.3c-3.1 0-5.75 2.15-6.62 5.07l-2.37-.8c1.17-3.9 4.74-6.99 8.98-6.99z' },
  llm: { hex: '2563EB', path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-5.5V9.5c0-.83.67-1.5 1.5-1.5h1c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5h-1c-.83 0-1.5-.67-1.5-1.5zM11 9.5v5h2v-5h-2z' },
  llama: { hex: '0467DF', path: simpleIcons.siMeta.path },
  'amazon-q': { hex: 'FF9900', path: 'M14.93 17.5c-1.89.84-4.59 1.34-6.84 1.34-2.85 0-4.99-.44-6.26-1.04-.37-.17-.4-.68-.04-.89.36-.21.84-.11 1.2.06 1.15.54 3.1 1.01 5.48 1.01 2.27 0 4.67-.47 6.46-1.22.42-.18.84.1 1.02.44.18.34-.14.77-1.02 1.3M23.6 15.65c-.17.38-1.58.26-2.58.11l-3.32-.47c-.52-.08-.66-.66-.17-.89l3.52-1.63c.61-.28 1.25.04 1.3.73.01.21-.19.98-.75 2.15' },
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function getGradient(hex: string) {
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  
  const darken = (c: number) => Math.max(0, c - 40)
  const lighten = (c: number) => Math.min(255, c + 30)

  const start = `#${lighten(r).toString(16).padStart(2, '0')}${lighten(g).toString(16).padStart(2, '0')}${lighten(b).toString(16).padStart(2, '0')}`
  const end = `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`
  
  return { start: `#${hex}`, end }
}

function generateGeometricPattern(seed: number): string {
  // Generates a cool futuristic geometric pattern instead of a letter
  const shapes = []
  
  // Base central shape
  const type1 = seed % 3
  if (type1 === 0) {
    shapes.push(`<circle cx="12" cy="12" r="5" fill="none" stroke="white" stroke-width="2" />`)
    shapes.push(`<circle cx="12" cy="12" r="2" fill="white" />`)
  } else if (type1 === 1) {
    shapes.push(`<rect x="8" y="8" width="8" height="8" rx="2" fill="none" stroke="white" stroke-width="2" transform="rotate(45 12 12)" />`)
    shapes.push(`<circle cx="12" cy="12" r="1.5" fill="white" />`)
  } else {
    shapes.push(`<path d="M12 6 L18 16 L6 16 Z" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round" />`)
    shapes.push(`<circle cx="12" cy="13" r="1.5" fill="white" />`)
  }

  // Orbital/Accent shapes
  const orbitCount = (seed % 3) + 1
  for (let i = 0; i < orbitCount; i++) {
    const angle = ((seed * (i + 1)) % 360) * (Math.PI / 180)
    const distance = 8 + (seed % 2)
    const cx = 12 + Math.cos(angle) * distance
    const cy = 12 + Math.sin(angle) * distance
    shapes.push(`<circle cx="${cx}" cy="${cy}" r="1.5" fill="white" fill-opacity="0.7" />`)
  }

  // Connecting lines
  if (seed % 2 === 0) {
    shapes.push(`<path d="M4 12 L8 12 M16 12 L20 12" stroke="white" stroke-width="1.5" stroke-opacity="0.4" stroke-linecap="round" />`)
  } else {
    shapes.push(`<path d="M12 4 L12 8 M12 16 L12 20" stroke="white" stroke-width="1.5" stroke-opacity="0.4" stroke-linecap="round" />`)
  }

  return shapes.join('\n  ')
}

function createIconSvg(tagKey: string, displayName: string): string {
  const normalized = tagKey.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()
  
  // 1. Check Custom mapping
  // 2. Check simple-icons with direct match
  // 3. Check simple-icons with no dash match
  
  let icon: any = CUSTOM_ICONS[normalized]
  if (!icon) {
    const siKey = `si${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
    const siKeyNoDash = `si${normalized.replace(/-/g, '').charAt(0).toUpperCase()}${normalized.replace(/-/g, '').slice(1)}`
    icon = (simpleIcons as any)[siKey] || (simpleIcons as any)[siKeyNoDash]
  }

  const seed = hashString(tagKey)

  let hex = '111827'
  let svgPath = ''
  let innerContent = ''
  
  if (icon) {
    hex = icon.hex
    svgPath = icon.path
    innerContent = `<path d="${svgPath}" fill="white" transform="scale(0.55) translate(9 9)" />`
  } else {
    const hue = seed % 360
    hex = hslToHex(hue, 70, 45) // Slightly more saturated for geometric patterns
    innerContent = `<g>${generateGeometricPattern(seed)}</g>`
  }

  const { start, end } = getGradient(hex)

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
  ${innerContent}
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
