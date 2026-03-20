const GROUP_COLORS: Record<string, { bg: string; text: string; val: string }> = {
  total: { bg: '#fff7ed', text: '#9a3412', val: '#ea580c' },
  lane: { bg: '#eff6ff', text: '#1e40af', val: '#2563eb' },
  genre: { bg: '#f0fdf4', text: '#14532d', val: '#16a34a' },
  activity: { bg: '#fdf4ff', text: '#581c87', val: '#9333ea' },
}

export function KpiCard({ label, value, group }: { label: string; value: string; group: string }) {
  const colors = GROUP_COLORS[group] ?? GROUP_COLORS.total

  return (
    <article className="flex min-w-[72px] shrink-0 flex-col gap-0.5 rounded-xl p-2" style={{ background: colors.bg }}>
      <div className="truncate text-[9px] font-bold uppercase tracking-[0.06em]" style={{ color: colors.text }}>
        {label}
      </div>
      <div className="text-[18px] font-extrabold leading-none" style={{ color: colors.val }}>
        {value}
      </div>
    </article>
  )
}
