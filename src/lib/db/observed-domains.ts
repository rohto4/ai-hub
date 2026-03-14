import { getSql } from '@/lib/db'

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

export async function upsertObservedDomain(articleUrl: string | null, seenAt: string): Promise<void> {
  const domain = normalizeObservedDomain(articleUrl)
  if (!domain) {
    return
  }

  const sql = getSql()
  await sql`
    INSERT INTO observed_article_domains (
      domain,
      observed_article_count,
      latest_article_url,
      first_seen_at,
      last_seen_at
    )
    VALUES (
      ${domain},
      1,
      ${articleUrl},
      ${seenAt},
      ${seenAt}
    )
    ON CONFLICT (domain) DO UPDATE SET
      observed_article_count = observed_article_domains.observed_article_count + 1,
      latest_article_url = EXCLUDED.latest_article_url,
      first_seen_at = LEAST(observed_article_domains.first_seen_at, EXCLUDED.first_seen_at),
      last_seen_at = GREATEST(observed_article_domains.last_seen_at, EXCLUDED.last_seen_at),
      updated_at = now()
  `
}
