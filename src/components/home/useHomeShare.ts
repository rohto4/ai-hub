'use client'

import { useEffect, useState } from 'react'
import { trackAction } from '@/lib/client/home'
import type { ShareState, UiArticle } from '@/components/home/home-state-shared'

export function useHomeShare() {
  const [shareTarget, setShareTarget] = useState<UiArticle | null>(null)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [shareIncludeAiTrendHub, setShareIncludeAiTrendHub] = useState(true)
  const [shareIncludeTitle, setShareIncludeTitle] = useState(true)
  const [shareIncludeSummary, setShareIncludeSummary] = useState(false)
  const [shareTextContent, setShareTextContent] = useState('')

  useEffect(() => {
    if (!shareTarget) return

    const articlePath = `/articles/${shareTarget.publicKey ?? shareTarget.id}`
    const articleUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${articlePath}`
        : articlePath

    const lines = [
      shareIncludeTitle ? shareTarget.title : null,
      shareIncludeSummary ? (shareTarget.summary_100 ?? '') : null,
      articleUrl,
      shareIncludeAiTrendHub ? '#AiTrendHub' : null,
    ].filter(Boolean)

    setShareTextContent(lines.join('\n'))
    setShareStatus(null)
  }, [shareIncludeAiTrendHub, shareIncludeSummary, shareIncludeTitle, shareTarget])

  function handleShareCopyUrl() {
    if (!shareTarget || typeof window === 'undefined') return

    const articleUrl = `${window.location.origin}/articles/${shareTarget.publicKey ?? shareTarget.id}`
    void navigator.clipboard.writeText(articleUrl)
    setShareStatus('URLをコピーしました。')
    void trackAction({ actionType: 'share_copy', articleId: shareTarget.id, source: 'direct' })
  }

  function handleShareCopyText() {
    if (!shareTarget) return

    void navigator.clipboard.writeText(shareTextContent)
    setShareStatus('投稿文をコピーしました。')
    void trackAction({ actionType: 'share_copy', articleId: shareTarget.id, source: 'direct' })
  }

  const share: ShareState = {
    target: shareTarget,
    status: shareStatus,
    textContent: shareTextContent,
    includeAiTrendHub: shareIncludeAiTrendHub,
    includeTitle: shareIncludeTitle,
    includeSummary: shareIncludeSummary,
  }

  return {
    share,
    setShareTarget,
    setShareIncludeAiTrendHub,
    setShareIncludeTitle,
    setShareIncludeSummary,
    setShareTextContent,
    handleShareCopyUrl,
    handleShareCopyText,
  }
}
