ALTER TABLE source_targets
  ADD COLUMN IF NOT EXISTS content_access_policy text NOT NULL DEFAULT 'feed_only'
    CHECK (content_access_policy IN ('feed_only', 'fulltext_allowed', 'blocked_snippet_only'));

UPDATE source_targets
SET
  content_access_policy = CASE
    WHEN source_key IN ('google-ai-blog', 'anthropic-news') THEN 'fulltext_allowed'
    WHEN source_key = 'ai-news-roundup' THEN 'feed_only'
    WHEN fetch_kind = 'alerts' THEN 'feed_only'
    ELSE 'feed_only'
  END,
  updated_at = now()
WHERE content_access_policy IS DISTINCT FROM CASE
  WHEN source_key IN ('google-ai-blog', 'anthropic-news') THEN 'fulltext_allowed'
  WHEN source_key = 'ai-news-roundup' THEN 'feed_only'
  WHEN fetch_kind = 'alerts' THEN 'feed_only'
  ELSE 'feed_only'
END;

COMMENT ON COLUMN source_targets.content_access_policy IS '本文取得方針: feed_only / fulltext_allowed / blocked_snippet_only';
