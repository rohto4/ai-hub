ALTER TABLE articles_enriched
  ADD COLUMN IF NOT EXISTS summary_basis text NOT NULL DEFAULT 'full_content';

ALTER TABLE articles_enriched
  DROP CONSTRAINT IF EXISTS articles_enriched_summary_basis_check;

ALTER TABLE articles_enriched
  ADD CONSTRAINT articles_enriched_summary_basis_check
    CHECK (summary_basis IN ('full_content', 'feed_snippet', 'blocked_snippet', 'fallback_snippet'));

ALTER TABLE articles_enriched_history
  ADD COLUMN IF NOT EXISTS summary_basis text NOT NULL DEFAULT 'full_content';

UPDATE articles_enriched
SET
  summary_basis = CASE
    WHEN content_path = 'full' THEN 'full_content'
    WHEN provisional_reason = 'feed_only_policy' THEN 'feed_snippet'
    WHEN provisional_reason = 'domain_snippet_only' THEN 'blocked_snippet'
    ELSE 'fallback_snippet'
  END,
  updated_at = now()
WHERE summary_basis IS DISTINCT FROM CASE
  WHEN content_path = 'full' THEN 'full_content'
  WHEN provisional_reason = 'feed_only_policy' THEN 'feed_snippet'
  WHEN provisional_reason = 'domain_snippet_only' THEN 'blocked_snippet'
  ELSE 'fallback_snippet'
END;

UPDATE articles_enriched_history
SET summary_basis = CASE
  WHEN content_path = 'full' THEN 'full_content'
  WHEN provisional_reason = 'feed_only_policy' THEN 'feed_snippet'
  WHEN provisional_reason = 'domain_snippet_only' THEN 'blocked_snippet'
  ELSE 'fallback_snippet'
END
WHERE summary_basis IS DISTINCT FROM CASE
  WHEN content_path = 'full' THEN 'full_content'
  WHEN provisional_reason = 'feed_only_policy' THEN 'feed_snippet'
  WHEN provisional_reason = 'domain_snippet_only' THEN 'blocked_snippet'
  ELSE 'fallback_snippet'
END;

CREATE INDEX IF NOT EXISTS idx_articles_enriched_summary_basis
  ON articles_enriched (summary_basis, processed_at DESC);

COMMENT ON COLUMN articles_enriched.summary_basis IS '要約根拠: full_content / feed_snippet / blocked_snippet / fallback_snippet';
