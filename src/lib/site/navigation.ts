export type SiteCategoryKind = 'source-type' | 'source-category' | 'tag'

export type SiteCategory = {
  slug: string
  label: string
  kind: SiteCategoryKind
  queryValue: string
  solidColor: string
  softColor: string
}

export const SITE_CATEGORIES: SiteCategory[] = [
  {
    slug: 'official',
    label: 'OFFICIAL',
    kind: 'source-type',
    queryValue: 'official',
    solidColor: '#1974d2',
    softColor: '#dff0ff',
  },
  {
    slug: 'paper',
    label: 'PAPER',
    kind: 'source-type',
    queryValue: 'paper',
    solidColor: '#7b3aed',
    softColor: '#e6dbfd',
  },
  {
    slug: 'news',
    label: 'NEWS',
    kind: 'source-type',
    queryValue: 'news',
    solidColor: '#d43d51',
    softColor: '#ffe3e7',
  },
  {
    slug: 'search-rag',
    label: 'SEARCH / RAG',
    kind: 'source-category',
    queryValue: 'search',
    solidColor: '#c77719',
    softColor: '#fff0d9',
  },
  {
    slug: 'oss',
    label: 'OSS',
    kind: 'tag',
    queryValue: 'oss',
    solidColor: '#1f9d55',
    softColor: '#e0f7eb',
  },
  {
    slug: 'enterprise-ai',
    label: 'ENTERPRISE AI',
    kind: 'tag',
    queryValue: 'enterprise-ai',
    solidColor: '#0f8f86',
    softColor: '#daf7f5',
  },
]

export function findSiteCategory(slug: string): SiteCategory | null {
  return SITE_CATEGORIES.find((category) => category.slug === slug) ?? null
}
