'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, Search, Sparkles } from 'lucide-react'
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

interface NotifItem {
  title: string
  desc: string
  href: string
}

const NOTIF_ITEMS: NotifItem[] = [
  { title: '日次ダイジェスト', desc: '流れをまとめて追う', href: '/digest' },
  { title: 'あとで読む', desc: '保存した記事を見返す', href: '/saved' },
]

const PERIOD_OPTIONS: Array<{ label: string; value: RankPeriod }> = [
  { label: 'day', value: '24h' },
  { label: 'week', value: '7d' },
  { label: 'month', value: '30d' },
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
  const [notifOpen, setNotifOpen] = useState(false)
  const lastY = useRef(0)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onScroll() {
      if (window.innerWidth >= 768) {
        setHidden(false)
        return
      }

      const y = window.scrollY
      if (y > lastY.current + 4 && y > 52) {
        setHidden(true)
      } else if (y < lastY.current - 4) {
        setHidden(false)
      }
      lastY.current = y
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false)
      }
    }

    if (notifOpen) {
      document.addEventListener('mousedown', handleClick)
    }

    return () => document.removeEventListener('mousedown', handleClick)
  }, [notifOpen])

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-black/8 bg-[color:var(--color-header-bg)] backdrop-blur-xl transition-transform duration-300"
      style={{
        height: 58,
        transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
      }}
    >
      <div className="mx-auto flex h-full items-center gap-3 px-4 md:px-6 xl:px-[120px]" style={{ maxWidth: 1440 }}>
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Sparkles size={16} className="text-[color:var(--color-accent-darker)]" />
          <span className="text-[15px] font-black tracking-[-0.04em] text-[color:var(--color-ink)] md:text-[17px]">
            AI Trend Hub
          </span>
        </Link>

        <div className="hidden items-center gap-1.5 xl:flex">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onPeriodChange(option.value)}
              className="border px-2 py-1 text-[11px] font-bold uppercase transition"
              style={{
                borderColor: period === option.value ? 'rgba(163,91,46,0.28)' : 'rgba(0,0,0,0.08)',
                backgroundColor: period === option.value ? 'var(--color-panel-strong)' : 'transparent',
                color: period === option.value ? 'var(--color-accent-darker)' : 'var(--color-subtle)',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-1 xl:flex">
          <span className="text-[11px] font-bold text-[color:var(--color-subtle)]">要約文</span>
          {([100, 200] as const).map((mode, index) => (
            <button
              key={mode}
              type="button"
              onClick={() => onSummaryModeChange(mode)}
              className="border px-2 py-1 text-[11px] font-bold transition"
              style={{
                borderColor: summaryMode === mode ? 'rgba(163,91,46,0.28)' : 'rgba(0,0,0,0.08)',
                backgroundColor: summaryMode === mode ? 'var(--color-panel-strong)' : 'transparent',
                color: summaryMode === mode ? 'var(--color-accent-darker)' : 'var(--color-subtle)',
              }}
            >
              {index === 0 ? '短' : '長'}
            </button>
          ))}
        </div>

        <form
          className="ml-auto flex min-w-0 flex-1 items-center gap-2 md:flex-none"
          onSubmit={(event) => {
            event.preventDefault()
            onSearchSubmit()
          }}
        >
          <div className="relative flex min-w-0 flex-1 items-center md:w-[320px] xl:w-[440px]">
            <Search size={15} className="absolute left-3 text-[color:var(--color-accent-dark)]" />
            <input
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Claude / Gemini / OpenAI / OSS"
              className="w-full border border-black/8 bg-white py-2 pl-10 pr-3 text-[13px] text-[color:var(--color-ink)] outline-none transition placeholder:text-[color:var(--color-muted)] focus:border-[color:var(--color-accent-dark)]/30"
            />
          </div>

          <button type="submit" className="border border-black/8 px-3 py-2 text-[11px] font-bold uppercase text-[color:var(--color-accent-darker)] transition hover:border-[color:var(--color-accent-dark)]/20">
            Search
          </button>
        </form>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/ranking" className="border border-black/8 px-3 py-2 text-[11px] font-bold uppercase text-[color:var(--color-accent-darker)] transition hover:border-[color:var(--color-accent-dark)]/20">
            Ranking
          </Link>

          <div ref={notifRef} className="relative">
            <button
              type="button"
              className="relative border border-black/8 px-3 py-2 text-[11px] font-bold uppercase text-[color:var(--color-accent-darker)] transition hover:border-[color:var(--color-accent-dark)]/20"
              onClick={() => setNotifOpen((open) => !open)}
            >
              <span className="inline-flex items-center gap-2">
                <Bell size={14} />
                Library
              </span>
              {savedCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center bg-[color:var(--color-hot)] px-1 text-[10px] font-black text-white">
                  {savedCount > 9 ? '9+' : savedCount}
                </span>
              ) : null}
            </button>

            {notifOpen ? (
              <div className="absolute right-0 top-full z-[200] mt-2 w-[300px] border border-black/8 bg-[color:var(--color-bg)] shadow-[0_20px_60px_rgba(25,18,12,0.14)]">
                <div className="border-b border-black/8 px-4 py-3">
                  <span className="text-sm font-black tracking-[-0.03em] text-[color:var(--color-ink)]">Quick Access</span>
                </div>
                {NOTIF_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-start gap-3 px-4 py-4 transition hover:bg-[color:var(--color-panel-strong)]"
                    onClick={() => setNotifOpen(false)}
                  >
                    <div className="mt-0.5 h-2.5 w-2.5 bg-[color:var(--color-accent-dark)]" />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-[color:var(--color-ink)]">{item.title}</span>
                      <span className="text-xs leading-5 text-[color:var(--color-subtle)]">{item.desc}</span>
                    </div>
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
