DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'source_targets' AND column_name = 'id'
  ) THEN
    ALTER TABLE source_targets RENAME COLUMN id TO source_target_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'source_priority_rules' AND column_name = 'id'
  ) THEN
    ALTER TABLE source_priority_rules RENAME COLUMN id TO source_priority_rule_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles_raw' AND column_name = 'id'
  ) THEN
    ALTER TABLE articles_raw RENAME COLUMN id TO raw_article_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles_raw_history' AND column_name = 'id'
  ) THEN
    ALTER TABLE articles_raw_history RENAME COLUMN id TO raw_article_history_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tags_master' AND column_name = 'id'
  ) THEN
    ALTER TABLE tags_master RENAME COLUMN id TO tag_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tag_aliases' AND column_name = 'id'
  ) THEN
    ALTER TABLE tag_aliases RENAME COLUMN id TO tag_alias_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tag_candidate_pool' AND column_name = 'id'
  ) THEN
    ALTER TABLE tag_candidate_pool RENAME COLUMN id TO tag_candidate_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles_enriched' AND column_name = 'id'
  ) THEN
    ALTER TABLE articles_enriched RENAME COLUMN id TO enriched_article_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles_enriched_history' AND column_name = 'id'
  ) THEN
    ALTER TABLE articles_enriched_history RENAME COLUMN id TO enriched_article_history_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'public_articles' AND column_name = 'id'
  ) THEN
    ALTER TABLE public_articles RENAME COLUMN id TO public_article_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'public_article_sources' AND column_name = 'id'
  ) THEN
    ALTER TABLE public_article_sources RENAME COLUMN id TO public_article_source_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_logs' AND column_name = 'id'
  ) THEN
    ALTER TABLE activity_logs RENAME COLUMN id TO activity_log_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_operation_logs' AND column_name = 'id'
  ) THEN
    ALTER TABLE admin_operation_logs RENAME COLUMN id TO admin_operation_log_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'priority_processing_queue' AND column_name = 'id'
  ) THEN
    ALTER TABLE priority_processing_queue RENAME COLUMN id TO priority_processing_queue_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'push_subscriptions' AND column_name = 'id'
  ) THEN
    ALTER TABLE push_subscriptions RENAME COLUMN id TO push_subscription_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'digest_logs' AND column_name = 'id'
  ) THEN
    ALTER TABLE digest_logs RENAME COLUMN id TO digest_log_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_runs' AND column_name = 'id'
  ) THEN
    ALTER TABLE job_runs RENAME COLUMN id TO job_run_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_run_items' AND column_name = 'id'
  ) THEN
    ALTER TABLE job_run_items RENAME COLUMN id TO job_run_item_id;
  END IF;
END $$;
