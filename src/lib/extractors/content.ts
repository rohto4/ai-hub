import type { ContentAccessPolicy } from '@/lib/collectors/types'
import { extractContent } from '@/lib/rss/extract'

const SNIPPET_ONLY_HOSTS = new Set([
  'cdt.org',
  'www.cdt.org',
  'axios.com',
  'www.axios.com',
  'bloomberg.com',
  'www.bloomberg.com',
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
])

export interface ExtractedContentResult {
  content: string
  contentPath: 'full' | 'snippet'
  extractedLength: number
  snippetLength: number
  extractionStage:
    | 'extracted'
    | 'extracted_below_threshold'
    | 'fetch_error'
    | 'domain_snippet_only'
    | 'feed_only_policy'
  extractionError?: string | null
}

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export async function resolveArticleContent(
  url: string,
  snippet: string | null,
  contentAccessPolicy: ContentAccessPolicy,
): Promise<ExtractedContentResult> {
  const normalizedSnippet = snippet?.trim() ?? ''
  const hostname = getHostname(url)

  if (contentAccessPolicy === 'feed_only') {
    return {
      content: normalizedSnippet,
      contentPath: 'snippet',
      extractedLength: 0,
      snippetLength: normalizedSnippet.length,
      extractionStage: 'feed_only_policy',
      extractionError: 'feed_only_policy',
    }
  }

  if (contentAccessPolicy === 'blocked_snippet_only') {
    return {
      content: normalizedSnippet,
      contentPath: 'snippet',
      extractedLength: 0,
      snippetLength: normalizedSnippet.length,
      extractionStage: 'domain_snippet_only',
      extractionError: 'blocked_snippet_only_policy',
    }
  }

  if (hostname && SNIPPET_ONLY_HOSTS.has(hostname)) {
    return {
      content: normalizedSnippet,
      contentPath: 'snippet',
      extractedLength: 0,
      snippetLength: normalizedSnippet.length,
      extractionStage: 'domain_snippet_only',
      extractionError: hostname,
    }
  }

  try {
    const content = await extractContent(url)
    const normalizedContent = content.trim()

    if (
      normalizedContent.length >= 240 &&
      normalizedContent.length >= Math.max(140, normalizedSnippet.length * 1.4)
    ) {
      return {
        content,
        contentPath: 'full',
        extractedLength: normalizedContent.length,
        snippetLength: normalizedSnippet.length,
        extractionStage: 'extracted',
        extractionError: null,
      }
    }

    return {
      content: normalizedSnippet,
      contentPath: 'snippet',
      extractedLength: normalizedContent.length,
      snippetLength: normalizedSnippet.length,
      extractionStage: 'extracted_below_threshold',
      extractionError: null,
    }
  } catch {
    // Fall back to snippet-driven enrichment when fetch/extraction fails.
  }

  return {
    content: normalizedSnippet,
    contentPath: 'snippet',
    extractedLength: 0,
    snippetLength: normalizedSnippet.length,
    extractionStage: 'fetch_error',
    extractionError: 'fetch_or_parse_failed',
  }
}
