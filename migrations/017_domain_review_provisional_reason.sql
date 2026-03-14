ALTER TABLE articles_enriched
  DROP CONSTRAINT IF EXISTS articles_enriched_provisional_reason_check;

ALTER TABLE articles_enriched
  ADD CONSTRAINT articles_enriched_provisional_reason_check
    CHECK (
      provisional_reason IS NULL
      OR provisional_reason IN (
        'snippet_only',
        'domain_snippet_only',
        'fetch_error',
        'extracted_below_threshold',
        'feed_only_policy',
        'domain_needs_review'
      )
    );

UPDATE observed_article_domains
SET
  fetch_policy = 'fulltext_allowed',
  summary_policy = 'summarize_full',
  updated_at = now()
WHERE domain IN ('anthropic.com', 'blog.google', 'research.google')
  AND fetch_policy <> 'fulltext_allowed';

COMMENT ON COLUMN articles_enriched.provisional_reason IS '仮蓄積理由: snippet_only / domain_snippet_only / fetch_error / extracted_below_threshold / feed_only_policy / domain_needs_review';
