'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BellDot, Bot, ListOrdered, Search as SearchIcon } from 'lucide-react'
import type { RankPeriod } from '@/lib/db/types'

interface Props {
  searchValue: string
  critiqueVisible?: boolean
  savedCount?: number
  period: RankPeriod
  summaryMode: 100 | 200
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
  onPeriodChange: (period: RankPeriod) => void
  onSummaryModeChange: (mode: 100 | 200) => void
}

interface QuickAccessItem {
  title: string
  description: string
  href: string
}

const QUICK_ACCESS_ITEMS: QuickAccessItem[] = [
  { title: '保存記事', description: 'あとで読むに追加した記事を確認', href: '/saved' },
  { title: 'ダイジェスト', description: '最新の要約ダイジェストを確認', href: '/digest' },
]

const PERIOD_OPTIONS: Array<{ label: string; value: RankPeriod; width: number }> = [
  { label: 'DAY', value: '24h', width: 40 },
  { label: 'WEEK', value: '7d', width: 48 },
  { label: 'MONTH', value: '30d', width: 56 },
]

export function Header({
  searchValue,
  savedCount = 0,
  period,
  summaryMode,
  onSearchChange,
  onSearchSubmit,
  onPeriodChange,
  onSummaryModeChange,
}: Props) {
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const lastY = useRef(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onScroll() {
      if (window.innerWidth >= 1024) {
        setHidden(false)
        return
      }

      const nextY = window.scrollY
      if (nextY > lastY.current + 4 && nextY > 52) {
        setHidden(true)
      } else if (nextY < lastY.current - 4) {
        setHidden(false)
      }
      lastY.current = nextY
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handlePointerDown)
    }

    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [menuOpen])

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b bg-[color:var(--color-bg)] transition-transform duration-300"
      style={{
        height: 58,
        borderColor: '#e8d9cb',
        transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
      }}
    >
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-2 px-3 md:px-4 xl:px-[120px]">
        <Link href="/" className="flex shrink-0 items-center gap-2 pr-2" style={{ fontFamily: 'JetBrains Mono, var(--font-family-base)' }}>
          <Bot size={16} strokeWidth={2.1} className="text-[color:var(--color-accent-darker)]" />
          <span className="text-[15px] font-bold tracking-[-0.03em] text-[color:var(--color-ink)] md:text-[17px]">
            AI Trend Hub
          </span>
        </Link>

        <div className="hidden items-center gap-[6px] xl:flex" style={{ fontFamily: 'JetBrains Mono, var(--font-family-base)' }}>
          {PERIOD_OPTIONS.map((option) => (
            <HeaderToggle
              key={option.value}
              label={option.label}
              width={option.width}
              active={period === option.value}
              onClick={() => onPeriodChange(option.value)}
            />
          ))}
        </div>

        <div className="hidden items-center gap-[6px] xl:flex" style={{ fontFamily: 'JetBrains Mono, var(--font-family-base)' }}>
          <span className="text-[14px] font-bold text-[#625f68]">要約文</span>
          <HeaderToggle label="短" width={28} active={summaryMode === 100} onClick={() => onSummaryModeChange(100)} />
          <HeaderToggle label="長" width={28} active={summaryMode === 200} onClick={() => onSummaryModeChange(200)} />
        </div>

        <form
          className="ml-auto flex min-w-0 items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            onSearchSubmit()
          }}
        >
          <button
            type="submit"
            className="hidden shrink-0 items-center gap-2 border px-3 text-[13px] font-bold text-[color:var(--color-accent-dark)] transition hover:bg-[#fff6ee] lg:inline-flex"
            style={{
              height: 28,
              borderColor: '#e8d9cb',
              background: '#fff1e4',
              fontFamily: 'JetBrains Mono, var(--font-family-base)',
            }}
          >
            <SearchIcon size={16} strokeWidth={2.1} />
            SEARCH
          </button>

          <label className="relative flex min-w-0 items-center">
            <input
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Claude / OSS / エージェント"
              className="h-7 min-w-0 border bg-white px-3 text-[13px] font-bold text-[color:var(--color-ink)] outline-none placeholder:text-[#8d8b90] focus:border-[color:var(--color-accent-dark)]"
              style={{
                width: 'clamp(230px, 33vw, 380px)',
                borderColor: '#e8d9cb',
                fontFamily: 'JetBrains Mono, var(--font-family-base)',
              }}
            />
          </label>
        </form>

        <div className="hidden items-center gap-3 lg:flex" style={{ fontFamily: 'JetBrains Mono, var(--font-family-base)' }}>
          <Link
            href="/ranking"
            className="inline-flex shrink-0 items-center gap-2 border px-3 text-[13px] font-bold text-[color:var(--color-accent-dark)] transition hover:bg-[#fff6ee]"
            style={{
              height: 29,
              borderColor: '#e8d9cb',
              background: '#fff1e4',
            }}
          >
            <ListOrdered size={16} strokeWidth={2.1} />
            ランキング
          </Link>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              className="relative inline-flex shrink-0 items-center gap-2 border px-3 text-[13px] font-bold text-[color:var(--color-accent-dark)] transition hover:bg-[#fff6ee]"
              style={{
                height: 30,
                borderColor: '#e8d9cb',
                background: '#fff1e4',
                minWidth: 92,
              }}
              onClick={() => setMenuOpen((current) => !current)}
            >
              <BellDot size={16} strokeWidth={2.1} />
              通知
              {savedCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center bg-[color:var(--color-hot)] px-1 text-[10px] font-bold leading-none text-white">
                  {savedCount > 9 ? '9+' : savedCount}
                </span>
              ) : null}
            </button>

            {menuOpen ? (
              <div
                className="absolute right-0 top-full mt-2 w-[280px] border bg-[color:var(--color-card)] shadow-[0_18px_40px_rgba(35,22,10,0.12)]"
                style={{ borderColor: '#e8d9cb' }}
              >
                <div className="border-b px-4 py-3 text-[13px] font-bold text-[color:var(--color-ink)]" style={{ borderColor: '#efe2d7' }}>
                  Quick Access
                </div>
                {QUICK_ACCESS_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block border-b px-4 py-3 last:border-b-0 hover:bg-[#fff8f1]"
                    style={{ borderColor: '#f3e7db' }}
                    onClick={() => setMenuOpen(false)}
                  >
                    <div className="text-[12px] font-bold text-[color:var(--color-ink)]">{item.title}</div>
                    <div className="mt-1 text-[11px] leading-5 text-[#625f68]">{item.description}</div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}

function HeaderToggle({
  label,
  width,
  active,
  onClick,
}: {
  label: string
  width: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center border text-[14px] font-bold transition"
      style={{
        width,
        height: 28,
        borderColor: active ? '#e5c8ab' : '#e8d9cb',
        background: active ? '#fff1e4' : '#fbf4ec',
        color: active ? '#a35b2e' : '#8d8b90',
        fontFamily: 'JetBrains Mono, var(--font-family-base)',
      }}
    >
      {label}
    </button>
  )
}
