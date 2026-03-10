import { Keyboard } from 'lucide-react'

interface Props {
  searchValue: string
  critiqueVisible: boolean
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
}

export function Header({ searchValue, critiqueVisible, onSearchChange, onSearchSubmit }: Props) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-black/5 backdrop-blur-sm"
      style={{ height: 52, background: 'var(--color-header-bg)' }}
    >
      <div
        className="mx-auto flex h-full items-center gap-2"
        style={{ maxWidth: 1440, padding: '0 120px' }}
      >
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-light text-accent-dark">
            <Keyboard size={14} />
          </div>
          <span className="text-[16px] font-extrabold text-ink">AI Trend Hub</span>
        </div>

        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            onSearchSubmit()
          }}
        >
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="タイトル検索: Claude / Gemini / Agent"
            className="rounded-full border-none bg-white text-[12px] text-muted outline-none"
            style={{ height: 36, width: 520, padding: '0 16px' }}
          />
          <button
            type="submit"
            className="rounded-full border-none px-3.5 py-1.5 text-[11px] font-bold text-white"
            style={{ background: 'var(--color-btn-dark)' }}
          >
            検索
          </button>
        </form>

        <HeaderChip>通知</HeaderChip>
        <HeaderChip>総合ランキング</HeaderChip>
        <HeaderChip>{`批評: ${critiqueVisible ? '表示中' : '非表示中'}`}</HeaderChip>
      </div>
    </header>
  )
}

function HeaderChip({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="shrink-0 rounded-full border-none px-3.5 py-1.5 text-[11px] font-bold text-accent-dark"
      style={{ background: 'var(--color-accent-light)' }}
      type="button"
    >
      {children}
    </button>
  )
}
