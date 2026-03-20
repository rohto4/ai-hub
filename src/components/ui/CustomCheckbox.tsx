export function CustomCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors"
      style={{
        background: checked ? 'var(--color-accent-lighter)' : '#fff',
        borderColor: checked ? '#f4c29a' : 'rgba(0,0,0,0.08)',
        color: checked ? 'var(--color-accent-darker)' : 'var(--color-subtle)',
      }}
    >
      <span>{checked ? '✅' : '⬜'}</span>
      <span>{label}</span>
    </button>
  )
}
