export function LoadingGrid({ compact = false }: { compact?: boolean }) {
  const count = compact ? 1 : 2

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="min-h-[180px] animate-pulse rounded-xl border border-black/5 bg-card-second p-3">
          <div className="flex gap-3">
            <div className="h-[72px] w-[56px] rounded-lg bg-[#f2dfd0]" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-3 w-4/5 rounded bg-[#f2dfd0]" />
              <div className="h-3 w-full rounded bg-[#f2dfd0]" />
              <div className="h-3 w-3/5 rounded bg-[#f2dfd0]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
