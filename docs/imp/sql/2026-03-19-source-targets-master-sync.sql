-- source_targets を SSOT として L2/L4 を再同期する
-- 実行対象:
--   1. source_targets seed 再投入後
--   2. articles_enriched.source_category / source_type 再同期
--   3. public_articles.source_category / source_type / primary source snapshot 再同期

BEGIN;

UPDATE articles_enriched AS ae
SET
  source_category = st.source_category,
  source_type = st.source_type,
  updated_at = now()
FROM source_targets AS st
WHERE st.source_target_id = ae.source_target_id
  AND (
    ae.source_category IS DISTINCT FROM st.source_category
    OR ae.source_type IS DISTINCT FROM st.source_type
  );

UPDATE public_articles AS pa
SET
  source_category = st.source_category,
  source_type = st.source_type,
  updated_at = now()
FROM source_targets AS st
WHERE st.source_target_id = pa.primary_source_target_id
  AND (
    pa.source_category IS DISTINCT FROM st.source_category
    OR pa.source_type IS DISTINCT FROM st.source_type
  );

UPDATE public_article_sources AS pas
SET
  source_key = st.source_key,
  source_display_name = st.display_name
FROM source_targets AS st
WHERE st.source_target_id = pas.source_target_id
  AND (
    pas.source_key IS DISTINCT FROM st.source_key
    OR pas.source_display_name IS DISTINCT FROM st.display_name
  );

INSERT INTO articles_enriched_sources (
  enriched_article_id,
  source_target_id,
  source_key,
  source_display_name,
  source_category,
  source_type,
  selection_status,
  selection_reason
)
SELECT
  ae.enriched_article_id,
  ae.source_target_id,
  st.source_key,
  st.display_name,
  ae.source_category,
  ae.source_type,
  CASE
    WHEN ae.dedupe_status = 'unique' THEN 'selected'
    ELSE 'rejected'
  END,
  CASE
    WHEN ae.dedupe_status = 'unique' THEN 'primary article source'
    ELSE 'dedupe group member'
  END
FROM articles_enriched AS ae
JOIN source_targets AS st
  ON st.source_target_id = ae.source_target_id
ON CONFLICT (enriched_article_id, source_key, selection_status) DO UPDATE SET
  source_target_id = EXCLUDED.source_target_id,
  source_display_name = EXCLUDED.source_display_name,
  source_category = EXCLUDED.source_category,
  source_type = EXCLUDED.source_type,
  selection_reason = EXCLUDED.selection_reason,
  updated_at = now();

COMMIT;
