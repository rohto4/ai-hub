import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI Trend Hub',
    short_name: 'AIHub',
    description: 'AIトレンドを100字要約で追うための日本語ハブ',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff9f3',
    theme_color: '#f28a43',
    lang: 'ja',
    icons: [
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
