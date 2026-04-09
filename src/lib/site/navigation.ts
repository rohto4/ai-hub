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

type ArticleCategoryParams = {
  sourceType: string
  sourceCategory: string
  primaryTagKeys?: string[]
  adjacentTagKeys?: string[]
}

function resolveArticleSiteCategory(params: ArticleCategoryParams): SiteCategory | null {
  const { sourceType, sourceCategory, primaryTagKeys = [], adjacentTagKeys = [] } = params
  const bySourceType = SITE_CATEGORIES.find((c) => c.kind === 'source-type' && c.queryValue === sourceType)
  if (bySourceType) return bySourceType
  const bySourceCategory = SITE_CATEGORIES.find((c) => c.kind === 'source-category' && c.queryValue === sourceCategory)
  if (bySourceCategory) return bySourceCategory
  const allTagKeys = [...primaryTagKeys, ...adjacentTagKeys]
  return SITE_CATEGORIES.find((c) => c.kind === 'tag' && allTagKeys.includes(c.queryValue)) ?? null
}

export function getArticleCategoryLabel(params: ArticleCategoryParams): string | null {
  return resolveArticleSiteCategory(params)?.label ?? null
}

export function getRelatedTopicLink(params: ArticleCategoryParams): { href: string; label: string } | null {
  const category = resolveArticleSiteCategory(params)
  if (!category) return null
  return { href: `/category/${category.slug}`, label: category.label }
}
