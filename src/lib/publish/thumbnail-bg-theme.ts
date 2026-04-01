import type { CSSProperties } from 'react'

const FALLBACK_THEME = 'default'

export const THUMBNAIL_BG_STYLES: Record<string, CSSProperties> = {
  default: { background: 'linear-gradient(145deg, #ffe8d6, #ffd8bd)' },
  'adj-infra': { background: 'linear-gradient(145deg, #dbeafe, #93c5fd)' },
  'adj-security': { background: 'linear-gradient(145deg, #fee2e2, #fca5a5)' },
  'adj-robotics': { background: 'linear-gradient(145deg, #e2e8f0, #94a3b8)' },
  'adj-media': { background: 'linear-gradient(145deg, #f5d0fe, #c4b5fd)' },
  'adj-finance': { background: 'linear-gradient(145deg, #dcfce7, #86efac)' },
  'adj-healthcare': { background: 'linear-gradient(145deg, #fecdd3, #fda4af)' },
  'adj-education': { background: 'linear-gradient(145deg, #fde68a, #fcd34d)' },
  'adj-legal': { background: 'linear-gradient(145deg, #e0e7ff, #a5b4fc)' },
  'adj-gaming': { background: 'linear-gradient(145deg, #ddd6fe, #a78bfa)' },
  'adj-hardware': { background: 'linear-gradient(145deg, #cffafe, #67e8f9)' },
}

export function resolveThumbnailBgStyle(themeKey: string | null | undefined): CSSProperties {
  if (!themeKey) return THUMBNAIL_BG_STYLES[FALLBACK_THEME]
  return THUMBNAIL_BG_STYLES[themeKey] ?? THUMBNAIL_BG_STYLES[FALLBACK_THEME]
}
