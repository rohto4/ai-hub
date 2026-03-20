'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, TrendingUp, Search, Tag, Info } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'ホーム', icon: Home },
  { href: '/ranking', label: 'ランキング', icon: TrendingUp },
  { href: '/search', label: '検索', icon: Search },
  { href: '/tags', label: 'タグ', icon: Tag },
  { href: '/about', label: 'その他', icon: Info },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-black/5 backdrop-blur-sm md:hidden"
      style={{ height: 56, background: 'var(--color-header-bg)' }}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[9px] font-bold"
            style={{ color: isActive ? 'var(--color-orange)' : 'var(--color-subtle)' }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
