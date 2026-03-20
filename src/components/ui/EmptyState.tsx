export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-card-second px-5 py-8 text-center text-muted">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-[#f2dfd0] text-[11px] font-extrabold text-accent-darker">
        NO
      </div>
      <div className="mb-1 text-[14px] font-extrabold text-ink">{title}</div>
      <div className="text-[11px] leading-5">{description}</div>
    </div>
  )
}
