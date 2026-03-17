import type { CollectedItem, Collector, SourceTarget } from '@/lib/collectors/types'

type PwcPaper = {
  id: string
  title: string
  url_abs: string
  url_pdf: string | null
  abstract: string | null
  published: string | null
  authors: Array<{ name: string }>
  github_url: string | null
  tasks: Array<{ task: string }> | null
}

type PwcResponse = {
  results: PwcPaper[]
}

function parseDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export const papersWithCodeCollector: Collector = {
  async collect(sourceTarget: SourceTarget): Promise<CollectedItem[]> {
    const baseUrl = sourceTarget.baseUrl ?? 'https://paperswithcode.com/api/v1/papers/?ordering=-published&page_size=20'

    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'AITrendHub/1.0 (+https://aitrend.hub)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      throw new Error(`Papers with Code API returned status ${response.status}`)
    }

    const data = (await response.json()) as PwcResponse

    return data.results.map((paper) => {
      const authors = paper.authors.map((a) => a.name).join(', ')
      const tasks = (paper.tasks ?? []).map((t) => t.task)

      return {
        sourceItemId: paper.id,
        sourceUrl: paper.url_abs,
        citedUrl: paper.url_abs,
        title: paper.title,
        snippet: paper.abstract ?? null,
        sourcePublishedAt: parseDate(paper.published),
        sourceUpdatedAt: parseDate(paper.published),
        sourceAuthor: authors || null,
        sourceMeta: {
          pdfUrl: paper.url_pdf ?? null,
          githubUrl: paper.github_url ?? null,
          tasks,
          authors: paper.authors,
        },
      }
    })
  },
}
