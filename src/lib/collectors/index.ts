import { rssCollector } from '@/lib/collectors/rss'
import type { Collector, FetchKind } from '@/lib/collectors/types'

const collectorByFetchKind: Partial<Record<FetchKind, Collector>> = {
  rss: rssCollector,
  alerts: rssCollector,
}

export function getCollector(fetchKind: FetchKind): Collector {
  const collector = collectorByFetchKind[fetchKind]
  if (!collector) {
    throw new Error(`No collector registered for fetch_kind=${fetchKind}`)
  }
  return collector
}
