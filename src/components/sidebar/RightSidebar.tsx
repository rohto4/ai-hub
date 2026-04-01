'use client'

import Link from 'next/link'

interface Props {
  savedCount: number
  likedCount: number
  impressionCountLastHour: number
  shareCountLastHour: number
}

export function RightSidebar({
  savedCount,
  likedCount,
  impressionCountLastHour,
  shareCountLastHour,
}: Props) {
  return (
    <aside className="space-y-4">
      <section className="home-rail-panel">
        <div className="site-eyebrow">Signal</div>
        <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-[color:var(--color-ink)]">
          いま反応がある記事
        </h2>
        <div className="mt-4 grid gap-3">
          <MetricCard label="1h 表示" value={impressionCountLastHour} accent="text-[color:var(--color-accent-dark)]" />
          <MetricCard label="1h シェア" value={shareCountLastHour} accent="text-[color:var(--color-hot)]" />
        </div>
      </section>

      <section className="home-rail-panel">
        <div className="site-eyebrow">Library</div>
        <div className="mt-3 grid gap-2">
          <SideLink href="/liked" label="気になった記事" value={likedCount} />
          <SideLink href="/saved" label="あとで読む" value={savedCount} />
          <SideLink href="/ranking" label="ランキングを見る" />
          <SideLink href="/tags" label="タグ一覧を見る" />
        </div>
      </section>

      <section className="home-rail-panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-br from-[color:var(--color-hot)]/15 via-white/0 to-transparent" />
        <div className="relative">
          <div className="site-eyebrow">Digest</div>
          <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-[color:var(--color-ink)]">
            日次ダイジェスト
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--color-subtle)]">
            目立つ更新だけを短く取り込みたいときの導線です。通知や再訪導線の見え方もここで確認できます。
          </p>
          <Link
            href="/digest"
            className="site-button-primary mt-4 inline-flex"
          >
            ダイジェストを見る
          </Link>
        </div>
      </section>
    </aside>
  )
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  return (
    <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_18px_45px_rgba(43,31,24,0.06)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-muted)]">{label}</div>
      <div className={`mt-2 text-3xl font-black tracking-[-0.06em] ${accent}`}>{value}</div>
    </div>
  )
}

function SideLink({
  href,
  label,
  value,
}: {
  href: string
  label: string
  value?: number
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-[18px] border border-black/5 bg-white/65 px-4 py-3 text-sm font-semibold text-[color:var(--color-ink)] transition duration-300 hover:-translate-y-0.5 hover:border-black/10 hover:bg-white"
    >
      <span>{label}</span>
      <span className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--color-accent-dark)]">
        {value != null ? value : 'Go'}
      </span>
    </Link>
  )
}
