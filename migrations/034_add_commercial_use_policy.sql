-- migration 034: ToS 調査結果の蓄積と商用利用ポリシー管理
-- 2026-03-20 調査結果を初期データとして投入

-- source_targets: ソース単位の商用利用ポリシー
ALTER TABLE source_targets
  ADD COLUMN IF NOT EXISTS commercial_use_policy text NOT NULL DEFAULT 'permitted'
  CHECK (commercial_use_policy IN ('permitted', 'prohibited', 'unknown'));

-- observed_article_domains: ドメイン単位の商用利用ポリシー
ALTER TABLE observed_article_domains
  ADD COLUMN IF NOT EXISTS commercial_use_policy text NOT NULL DEFAULT 'unknown'
  CHECK (commercial_use_policy IN ('permitted', 'prohibited', 'unknown'));

-- articles_enriched: 記事単位の統合ポリシー（source + domain の最厳値）
ALTER TABLE articles_enriched
  ADD COLUMN IF NOT EXISTS commercial_use_policy text NOT NULL DEFAULT 'permitted'
  CHECK (commercial_use_policy IN ('permitted', 'prohibited', 'unknown'));

-- articles_enriched_history: 履歴テーブルにも追加
ALTER TABLE articles_enriched_history
  ADD COLUMN IF NOT EXISTS commercial_use_policy text NOT NULL DEFAULT 'permitted'
  CHECK (commercial_use_policy IN ('permitted', 'prohibited', 'unknown'));

-- ── 2026-03-20 ToS 調査結果の初期投入 ──────────────────────────────────────
-- prohibited: 商用サービスでの RSS 取得・タイトル表示を明示禁止していることを確認済み
-- permitted: 明示的な禁止なしを確認済み
-- unknown: 未調査（デフォルト）

INSERT INTO observed_article_domains (
  domain, commercial_use_policy, fetch_policy, summary_policy,
  first_seen_at, last_seen_at
)
VALUES
  -- 明示禁止確認済み
  ('itmedia.co.jp',        'prohibited', 'blocked', 'summarize_snippet', now(), now()),
  ('techcrunch.com',       'prohibited', 'blocked', 'summarize_snippet', now(), now()),
  ('nikkei.com',           'prohibited', 'blocked', 'summarize_snippet', now(), now()),
  ('xtech.nikkei.com',     'prohibited', 'blocked', 'summarize_snippet', now(), now()),
  ('nikkei.co.jp',         'prohibited', 'blocked', 'summarize_snippet', now(), now()),
  ('qiita.com',            'prohibited', 'blocked', 'summarize_snippet', now(), now()),
  -- 制限なし確認済み
  ('sakana.ai',            'permitted',  'needs_review', 'domain_default', now(), now()),
  ('tech.preferred.jp',    'permitted',  'needs_review', 'domain_default', now(), now()),
  ('zenn.dev',             'permitted',  'needs_review', 'domain_default', now(), now()),
  ('jdla.org',             'permitted',  'needs_review', 'domain_default', now(), now()),
  ('ainow.ai',             'permitted',  'needs_review', 'domain_default', now(), now()),
  ('publickey1.jp',        'permitted',  'needs_review', 'domain_default', now(), now())
ON CONFLICT (domain) DO UPDATE SET
  commercial_use_policy = EXCLUDED.commercial_use_policy,
  last_seen_at = now();

-- 既存の articles_enriched を prohibited ドメインに基づいてバックフィル
UPDATE articles_enriched ae
SET commercial_use_policy = 'prohibited'
WHERE EXISTS (
  SELECT 1 FROM observed_article_domains oad
  WHERE oad.commercial_use_policy = 'prohibited'
    AND lower(regexp_replace(
          split_part(split_part(coalesce(ae.canonical_url, ae.cited_url, ae.normalized_url), '://', 2), '/', 1),
          '^www\.', ''
        )) = oad.domain
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_articles_enriched_commercial_use_policy
  ON articles_enriched (commercial_use_policy)
  WHERE commercial_use_policy = 'prohibited';

CREATE INDEX IF NOT EXISTS idx_observed_domains_commercial_policy
  ON observed_article_domains (domain, commercial_use_policy);

COMMENT ON COLUMN source_targets.commercial_use_policy IS
  '商用サービスでの RSS 取得・タイトル表示の可否。prohibited=ToS で明示禁止確認済み、permitted=制限なし確認済み、unknown=未調査。2026-03-20 初期調査実施';
COMMENT ON COLUMN observed_article_domains.commercial_use_policy IS
  '当該ドメインの記事を商用サービスで表示可能かどうか。2026-03-20 ToS 調査結果を初期投入';
COMMENT ON COLUMN articles_enriched.commercial_use_policy IS
  'source_targets.commercial_use_policy と observed_article_domains.commercial_use_policy の最厳値。prohibited の記事は hourly-publish で公開対象から除外される。enrich データ自体は非商用利用のために保持';
