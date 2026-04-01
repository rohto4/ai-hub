'use client'

import { useEffect, useState } from 'react'
import {
  getLikedArticleIds,
  getOrCreateSessionId,
  getSavedArticleIds,
  toggleLikedArticleId,
  toggleSavedArticleId,
  trackAction,
} from '@/lib/client/home'
import type { ActionType } from '@/lib/db/types'
import type { UiArticle } from '@/components/home/home-state-shared'

export function useHomeArticleActions({
  allArticles,
  onOpenSummary,
  onOpenShare,
}: {
  allArticles: UiArticle[]
  onOpenSummary: (article: UiArticle) => void
  onOpenShare: (article: UiArticle) => void
}) {
  const [savedArticleIds, setSavedArticleIds] = useState<string[]>([])
  const [likedArticleIds, setLikedArticleIds] = useState<string[]>([])
  const [focusedArticleId, setFocusedArticleId] = useState<string | null>(null)

  useEffect(() => {
    getOrCreateSessionId()
    setSavedArticleIds(getSavedArticleIds())
    setLikedArticleIds(getLikedArticleIds())
  }, [])

  useEffect(() => {
    if (!focusedArticleId) return
    document.getElementById(`article-card-${focusedArticleId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusedArticleId])

  function findArticle(articleId: string): UiArticle | null {
    return allArticles.find((article) => article.id === articleId) ?? null
  }

  function handleCardClick(articleId: string) {
    const article = findArticle(articleId)
    if (article) onOpenSummary(article)
  }

  function handleOpenArticle(articleId: string) {
    const article = findArticle(articleId)
    if (!article) return

    window.open(article.url, '_blank', 'noopener,noreferrer')
    void trackAction({ actionType: 'article_open', articleId: article.id, source: 'direct' })
  }

  function handleLike(articleId: string) {
    const next = toggleLikedArticleId(articleId)
    const isNowLiked = next.includes(articleId)
    setLikedArticleIds(next)
    void trackAction({ actionType: isNowLiked ? 'like' : 'unlike', articleId, source: 'direct' })
  }

  function handleSaveToggle(articleId: string) {
    const next = toggleSavedArticleId(articleId)
    const isNowSaved = next.includes(articleId)
    setSavedArticleIds(next)
    void trackAction({ actionType: isNowSaved ? 'save' : 'unsave', articleId, source: 'direct' })
  }

  function handleArticleAction(type: ActionType, articleId: string) {
    const article = findArticle(articleId)
    if (!article) return

    if (type === 'share_open') {
      onOpenShare(article)
      return
    }

    if (type === 'like' || type === 'unlike') {
      handleLike(articleId)
      return
    }

    if (type === 'save' || type === 'unsave') {
      handleSaveToggle(articleId)
      return
    }

    if (type === 'topic_group_open') {
      setFocusedArticleId(articleId)
      void trackAction({ actionType: 'topic_group_open', articleId, source: 'topic_group' })
    }
  }

  return {
    savedArticleIds,
    likedArticleIds,
    focusedArticleId,
    handleCardClick,
    handleOpenArticle,
    handleArticleAction,
  }
}
