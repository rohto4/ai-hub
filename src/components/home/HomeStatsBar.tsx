import { KpiCard } from '@/components/ui/KpiCard'

export function HomeStatsBar({ kpis }: { kpis: { label: string; value: string | number; group: string }[] }) {
  return (
    <section className="border-b border-black/5 px-1 py-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 md:grid md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-[repeat(14,1fr)]">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={String(kpi.value)} group={kpi.group} />
        ))}
      </div>
    </section>
  )
}
