'use client'

import type { RankPeriod } from '@/lib/db/types'

type TabId = 'ranking' | 'latest' | 'unique'

interface Props {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  period?: RankPeriod
  onPeriodChange?: (period: RankPeriod) => void
}

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'ranking', label: 'ランキング順' },
  { id: 'latest', label: '新着順' },
  { id: 'unique', label: 'ユニーク順' },
]

export function Toolbar({ activeTab, onTabChange, period = '24h', onPeriodChange }: Props) {
  const isRanking = activeTab === 'ranking'

  return (
    <div
      className="flex items-center gap-1.5"
      style={{
        padding: '8px 0 8px 8px',
        borderLeft: `3px solid var(${isRanking ? '--color-accent-dark' : '--color-accent-darker'})`,
        borderBottom: `1px solid var(${isRanking ? '--color-accent-dark' : '--color-accent-darker'})`,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className="whitespace-nowrap rounded-[9px] border-none text-[12px] text-accent-darker"
          style={{
            height: 32,
            padding: '0 14px',
            background:
              activeTab === tab.id ? 'var(--color-accent-lighter)' : 'var(--color-card-second)',
            fontWeight: activeTab === tab.id ? 700 : 400,
          }}
        >
          {tab.label}
        </button>
      ))}

      {isRanking && onPeriodChange ? (
        <div className="ml-2 flex gap-1">
          {(['24h', '7d', '30d'] as RankPeriod[]).map((tabPeriod) => (
            <button
              key={tabPeriod}
              type="button"
              onClick={() => onPeriodChange(tabPeriod)}
              className="rounded-[9px] border-none px-2.5 text-[11px] text-accent-darker"
              style={{
                height: 28,
                background:
                  period === tabPeriod
                    ? 'var(--color-accent-lighter)'
                    : 'var(--color-card-second)',
                fontWeight: period === tabPeriod ? 700 : 500,
              }}
            >
              {tabPeriod}
            </button>
          ))}
        </div>
      ) : null}

      <span className="flex-1" />

      <button
        type="button"
        className="rounded-[9px] border-none px-3.5 text-[12px] font-bold text-white"
        style={{ height: 32, background: 'var(--color-btn-dark)' }}
      >
        OGP共有ボード
      </button>
    </div>
  )
}
