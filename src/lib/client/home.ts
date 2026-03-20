import type { ActionSource, ActionType, Platform } from '@/lib/db/types'

const SESSION_KEY = 'ai-trend-hub/session-id'
const SAVED_IDS_KEY = 'ai-trend-hub/saved-article-ids'
const SHARE_TAG_KEY = 'ai-trend-hub/share-append-tag'
const MISSKEY_INSTANCE_KEY = 'ai-trend-hub/misskey-instance'
const RETURN_FOCUS_KEY = 'ai-trend-hub/return-focus-article-id'

function canUseStorage(): boolean {
  return typeof window !== 'undefined'
}

export function getOrCreateSessionId(): string {
  if (!canUseStorage()) return 'server-session'

  const current = window.localStorage.getItem(SESSION_KEY)
  if (current) return current

  const next = window.crypto?.randomUUID?.() ?? `session-${Date.now()}`
  window.localStorage.setItem(SESSION_KEY, next)
  return next
}

export function getSavedArticleIds(): string[] {
  if (!canUseStorage()) return []

  const raw = window.localStorage.getItem(SAVED_IDS_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function toggleSavedArticleId(articleId: string): string[] {
  const current = new Set(getSavedArticleIds())
  if (current.has(articleId)) {
    current.delete(articleId)
  } else {
    current.add(articleId)
  }

  const next = [...current]
  if (canUseStorage()) {
    window.localStorage.setItem(SAVED_IDS_KEY, JSON.stringify(next))
  }
  return next
}

export function getShareAppendTag(): boolean {
  if (!canUseStorage()) return true
  return window.localStorage.getItem(SHARE_TAG_KEY) !== 'false'
}

export function setShareAppendTag(enabled: boolean): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(SHARE_TAG_KEY, enabled ? 'true' : 'false')
}

export function getMisskeyInstance(): string {
  if (!canUseStorage()) return ''
  return window.localStorage.getItem(MISSKEY_INSTANCE_KEY) ?? ''
}

export function setMisskeyInstance(instance: string): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(MISSKEY_INSTANCE_KEY, instance.trim())
}

export function setReturnFocusArticleId(articleId: string): void {
  if (!canUseStorage()) return
  window.sessionStorage.setItem(RETURN_FOCUS_KEY, articleId)
}

export function consumeReturnFocusArticleId(): string | null {
  if (!canUseStorage()) return null
  const articleId = window.sessionStorage.getItem(RETURN_FOCUS_KEY)
  if (!articleId) return null
  window.sessionStorage.removeItem(RETURN_FOCUS_KEY)
  return articleId
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'pc'
  const ua = navigator.userAgent.toLowerCase()
  if (/ipad|tablet/.test(ua)) return 'tb'
  if (/mobile|iphone|android/.test(ua)) return 'sp'
  return 'pc'
}

export async function trackAction(params: {
  actionType: ActionType
  articleId?: string | null
  source?: ActionSource
  meta?: Record<string, unknown>
}): Promise<void> {
  try {
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        article_id: params.articleId ?? null,
        action_type: params.actionType,
        session_id: getOrCreateSessionId(),
        platform: detectPlatform(),
        source: params.source,
        meta: params.meta,
      }),
    })
  } catch {
    // Action logging should never block UX.
  }
}

// ── 高評価（ライク）管理 ───────────────────────────────────────
const LIKED_IDS_KEY = 'ai-trend-hub/liked-article-ids'

export function getLikedArticleIds(): string[] {
  if (!canUseStorage()) return []
  const raw = window.localStorage.getItem(LIKED_IDS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function toggleLikedArticleId(articleId: string): string[] {
  const current = new Set(getLikedArticleIds())
  if (current.has(articleId)) {
    current.delete(articleId)
  } else {
    current.add(articleId)
  }
  const next = [...current]
  if (canUseStorage()) {
    window.localStorage.setItem(LIKED_IDS_KEY, JSON.stringify(next))
  }
  return next
}
