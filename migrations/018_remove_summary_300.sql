ALTER TABLE articles_enriched
  DROP COLUMN IF EXISTS summary_300;

ALTER TABLE articles_enriched_history
  DROP COLUMN IF EXISTS summary_300;

ALTER TABLE public_articles
  DROP COLUMN IF EXISTS display_summary_300;
