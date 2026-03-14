CREATE TABLE IF NOT EXISTS observed_article_domains (
  domain text PRIMARY KEY,
  fetch_policy text NOT NULL DEFAULT 'needs_review'
    CHECK (fetch_policy IN ('needs_review', 'fulltext_allowed', 'snippet_only', 'blocked')),
  summary_policy text NOT NULL DEFAULT 'domain_default'
    CHECK (summary_policy IN ('domain_default', 'summarize_full', 'summarize_snippet')),
  observed_article_count integer NOT NULL DEFAULT 0,
  latest_article_url text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO observed_article_domains (
  domain,
  fetch_policy,
  summary_policy,
  observed_article_count,
  latest_article_url,
  first_seen_at,
  last_seen_at
)
SELECT
  domain,
  CASE
    WHEN domain IN ('cdt.org', 'axios.com', 'bloomberg.com', 'youtube.com', 'm.youtube.com') THEN 'blocked'
    ELSE 'needs_review'
  END AS fetch_policy,
  CASE
    WHEN domain IN ('cdt.org', 'axios.com', 'bloomberg.com', 'youtube.com', 'm.youtube.com') THEN 'summarize_snippet'
    ELSE 'domain_default'
  END AS summary_policy,
  COUNT(*)::integer AS observed_article_count,
  (ARRAY_AGG(url ORDER BY seen_at DESC))[1] AS latest_article_url,
  MIN(seen_at) AS first_seen_at,
  MAX(seen_at) AS last_seen_at
FROM (
  SELECT
    lower(regexp_replace(split_part(split_part(coalesce(cited_url, normalized_url), '://', 2), '/', 1), '^www\.', '')) AS domain,
    coalesce(cited_url, normalized_url) AS url,
    created_at AS seen_at
  FROM articles_raw
  WHERE coalesce(cited_url, normalized_url) IS NOT NULL
) observed
WHERE domain <> ''
GROUP BY domain
ON CONFLICT (domain) DO UPDATE SET
  observed_article_count = EXCLUDED.observed_article_count,
  latest_article_url = EXCLUDED.latest_article_url,
  first_seen_at = LEAST(observed_article_domains.first_seen_at, EXCLUDED.first_seen_at),
  last_seen_at = GREATEST(observed_article_domains.last_seen_at, EXCLUDED.last_seen_at),
  updated_at = now();

CREATE INDEX IF NOT EXISTS idx_observed_article_domains_policy
  ON observed_article_domains (fetch_policy, observed_article_count DESC, domain ASC);

COMMENT ON TABLE observed_article_domains IS '取得先ドメインの観測一覧と取得方針';
COMMENT ON COLUMN observed_article_domains.fetch_policy IS 'ドメイン取得方針: needs_review / fulltext_allowed / snippet_only / blocked';
COMMENT ON COLUMN observed_article_domains.summary_policy IS 'ドメイン要約方針: domain_default / summarize_full / summarize_snippet';
