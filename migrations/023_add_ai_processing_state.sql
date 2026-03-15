ALTER TABLE articles_enriched
  ADD COLUMN IF NOT EXISTS ai_processing_state text NOT NULL DEFAULT 'completed'
    CHECK (ai_processing_state IN ('completed', 'manual_pending'));

ALTER TABLE articles_enriched_history
  ADD COLUMN IF NOT EXISTS ai_processing_state text;

UPDATE articles_enriched
SET ai_processing_state = 'completed'
WHERE ai_processing_state IS DISTINCT FROM 'completed';

UPDATE articles_enriched_history
SET ai_processing_state = 'completed'
WHERE ai_processing_state IS NULL;

ALTER TABLE articles_enriched_history
  ALTER COLUMN ai_processing_state SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'articles_enriched_history_ai_processing_state_check'
  ) THEN
    ALTER TABLE articles_enriched_history
      ADD CONSTRAINT articles_enriched_history_ai_processing_state_check
        CHECK (ai_processing_state IN ('completed', 'manual_pending'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_articles_enriched_ai_processing_state
  ON articles_enriched (ai_processing_state, processed_at DESC);
