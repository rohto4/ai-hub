import { hackerNewsCollector } from '@/lib/collectors/hackernews'
import { papersWithCodeCollector } from '@/lib/collectors/paperswithcode'
import type { CollectedItem, Collector, SourceTarget } from '@/lib/collectors/types'

/**
 * fetchKind='api' のコレクター dispatcher。
 * sourceKey のパターンで実際のコレクターに振り分ける。
 */
const API_COLLECTORS: Array<{ pattern: RegExp; collector: Collector }> = [
  { pattern: /paperswithcode/, collector: papersWithCodeCollector },
  { pattern: /hackernews/,     collector: hackerNewsCollector },
]

export const apiCollector: Collector = {
  async collect(sourceTarget: SourceTarget): Promise<CollectedItem[]> {
    const entry = API_COLLECTORS.find(({ pattern }) => pattern.test(sourceTarget.sourceKey))
    if (!entry) {
      throw new Error(`No API collector registered for source_key=${sourceTarget.sourceKey}`)
    }
    return entry.collector.collect(sourceTarget)
  },
}
