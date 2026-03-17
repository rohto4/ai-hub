import Link from 'next/link'
import { PublicScaffold } from '@/components/site/PublicScaffold'

const feedLinks = [
  { href: '/feed', label: '全体 RSS' },
  { href: '/category/official', label: 'official レーン' },
  { href: '/category/blog', label: 'blog レーン' },
  { href: '/category/paper', label: 'paper レーン' },
  { href: '/category/agent', label: 'agent topic' },
]

export default function FeedPage() {
  return (
    <PublicScaffold title="Feed" description="公開面の RSS とカテゴリ導線を確認するページです。">
      <div className="grid gap-4 md:grid-cols-2">
        {feedLinks.map((feed) => (
          <Link key={feed.href + feed.label} href={feed.href} className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <div className="text-sm text-muted">{feed.href}</div>
            <div className="mt-2 text-lg font-extrabold">{feed.label}</div>
          </Link>
        ))}
      </div>
    </PublicScaffold>
  )
}
