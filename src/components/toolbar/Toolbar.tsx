'use client'

import type { RankPeriod } from '@/lib/db/types'

interface Props {
  period: RankPeriod
  onPeriodChange: (period: RankPeriod) => void
}

const PERIOD_BUTTONS: Array<{ value: RankPeriod; label: string }> = [
  { value: '24h', label: '24時間' },
  { value: '7d', label: '1週間' },
  { value: '30d', label: '1か月' },
]

const SECTION_BUTTONS: Array<{ id: string; label: string }> = [
  { id: 'section-random', label: 'ランダム表示' },
  { id: 'section-latest', label: '新着順' },
  { id: 'section-unique', label: 'ユニーク順' },
]

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function Toolbar({ period, onPeriodChange }: Props) {
  return (
    <div className="flex flex-col gap-2 py-2">
      {/* 期間フィルタ（常時表示・均一サイズ） */}
      <div className="flex gap-1.5">
        {PERIOD_BUTTONS.map((btn) => (
          <button
            key={btn.value}
            type="button"
            onClick={() => onPeriodChange(btn.value)}
            className="rounded-[9px] text-[12px] text-accent-darker"
            style={{
              height: 32,
              flex: 1,
              background: period === btn.value ? 'var(--color-accent-lighter)' : 'var(--color-card-second)',
              fontWeight: period === btn.value ? 700 : 400,
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* セクションナビ（クリックでスクロール） */}
      <div className="flex gap-1.5">
        {SECTION_BUTTONS.map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => scrollTo(btn.id)}
            className="rounded-[9px] border border-black/5 px-3 text-[11px] text-subtle"
            style={{ height: 28, background: 'var(--color-card-second)' }}
          >
            ↓ {btn.label}
          </button>
        ))}
      </div>
    </div>
  )
}
