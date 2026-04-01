import Link from 'next/link'

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/ranking', label: 'Ranking' },
  { href: '/search', label: 'Search' },
  { href: '/tags', label: 'Tags' },
  { href: '/about', label: 'About' },
]

export function PublicScaffold({
  title,
  description,
  eyebrow = 'AI Trend Hub',
  sidebar,
  children,
}: {
  title: string
  description: string
  eyebrow?: string
  sidebar?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-8%] top-[-6rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,146,92,0.22),rgba(255,255,255,0))]" />
        <div className="absolute right-[-8%] top-[12rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(93,173,226,0.16),rgba(255,255,255,0))]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-black/5 bg-[color:var(--color-header-bg)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-3 px-4 py-4 md:px-6">
          <Link href="/" className="text-lg font-black tracking-[-0.04em] text-[color:var(--color-ink)]">
            AI Trend Hub
          </Link>
          <nav className="hidden flex-wrap gap-2 md:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="site-nav-chip">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1320px] px-4 pb-[88px] pt-8 md:px-6">
        <section className="relative overflow-hidden border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,244,235,0.88)_48%,rgba(255,255,255,0.78))] px-6 py-8 shadow-[0_24px_70px_rgba(43,31,24,0.08)] md:px-8 md:py-10">
          <div className="absolute inset-y-0 right-0 w-[36%] bg-[radial-gradient(circle_at_top_right,rgba(255,164,117,0.24),rgba(255,255,255,0))]" />
          <div className="relative max-w-3xl">
            <div className="site-eyebrow">{eyebrow}</div>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-[color:var(--color-ink)] md:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--color-subtle)] md:text-[15px]">
              {description}
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>{children}</div>
          {sidebar ? <div>{sidebar}</div> : null}
        </div>
      </main>
    </div>
  )
}

export function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="site-panel flex min-h-[240px] items-center justify-center text-center text-sm leading-7 text-[color:var(--color-subtle)]">
      {message}
    </div>
  )
}
