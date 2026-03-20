'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Keyboard, Search } from 'lucide-react'

interface Props {
  searchValue: string
  critiqueVisible?: boolean
  savedCount?: number
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
}

interface NotifItem {
  icon: string
  title: string
  desc: string
  href: string
}

const NOTIF_ITEMS: NotifItem[] = [
  { icon: '📰', title: 'AIダイジェスト', desc: '最新のダイジェストを確認する', href: '/digest' },
  { icon: '📚', title: '後で読む', desc: '保存した記事が溜まっています', href: '/saved' },
]

export function Header({ searchValue, savedCount = 0, onSearchChange, onSearchSubmit }: Props) {
  const [hidden, setHidden] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const lastY = useRef(0)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onScroll() {
      if (window.innerWidth >= 768) { setHidden(false); return }
      const y = window.scrollY
      if (y > lastY.current + 4 && y > 52) setHidden(true)
      else if (y < lastY.current - 4) setHidden(false)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])

  // 通知ドロップダウン外クリックで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [notifOpen])

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-black/5 backdrop-blur-sm transition-transform duration-200"
      style={{ height: 52, background: 'var(--color-header-bg)', transform: hidden ? 'translateY(-100%)' : 'translateY(0)' }}
    >
      <div className="mx-auto flex h-full items-center gap-2 px-4 md:px-6 xl:px-[120px]" style={{ maxWidth: 1440 }}>
        {/* ロゴ */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-light text-accent-dark">
            <Keyboard size={14} />
          </div>
          <span className="text-[14px] font-extrabold text-ink md:text-[16px]">AI Trend Hub</span>
        </div>

        {/* 検索フォーム */}
        <form
          className="ml-auto flex min-w-0 flex-1 items-center gap-2 md:flex-none"
          onSubmit={(e) => { e.preventDefault(); onSearchSubmit() }}
        >
          <div className="relative flex min-w-0 flex-1 items-center md:w-[360px] xl:w-[520px]">
            <Search
              size={14}
              className="absolute left-3 shrink-0"
              style={{ color: 'var(--color-accent-dark)' }}
            />
            <input
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="タイトル検索: Claude / Gemini / Agent"
              className="w-full rounded-full border-none bg-white text-[12px] text-muted outline-none"
              style={{ height: 36, padding: '0 16px 0 32px' }}
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-full border-none px-3 py-1.5 text-[11px] font-bold text-white"
            style={{ background: 'var(--color-btn-dark)' }}
          >
            検索
          </button>
        </form>

        {/* 右側チップ（lg以上） */}
        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/ranking"
            className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold text-accent-dark"
            style={{ background: 'var(--color-accent-light)' }}
          >
            総合ランキング
          </Link>

          {/* 通知ボタン */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              className="relative shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold text-accent-dark"
              style={{ background: 'var(--color-accent-light)' }}
              onClick={() => setNotifOpen((o) => !o)}
            >
              通知
              {savedCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: 'var(--color-orange)' }}>
                  {savedCount > 9 ? '9+' : savedCount}
                </span>
              )}
            </button>

            {/* 通知ドロップダウン */}
            {notifOpen && (
              <div className="absolute right-0 top-full z-[200] mt-1 w-[280px] overflow-hidden rounded-xl border border-black/5 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                <div className="border-b border-black/5 px-4 py-2.5">
                  <span className="text-[12px] font-extrabold">通知</span>
                </div>
                {NOTIF_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent-lighter"
                    onClick={() => setNotifOpen(false)}
                  >
                    <span className="text-[22px]">{item.icon}</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12px] font-bold text-ink">{item.title}</span>
                      <span className="text-[11px] text-muted">{item.desc}</span>
                    </div>
                  </Link>
                ))}
                <div className="border-t border-black/5 px-4 py-2 text-[11px] text-muted">
                  通知設定は <Link href="/about" className="underline">About</Link> から変更できます
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
