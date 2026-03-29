import Link from 'next/link'
import type { PublicTagSummary } from '@/lib/db/public-shared'
import { SITE_CATEGORIES } from '@/lib/site/navigation'

function TagPill({
  href,
  label,
  count,
  tone = 'primary',
}: {
  href: string
  label: string
  count: number
  tone?: 'primary' | 'adjacent'
}) {
  const toneClassName =
    tone === 'adjacent'
      ? 'border-white/60 bg-white/70 text-[color:var(--color-ink)] hover:border-[color:var(--color-accent-dark)]/30 hover:bg-[color:var(--color-panel-strong)]'
      : 'border-[color:var(--color-accent-dark)]/12 bg-[color:var(--color-panel-strong)] text-[color:var(--color-accent-darker)] hover:border-[color:var(--color-accent-dark)]/30 hover:bg-white'

  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2 border px-3 py-2 text-[12px] font-semibold transition duration-300 hover:-translate-y-0.5 ${toneClassName}`}
    >
      <span>{label}</span>
      <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold text-[color:var(--color-muted)] transition group-hover:bg-black/10">
        {count}
      </span>
    </Link>
  )
}

export function PublicDiscoveryRail({
  primaryTags,
  adjacentTags,
}: {
  primaryTags: PublicTagSummary[]
  adjacentTags: PublicTagSummary[]
}) {
  return (
    <aside className="space-y-5 xl:sticky xl:top-28">
      <section className="site-panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-[color:var(--color-accent-dark)]/12 via-white/0 to-transparent" />
        <div className="relative space-y-4">
          <div>
            <div className="site-eyebrow">Category</div>
            <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-[color:var(--color-ink)]">入口を先に絞る</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-subtle)]">
              実画面で導線を比較しやすいよう、公開面の大枠ナビゲーションをここに寄せています。
            </p>
          </div>

          <div className="space-y-2">
            {SITE_CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                className="group relative flex items-center justify-between overflow-hidden rounded-[22px] border border-white/70 px-4 py-3 shadow-[0_14px_36px_rgba(43,31,24,0.05)] transition duration-300 hover:-translate-y-0.5 hover:border-black/10 hover:bg-white"
                style={{
                  background: `linear-gradient(180deg, ${category.softColor}, rgba(255,255,255,0.96))`,
                }}
              >
                <div className="absolute inset-y-0 left-0 w-3" style={{ backgroundColor: category.solidColor }} />
                <div
                  className="pointer-events-none absolute inset-0 opacity-60"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0) 40%)',
                  }}
                />
                <div className="relative pl-5">
                  <div className="text-sm font-black text-[color:var(--color-ink)]">{category.label}</div>
                </div>
                <div className="relative pl-3 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--color-accent-dark)] transition group-hover:translate-x-0.5">
                  Go
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="site-panel">
        <div className="site-eyebrow">Primary Tags</div>
        <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-[color:var(--color-ink)]">主タグで深掘る</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {primaryTags.slice(0, 12).map((tag) => (
            <TagPill key={tag.tagKey} href={`/tags/${tag.tagKey}`} label={tag.displayName} count={tag.articleCount} />
          ))}
        </div>
      </section>

      <section className="site-panel bg-white/65">
        <div className="site-eyebrow">Adjacent Tags</div>
        <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-[color:var(--color-ink)]">周辺分野タグ</h2>
        <p className="mt-2 text-sm leading-6 text-[color:var(--color-subtle)]">
          当面は通常タグと同じクリック導線として扱い、見せ方の評価を先に進めます。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {adjacentTags.slice(0, 12).map((tag) => (
            <TagPill
              key={tag.tagKey}
              href={`/tags/${tag.tagKey}`}
              label={tag.displayName}
              count={tag.articleCount}
              tone="adjacent"
            />
          ))}
        </div>
      </section>
    </aside>
  )
}
