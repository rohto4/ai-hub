ALTER TABLE articles_enriched
  ADD COLUMN IF NOT EXISTS publication_basis text NOT NULL DEFAULT 'hold'
    CHECK (publication_basis IN ('hold', 'full_summary', 'source_snippet')),
  ADD COLUMN IF NOT EXISTS publication_text text;

ALTER TABLE articles_enriched_history
  ADD COLUMN IF NOT EXISTS publication_basis text,
  ADD COLUMN IF NOT EXISTS publication_text text;

UPDATE articles_enriched ae
SET
  publication_basis = CASE
    WHEN ae.content_path = 'full' THEN 'full_summary'
    WHEN ae.summary_basis IN ('feed_snippet', 'blocked_snippet')
      AND ae.dedupe_status = 'unique'
      AND ae.score >= 55
      AND char_length(coalesce(ar.snippet, '')) >= 80
      AND coalesce(ar.snippet, '') !~ '^(\\.{3}|…)' THEN 'source_snippet'
    ELSE 'hold'
  END,
  publication_text = CASE
    WHEN ae.content_path = 'full' THEN coalesce(ae.summary_200, ae.summary_100)
    WHEN ae.summary_basis IN ('feed_snippet', 'blocked_snippet')
      AND ae.dedupe_status = 'unique'
      AND ae.score >= 55
      AND char_length(coalesce(ar.snippet, '')) >= 80
      AND coalesce(ar.snippet, '') !~ '^(\\.{3}|…)' THEN ar.snippet
    ELSE NULL
  END,
  publish_candidate = CASE
    WHEN ae.content_path = 'full'
      THEN ae.publish_candidate
    WHEN ae.summary_basis IN ('feed_snippet', 'blocked_snippet')
      AND ae.dedupe_status = 'unique'
      AND ae.score >= 55
      AND char_length(coalesce(ar.snippet, '')) >= 80
      AND coalesce(ar.snippet, '') !~ '^(\\.{3}|…)' THEN true
    ELSE false
  END,
  is_provisional = CASE
    WHEN ae.summary_basis IN ('feed_snippet', 'blocked_snippet')
      AND ae.dedupe_status = 'unique'
      AND ae.score >= 55
      AND char_length(coalesce(ar.snippet, '')) >= 80
      AND coalesce(ar.snippet, '') !~ '^(\\.{3}|…)' THEN false
    ELSE ae.is_provisional
  END,
  provisional_reason = CASE
    WHEN ae.summary_basis IN ('feed_snippet', 'blocked_snippet')
      AND ae.dedupe_status = 'unique'
      AND ae.score >= 55
      AND char_length(coalesce(ar.snippet, '')) >= 80
      AND coalesce(ar.snippet, '') !~ '^(\\.{3}|…)' THEN NULL
    ELSE ae.provisional_reason
  END
FROM articles_raw ar
WHERE ar.id = ae.raw_article_id;
