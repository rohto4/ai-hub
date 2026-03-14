import { createHash } from 'crypto'

export function unwrapGoogleRedirectUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    if (url.hostname !== 'www.google.com' || url.pathname !== '/url') {
      return rawUrl
    }

    const target = url.searchParams.get('url')
    return target ? decodeURIComponent(target) : rawUrl
  } catch {
    return rawUrl
  }
}

/**
 * URL正規化 + ハッシュ生成
 * 同一記事の重複収集を防ぐ
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(unwrapGoogleRedirectUrl(rawUrl))

    // トラッキングパラメータを除去
    const REMOVE_PARAMS = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'fbclid', 'gclid', 'ref', 'source', 'from',
    ]
    REMOVE_PARAMS.forEach(p => url.searchParams.delete(p))

    // フラグメント除去
    url.hash = ''

    // 末尾スラッシュを統一（パスがある場合は除去）
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
    }

    // httpをhttpsに統一
    if (url.protocol === 'http:') {
      url.protocol = 'https:'
    }

    return url.toString()
  } catch {
    return rawUrl
  }
}

/** SHA-256ハッシュ（正規化URL → 重複判定キー） */
export function hashUrl(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl).digest('hex')
}

/** セッションID生成（匿名ユーザー識別） */
export function generateSessionId(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}
