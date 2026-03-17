import Link from 'next/link'

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/ranking', label: 'Ranking' },
  { href: '/search', label: 'Search' },
  { href: '/tags', label: 'Tags' },
  { href: '/about', label: 'About' },
  { href: '/mock4', label: 'Mock4' },
]

export function PublicScaffold({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <Link href="/" className="text-lg font-extrabold">
            AI Trend Hub
          </Link>
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full bg-accent-light px-3 py-1 text-sm font-bold text-accent-dark"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mt-2 text-sm text-muted">{description}</p>
        </div>
        {children}
      </main>
    </div>
  )
}

export function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-black/10 bg-white/70 px-6 py-12 text-center text-muted">
      {message}
    </div>
  )
}
