UPDATE articles_enriched
SET
  is_provisional = CASE
    WHEN content_path = 'snippet' THEN true
    ELSE false
  END,
  provisional_reason = CASE
    WHEN content_path <> 'snippet' THEN NULL
    WHEN lower(coalesce(cited_url, canonical_url, normalized_url)) LIKE '%cdt.org%' THEN 'domain_snippet_only'
    ELSE 'snippet_only'
  END,
  updated_at = now()
WHERE
  is_provisional IS DISTINCT FROM (content_path = 'snippet')
  OR provisional_reason IS DISTINCT FROM CASE
    WHEN content_path <> 'snippet' THEN NULL
    WHEN lower(coalesce(cited_url, canonical_url, normalized_url)) LIKE '%cdt.org%' THEN 'domain_snippet_only'
    ELSE 'snippet_only'
  END;

UPDATE articles_enriched_history
SET
  is_provisional = CASE
    WHEN content_path = 'snippet' THEN true
    ELSE false
  END,
  provisional_reason = CASE
    WHEN content_path <> 'snippet' THEN NULL
    WHEN lower(coalesce(cited_url, canonical_url, normalized_url)) LIKE '%cdt.org%' THEN 'domain_snippet_only'
    ELSE 'snippet_only'
  END
WHERE
  is_provisional IS DISTINCT FROM (content_path = 'snippet')
  OR provisional_reason IS DISTINCT FROM CASE
    WHEN content_path <> 'snippet' THEN NULL
    WHEN lower(coalesce(cited_url, canonical_url, normalized_url)) LIKE '%cdt.org%' THEN 'domain_snippet_only'
    ELSE 'snippet_only'
  END;
