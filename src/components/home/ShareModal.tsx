import type { ShareState } from '@/components/home/home-state-shared'
import { CustomCheckbox } from '@/components/ui/CustomCheckbox'

export function ShareModal({
  share,
  onClose,
  onTextChange,
  onToggleAiTrendHub,
  onToggleTitle,
  onToggleSummary,
  onCopyUrl,
  onCopyText,
}: {
  share: ShareState
  onClose: () => void
  onTextChange: (value: string) => void
  onToggleAiTrendHub: (value: boolean) => void
  onToggleTitle: (value: boolean) => void
  onToggleSummary: (value: boolean) => void
  onCopyUrl: () => void
  onCopyText: () => void
}) {
  if (!share.target) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-2xl border border-black/5 bg-card-second shadow-[0_8px_32px_rgba(0,0,0,0.14)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <span className="text-[13px] font-extrabold">この記事を共有</span>
          <button type="button" className="text-xl text-muted" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap gap-2">
            <CustomCheckbox checked={share.includeAiTrendHub} onChange={onToggleAiTrendHub} label="#AiTrendHub" />
            <CustomCheckbox checked={share.includeTitle} onChange={onToggleTitle} label="タイトル" />
            <CustomCheckbox checked={share.includeSummary} onChange={onToggleSummary} label="100字要約" />
          </div>

          <textarea
            className="min-h-[128px] w-full rounded-xl border border-black/10 bg-white p-3 text-[12px] leading-6 outline-none"
            value={share.textContent}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="紹介文を入力してください"
          />

          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl py-2.5 text-[12px] font-bold"
              style={{
                background: 'var(--color-accent-light)',
                color: 'var(--color-accent-darker)',
                border: '1px solid rgba(0,0,0,0.05)',
              }}
              onClick={onCopyUrl}
            >
              URLをコピー
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl py-2.5 text-[12px] font-bold text-white"
              style={{ background: 'var(--color-orange)' }}
              onClick={onCopyText}
            >
              紹介文をコピー
            </button>
          </div>

          {share.status ? <p className="text-[11px] text-accent-darker">{share.status}</p> : null}
        </div>
      </div>
    </div>
  )
}
