CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  session_id text NOT NULL,
  endpoint text NOT NULL UNIQUE,
  keys jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS digest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  public_article_ids uuid[] NOT NULL DEFAULT '{}',
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digest_logs_retry
  ON digest_logs (status, scheduled_at)
  WHERE status <> 'sent';

COMMENT ON TABLE push_subscriptions IS '通知購読TBL';
COMMENT ON TABLE digest_logs IS '通知配信履歴TBL';
