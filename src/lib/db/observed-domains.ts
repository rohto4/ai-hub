import { getSql } from '@/lib/db'
import type { SourceTarget } from '@/lib/collectors/types'

type ObservedDomainPolicy =
  | {
      fetchPolicy: 'fulltext_allowed'
      summaryPolicy: 'summarize_full'
    }
  | {
      fetchPolicy: 'blocked'
      summaryPolicy: 'summarize_snippet'
    }

const BLOCKED_DOMAIN_PATTERNS = ['cdt.org', 'axios.com', 'bloomberg.com', 'youtube.com']

const OFFICIAL_DOMAIN_ALLOWLIST_BY_SOURCE_KEY: Record<string, string[]> = {
  'anthropic-news': ['anthropic.com'],
  'google-ai-blog': ['blog.google', 'research.google'],
  'openai-news': ['openai.com'],
  'microsoft-foundry-blog': ['devblogs.microsoft.com'],
  'aws-machine-learning-blog': ['aws.amazon.com'],
  'huggingface-blog': ['huggingface.co'],
  'nvidia-developer-blog': ['developer.nvidia.com'],
  'meta-ai-news': ['about.fb.com'],
  'arxiv-ai': ['arxiv.org', 'alphaxiv.org'],
}

function normalizeObservedDomain(url: string | null): string | null {
  if (!url) {
    return null
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    return hostname || null
  } catch {
    return null
  }
}

function matchesDomainPattern(domain: string, pattern: string): boolean {
  return domain === pattern || domain.endsWith(`.${pattern}`)
}

function inferObservedDomainPolicy(
  articleDomain: string,
  sourceTarget?: Pick<SourceTarget, 'sourceKey' | 'baseUrl' | 'contentAccessPolicy'>,
): ObservedDomainPolicy | null {
  if (BLOCKED_DOMAIN_PATTERNS.some((pattern) => matchesDomainPattern(articleDomain, pattern))) {
    return {
      fetchPolicy: 'blocked',
      summaryPolicy: 'summarize_snippet',
    }
  }

  if (!sourceTarget || sourceTarget.contentAccessPolicy !== 'fulltext_allowed') {
    return null
  }

  const allowedPatterns = new Set<string>()
  const baseDomain = normalizeObservedDomain(sourceTarget.baseUrl)
  if (baseDomain) {
    allowedPatterns.add(baseDomain)
  }

  for (const pattern of OFFICIAL_DOMAIN_ALLOWLIST_BY_SOURCE_KEY[sourceTarget.sourceKey] ?? []) {
    allowedPatterns.add(pattern)
  }

  if ([...allowedPatterns].some((pattern) => matchesDomainPattern(articleDomain, pattern))) {
    return {
      fetchPolicy: 'fulltext_allowed',
      summaryPolicy: 'summarize_full',
    }
  }

  return null
}

export async function upsertObservedDomain(
  articleUrl: string | null,
  seenAt: string,
  sourceTarget?: Pick<SourceTarget, 'sourceKey' | 'baseUrl' | 'contentAccessPolicy'>,
): Promise<void> {
  const domain = normalizeObservedDomain(articleUrl)
  if (!domain) {
    return
  }

  const inferredPolicy = inferObservedDomainPolicy(domain, sourceTarget)
  const inferredFetchPolicy = inferredPolicy?.fetchPolicy ?? null
  const inferredSummaryPolicy = inferredPolicy?.summaryPolicy ?? null
  const sql = getSql()
  await sql`
    INSERT INTO observed_article_domains (
      domain,
      fetch_policy,
      summary_policy,
      observed_article_count,
      latest_article_url,
      first_seen_at,
      last_seen_at
    )
    VALUES (
      ${domain},
      ${inferredPolicy?.fetchPolicy ?? 'needs_review'},
      ${inferredPolicy?.summaryPolicy ?? 'domain_default'},
      1,
      ${articleUrl},
      ${seenAt},
      ${seenAt}
    )
    ON CONFLICT (domain) DO UPDATE SET
      fetch_policy = CASE
        WHEN ${inferredFetchPolicy}::text IS NOT NULL THEN ${inferredFetchPolicy}::text
        ELSE observed_article_domains.fetch_policy
      END,
      summary_policy = CASE
        WHEN ${inferredSummaryPolicy}::text IS NOT NULL THEN ${inferredSummaryPolicy}::text
        ELSE observed_article_domains.summary_policy
      END,
      observed_article_count = observed_article_domains.observed_article_count + 1,
      latest_article_url = EXCLUDED.latest_article_url,
      first_seen_at = LEAST(observed_article_domains.first_seen_at, EXCLUDED.first_seen_at),
      last_seen_at = GREATEST(observed_article_domains.last_seen_at, EXCLUDED.last_seen_at),
      updated_at = now()
  `
}
