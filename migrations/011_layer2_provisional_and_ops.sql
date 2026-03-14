ALTER TABLE articles_enriched
  ADD COLUMN IF NOT EXISTS is_provisional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provisional_reason text
    CHECK (
      provisional_reason IS NULL
      OR provisional_reason IN ('snippet_only', 'domain_snippet_only', 'fetch_error', 'extracted_below_threshold')
    );

ALTER TABLE articles_enriched_history
  ADD COLUMN IF NOT EXISTS is_provisional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provisional_reason text;

CREATE INDEX IF NOT EXISTS idx_articles_enriched_provisional
  ON articles_enriched (is_provisional, provisional_reason, processed_at DESC);

COMMENT ON COLUMN articles_enriched.is_provisional IS '本文未取得のため snippet ベースで仮蓄積中か';
COMMENT ON COLUMN articles_enriched.provisional_reason IS '仮蓄積理由: snippet_only / domain_snippet_only / fetch_error / extracted_below_threshold';
