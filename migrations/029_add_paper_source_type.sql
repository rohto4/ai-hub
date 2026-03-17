-- migration 029: source_type に 'paper' を追加する
--
-- 背景:
--   論文ソース（arXiv / Papers with Code / HuggingFace Papers）追加に備えて
--   source_type の CHECK 制約に 'paper' を追加する。

-- source_targets
ALTER TABLE source_targets DROP CONSTRAINT IF EXISTS source_targets_source_type_check;
ALTER TABLE source_targets ADD CONSTRAINT source_targets_source_type_check
  CHECK (source_type IN ('official', 'blog', 'news', 'video', 'alerts', 'paper'));

-- articles_enriched
ALTER TABLE articles_enriched DROP CONSTRAINT IF EXISTS articles_enriched_source_type_check;
ALTER TABLE articles_enriched ADD CONSTRAINT articles_enriched_source_type_check
  CHECK (source_type IN ('official', 'blog', 'news', 'video', 'alerts', 'paper'));

-- public_articles
ALTER TABLE public_articles DROP CONSTRAINT IF EXISTS public_articles_source_type_check;
ALTER TABLE public_articles ADD CONSTRAINT public_articles_source_type_check
  CHECK (source_type IN ('official', 'blog', 'news', 'video', 'alerts', 'paper'));
