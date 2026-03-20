'use client'

import Link from 'next/link'

interface Props {
  savedCount: number
  likedCount: number
  impressionCountLastHour: number
  shareCountLastHour: number
}

const CATEGORY_ITEMS: Array<{ slug: string; label: string; color: string }> = [
  { slug: 'agent', label: 'Agent', color: '#7e22ce' },
  { slug: 'llm', label: 'LLM', color: '#1d4ed8' },
  { slug: 'voice', label: 'Voice AI', color: '#0369a1' },
  { slug: 'policy', label: 'Policy', color: '#b45309' },
  { slug: 'safety', label: 'Safety', color: '#b91c1c' },
  { slug: 'search', label: 'Search/RAG', color: '#15803d' },
]

export function RightSidebar({
  savedCount,
  likedCount,
  impressionCountLastHour,
  shareCountLastHour,
}: Props) {
  return (
    <aside
      className="w-full shrink-0 rounded-[14px] xl:w-[220px]"
      style={{ background: 'var(--color-card-second)', padding: 10 }}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">

        {/* カテゴリナビ */}
        <SideSection title="カテゴリ別">
          {CATEGORY_ITEMS.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[12px] transition-colors hover:bg-accent-lighter"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', color: cat.color, fontWeight: 600 }}
            >
              <span>{cat.label}</span>
              <span className="text-[10px]">→</span>
            </Link>
          ))}
        </SideSection>

        {/* 保存管理 */}
        <SideSection title="保存管理">
          <SideLink href="/liked" label="高評価" value={likedCount} />
          <SideLink href="/saved" label="後で読む" value={savedCount} />
        </SideSection>

        {/* みんなの活動 */}
        <SideSection title="みんなの活動">
          <div className="rounded-lg px-2.5 py-2.5 text-[12px]" style={{ background: '#fff9f3' }}>
            <div className="flex items-center justify-between">
              <span className="text-muted">1h 閲覧</span>
              <span className="font-extrabold" style={{ color: 'var(--color-orange)' }}>
                {impressionCountLastHour} 件
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-muted">1h シェア</span>
              <span className="font-extrabold" style={{ color: 'var(--color-orange)' }}>
                {shareCountLastHour} 件
              </span>
            </div>
          </div>
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

function SideLink({ href, label, value }: { href: string; label: string; value?: number }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-accent-lighter"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
    >
      <span
        className="text-[12px] text-accent-darker underline decoration-[1.5px] underline-offset-2"
      >
        {label}
      </span>
      {value != null && (
        <span className="text-[14px] font-bold" style={{ color: 'var(--color-orange)' }}>
          {value}
        </span>
      )}
    </Link>
  )
}
