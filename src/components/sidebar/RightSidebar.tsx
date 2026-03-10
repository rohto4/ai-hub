'use client'

type CategoryId = 'all' | 'youtube' | 'official' | 'blog' | 'agent'

interface NotifTime {
  label: string
  on: boolean
}

interface Props {
  activeCategory: CategoryId
  onCategoryChange: (category: CategoryId) => void
  unread: number
  topRated: number
  savedLater: number
  notifTimes: NotifTime[]
  onNotifToggle: (index: number) => void
}

const categories: Array<{ id: CategoryId; label: string }> = [
  { id: 'all', label: '総合' },
  { id: 'youtube', label: '動画' },
  { id: 'official', label: '公式' },
  { id: 'blog', label: 'ブログ' },
  { id: 'agent', label: 'Agent' },
]

export function RightSidebar({
  activeCategory,
  onCategoryChange,
  unread,
  topRated,
  savedLater,
  notifTimes,
  onNotifToggle,
}: Props) {
  return (
    <aside
      className="shrink-0 rounded-[14px]"
      style={{ width: 220, background: 'var(--color-card-second)', padding: 10 }}
    >
      <SideSection title="ランキングカテゴリ">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onCategoryChange(category.id)}
            className="w-full rounded-lg border-none px-2 py-2 text-left text-[12px] text-accent-darker"
            style={{
              background:
                activeCategory === category.id ? 'var(--color-accent-light)' : 'transparent',
              fontWeight: activeCategory === category.id ? 700 : 400,
              borderBottom: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            {activeCategory === category.id ? `> ${category.label}` : category.label}
          </button>
        ))}
      </SideSection>

      <Divider />

      <SideSection title="保存管理（ブラウザ依存）">
        <SideRow label="未読" value={unread} />
        <SideRow label="高評価" value={topRated} />
        <SideRow label="後で読む" value={savedLater} />
      </SideSection>

      <Divider />

      <SideSection title="リアルタイム活動">
        <div
          className="rounded-lg px-2.5 py-2 text-[12px] font-bold leading-[1.4] text-accent-dark"
          style={{ background: '#fff9f3' }}
        >
          この1時間で 28 件シェア
          <div className="mt-1 text-[11px] font-normal text-muted">+3 件が急上昇</div>
        </div>
      </SideSection>

      <Divider />

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
    </aside>
  )
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
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

function Divider() {
  return <div className="my-2.5 border-t border-black/5" />
}
