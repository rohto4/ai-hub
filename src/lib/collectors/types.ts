export type FetchKind = 'rss' | 'api' | 'alerts' | 'manual'

export interface SourceTarget {
  id: string
  sourceKey: string
  displayName: string
  fetchKind: FetchKind
  sourceCategory: string
  baseUrl: string | null
  fetchIntervalMinutes: number
  supportsUpdateDetection: boolean
  requiresAuth: boolean
}

export interface CollectedItem {
  sourceItemId: string | null
  sourceUrl: string
  citedUrl: string | null
  title: string | null
  snippet: string | null
  sourcePublishedAt: string | null
  sourceUpdatedAt: string | null
  sourceAuthor: string | null
  sourceMeta: Record<string, unknown>
}

export interface Collector {
  collect(sourceTarget: SourceTarget): Promise<CollectedItem[]>
}
