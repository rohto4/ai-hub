'use client'

type SourceLane = 'all' | 'official' | 'alerts' | 'blog' | 'paper' | 'news'

interface NotifTime {
  label: string
  on: boolean
}

interface Props {
  activeCategory: SourceLane
  onCategoryChange: (category: SourceLane) => void
  unread: number
  topRated: number
  savedLater: number
  shareCountLastHour: number
  activeArticlesLastHour: number
  notifTimes: NotifTime[]
  onNotifToggle: (index: number) => void
}

const categories: Array<{ id: SourceLane; label: string }> = [
  { id: 'all', label: '総合' },
  { id: 'official', label: '公式' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'blog', label: 'Blog' },
  { id: 'paper', label: 'Paper' },
  { id: 'news', label: 'News' },
]

export function RightSidebar({
  activeCategory,
  onCategoryChange,
  unread,
  topRated,
  savedLater,
  shareCountLastHour,
  activeArticlesLastHour,
  notifTimes,
  onNotifToggle,
}: Props) {
  return (
    <aside
      className="w-full shrink-0 rounded-[14px] xl:w-[220px]"
      style={{ background: 'var(--color-card-second)', padding: 10 }}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
        <SideSection title="ソースレーン">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryChange(category.id)}
              className="w-full rounded-lg border-none px-2 py-2 text-left text-[12px] text-accent-darker"
              style={{
                background: activeCategory === category.id ? 'var(--color-accent-light)' : 'transparent',
                fontWeight: activeCategory === category.id ? 700 : 400,
                borderBottom: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              {activeCategory === category.id ? `> ${category.label}` : category.label}
            </button>
          ))}
        </SideSection>

        <SideSection title="保存管理">
          <SideRow label="未読" value={unread} />
          <SideRow label="高評価" value={topRated} />
          <SideRow label="後で読む" value={savedLater} />
        </SideSection>

        <SideSection title="リアルタイム活動">
          <div className="rounded-lg px-2.5 py-2 text-[12px] font-bold leading-[1.4] text-accent-dark" style={{ background: '#fff9f3' }}>
            この1時間で {shareCountLastHour} 件シェア
            <div className="mt-1 text-[11px] font-normal text-muted">{activeArticlesLastHour} 件の記事で反応あり</div>
          </div>
        </SideSection>

        <SideSection title="通知設定">
          {notifTimes.map((item, index) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg px-2 py-2"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
            >
              <span className="text-[12px] text-accent-darker">{item.label}</span>
              <button
                type="button"
                onClick={() => onNotifToggle(index)}
                className="flex h-[18px] w-[34px] items-center justify-center rounded-full border-none text-[9px] font-bold"
                style={{
                  background: item.on ? 'var(--color-orange)' : 'var(--color-second-orange)',
                  color: item.on ? '#fff' : 'var(--color-accent-darker)',
                }}
              >
                {item.on ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}
        </SideSection>
      </div>
    </aside>
  )
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white/40 p-3">
      <p className="mb-1.5 text-[13px] font-extrabold text-ink">{title}</p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

function SideRow({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex items-center justify-between rounded-lg px-2 py-2"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
    >
      <span className="text-[12px] text-accent-darker">{label}</span>
      <span className="text-[14px] font-bold" style={{ color: 'var(--color-orange)' }}>
        {value}
      </span>
    </div>
  )
}
