ALTER TABLE source_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_priority_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles_raw_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_candidate_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles_enriched ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles_enriched_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles_enriched_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_metrics_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_articles_read ON public_articles;
CREATE POLICY public_articles_read
  ON public_articles FOR SELECT USING (visibility_status = 'published');

ALTER TABLE public_article_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_article_sources_read ON public_article_sources;
CREATE POLICY public_article_sources_read
  ON public_article_sources FOR SELECT USING (true);

ALTER TABLE public_article_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_article_tags_read ON public_article_tags;
CREATE POLICY public_article_tags_read
  ON public_article_tags FOR SELECT USING (true);

ALTER TABLE public_rankings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_rankings_read ON public_rankings;
CREATE POLICY public_rankings_read
  ON public_rankings FOR SELECT USING (true);

DROP POLICY IF EXISTS push_subscriptions_own_session ON push_subscriptions;
CREATE POLICY push_subscriptions_own_session
  ON push_subscriptions FOR ALL
  USING (session_id = current_setting('app.session_id', true));
