CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_source_targets_updated_at ON source_targets;
CREATE TRIGGER trg_source_targets_updated_at
BEFORE UPDATE ON source_targets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_source_priority_rules_updated_at ON source_priority_rules;
CREATE TRIGGER trg_source_priority_rules_updated_at
BEFORE UPDATE ON source_priority_rules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_articles_raw_updated_at ON articles_raw;
CREATE TRIGGER trg_articles_raw_updated_at
BEFORE UPDATE ON articles_raw
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tags_master_updated_at ON tags_master;
CREATE TRIGGER trg_tags_master_updated_at
BEFORE UPDATE ON tags_master
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tag_candidate_pool_updated_at ON tag_candidate_pool;
CREATE TRIGGER trg_tag_candidate_pool_updated_at
BEFORE UPDATE ON tag_candidate_pool
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_articles_enriched_updated_at ON articles_enriched;
CREATE TRIGGER trg_articles_enriched_updated_at
BEFORE UPDATE ON articles_enriched
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_public_articles_updated_at ON public_articles;
CREATE TRIGGER trg_public_articles_updated_at
BEFORE UPDATE ON public_articles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_activity_metrics_hourly_updated_at ON activity_metrics_hourly;
CREATE TRIGGER trg_activity_metrics_hourly_updated_at
BEFORE UPDATE ON activity_metrics_hourly
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_digest_logs_updated_at ON digest_logs;
CREATE TRIGGER trg_digest_logs_updated_at
BEFORE UPDATE ON digest_logs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
