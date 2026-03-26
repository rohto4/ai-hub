import type { UiArticle } from '@/components/home/home-state-shared'
import { ArticleThumbnail } from '@/components/shared/ArticleThumbnail'

export function SummaryModal({
  article,
  onClose,
  onOpenArticle,
}: {
  article: UiArticle
  onClose: () => void
  onOpenArticle: (articleId: string) => void
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="relative w-full max-w-[520px] cursor-pointer overflow-hidden rounded-2xl border border-black/5 bg-card-second shadow-[0_16px_48px_rgba(0,0,0,0.2)]"
        onClick={(event) => {
          event.stopPropagation()
          onOpenArticle(article.id)
        }}
      >
        <button
          type="button"
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-[14px] text-muted"
          style={{ background: 'rgba(0,0,0,0.05)' }}
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
        >
          ×
        </button>

        <div className="p-5">
          <div className="flex items-start gap-4">
            <ArticleThumbnail
              articleId={article.id}
              sourceType={article.source_type}
              thumbnailUrl={article.thumbnail_url}
              thumbnailEmoji={article.thumbnail_emoji}
              thumbnailBgTheme={article.thumbnail_bg_theme}
              className="h-16 w-14 shrink-0 rounded-xl"
              emojiClassName="text-[30px]"
            />
            <div className="min-w-0 flex-1 pr-6">
              <div className="mb-1.5 flex flex-wrap gap-1.5 text-[10px]">
                <span className="rounded-full bg-[#dbeafe] px-2 py-0.5 font-bold text-[#1d4ed8]">{article.source_type}</span>
                <span className="rounded-full bg-[#f6f0ea] px-2 py-0.5 font-bold text-accent-darker">
                  {article.sourceCategory}
                </span>
                <span className="text-muted">{article.published_at.toLocaleDateString('ja-JP')}</span>
              </div>
              <h3 className="text-[15px] font-extrabold leading-tight">{article.title}</h3>
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-[1.8] text-[#4f5969]">
            {article.summary_200 ?? article.summary_100 ?? '要約は準備中です。'}
          </p>

          <p className="mt-3 text-center text-[11px] text-muted">クリックで元記事を開きます</p>
        </div>
      </div>
    </div>
  )
}
