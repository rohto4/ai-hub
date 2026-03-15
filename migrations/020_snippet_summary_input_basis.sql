ALTER TABLE articles_enriched
  ADD COLUMN IF NOT EXISTS summary_input_basis text NOT NULL DEFAULT 'full_content'
    CHECK (summary_input_basis IN ('full_content', 'source_snippet', 'title_only'));

ALTER TABLE articles_enriched_history
  ADD COLUMN IF NOT EXISTS summary_input_basis text;

UPDATE articles_enriched ae
SET
  summary_input_basis = CASE
    WHEN ae.content_path = 'full' THEN 'full_content'
    WHEN ae.publication_basis = 'source_snippet' THEN 'source_snippet'
    WHEN char_length(coalesce(ar.snippet, '')) >= 80 THEN 'source_snippet'
    ELSE 'title_only'
  END,
  publication_text = CASE
    WHEN ae.publication_basis = 'source_snippet' THEN coalesce(ae.summary_200, ae.summary_100)
    ELSE ae.publication_text
  END
FROM articles_raw ar
WHERE ar.id = ae.raw_article_id;
