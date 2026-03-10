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
        className="mx-auto flex h-full items-center gap-2 px-4 md:px-6 xl:px-[120px]"
        style={{ maxWidth: 1440 }}
      >
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-light text-accent-dark">
            <Keyboard size={14} />
          </div>
          <span className="text-[14px] font-extrabold text-ink md:text-[16px]">AI Trend Hub</span>
        </div>

        <form
          className="ml-auto flex min-w-0 flex-1 items-center gap-2 md:flex-none"
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
            className="min-w-0 flex-1 rounded-full border-none bg-white text-[12px] text-muted outline-none md:w-[360px] xl:w-[520px]"
            style={{ height: 36, padding: '0 16px' }}
          />
          <button
            type="submit"
            className="shrink-0 rounded-full border-none px-3 py-1.5 text-[11px] font-bold text-white"
            style={{ background: 'var(--color-btn-dark)' }}
          >
            検索
          </button>
        </form>

        <div className="hidden items-center gap-2 lg:flex">
          <HeaderChip>通知</HeaderChip>
          <HeaderChip>総合ランキング</HeaderChip>
          <HeaderChip>{`批評: ${critiqueVisible ? '表示中' : '非表示中'}`}</HeaderChip>
        </div>
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
