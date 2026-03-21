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

  async function copyToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // HTTP環境など clipboard API が使えない場合のフォールバック
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  }

  function handleShareCopyUrl() {
    if (!shareTarget || typeof window === 'undefined') return

    const articleUrl = `${window.location.origin}/articles/${shareTarget.publicKey ?? shareTarget.id}`
    void copyToClipboard(articleUrl).then(() => {
      setShareStatus('URLをコピーしました。')
      void trackAction({ actionType: 'share_copy', articleId: shareTarget.id, source: 'direct' })
    })
  }

  function handleShareCopyText() {
    if (!shareTarget) return

    void copyToClipboard(shareTextContent).then(() => {
      setShareStatus('投稿文をコピーしました。')
      void trackAction({ actionType: 'share_copy', articleId: shareTarget.id, source: 'direct' })
    })
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
