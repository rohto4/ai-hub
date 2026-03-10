import type { Metadata } from 'next'
import { BIZ_UDPGothic } from 'next/font/google'
import './globals.css'

const bizUDPGothic = BIZ_UDPGothic({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-biz-udp',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: 'AI Trend Hub',
  description: 'AIトレンドを毎日キャッチし、100字要約で素早く把握するためのハブ。',
  openGraph: {
    title: 'AI Trend Hub',
    description: 'AIトレンドを毎日キャッチする要約ハブ。',
    type: 'website',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Trend Hub',
    description: 'AIトレンドを毎日キャッチする要約ハブ。',
    images: ['/opengraph-image'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={`${bizUDPGothic.variable} font-sans bg-bg text-ink antialiased`}>
        {children}
      </body>
    </html>
  )
}
