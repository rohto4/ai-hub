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
        'feed_only_policy'
      )
    );

UPDATE articles_enriched ae
SET
  provisional_reason = 'feed_only_policy',
  updated_at = now()
FROM source_targets st
WHERE ae.source_target_id = st.id
  AND st.content_access_policy = 'feed_only'
  AND ae.content_path = 'snippet'
  AND ae.provisional_reason IS DISTINCT FROM 'feed_only_policy';

UPDATE articles_enriched_history aeh
SET provisional_reason = 'feed_only_policy'
FROM source_targets st
WHERE aeh.source_target_id = st.id
  AND st.content_access_policy = 'feed_only'
  AND aeh.content_path = 'snippet'
  AND aeh.provisional_reason IS DISTINCT FROM 'feed_only_policy';

COMMENT ON COLUMN articles_enriched.provisional_reason IS '仮蓄積理由: snippet_only / domain_snippet_only / fetch_error / extracted_below_threshold / feed_only_policy';
