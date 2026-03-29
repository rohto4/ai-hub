const GROUP_COLORS: Record<string, { bg: string; text: string; val: string }> = {
  blue: { bg: '#eff6ff', text: '#1e40af', val: '#2563eb' },
  green: { bg: '#f0fdf4', text: '#14532d', val: '#16a34a' },
  red: { bg: '#fff1f2', text: '#9f1239', val: '#e11d48' },
}

export function KpiCard({ label, value, group }: { label: string; value: string; group: string }) {
  const colors = GROUP_COLORS[group] ?? GROUP_COLORS.blue

  return (
    <article className="flex min-w-[88px] shrink-0 flex-col gap-0.5 border border-black/6 p-2" style={{ background: colors.bg }}>
      <div className="truncate text-[9px] font-bold uppercase tracking-[0.06em]" style={{ color: colors.text }}>
        {label}
      </div>
      <div className="text-[18px] font-extrabold leading-none" style={{ color: colors.val }}>
        {value}
      </div>
    </article>
  )
}
