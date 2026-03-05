# データモデル設計（Supabase/PostgreSQL）v2

最終更新: 2026-03-05

## 1. 設計意図

1. コンテンツ収集と表示を分離
2. 重複排除と Topic Group 横断を両立
3. プロダクト改善に必要な行動データを最初から蓄積
4. 日本語運用と通知配信を初期リリースで成立

## 2. エンティティ一覧

## 2.1 コンテンツ系

1. `feeds`
2. `source_items`
3. `articles`
4. `article_genres`
5. `topic_groups`
6. `summaries`
7. `rank_scores`

## 2.2 ユーザー/設定系

1. `users_profile`
2. `user_interest_profiles`
3. `user_summary_preferences`
4. `user_notification_preferences`
5. `push_subscriptions`

## 2.3 行動分析系（Data Science）

1. `event_log`
2. `session_log`
3. `daily_user_metrics`
4. `content_performance_daily`

## 2.4 通知運用系

1. `digest_queue`
2. `notification_delivery_log`

## 3. データサイエンス用に保存すべき情報

## 3.1 行動イベント

1. 一覧表示（impression）
2. 詳細閲覧（open）
3. Topic Group 切替（switch_source）
4. 共有クリック（share_click）
5. 外部リンク遷移（source_open）
6. 批評展開（critic_expand）
7. 要約モード切替（summary_mode_change）
8. 通知開封（push_open）

## 3.2 最低限の文脈情報

1. `device_type`（mobile/tablet/desktop）
2. `referrer_type`（direct/search/social/push）
3. `genre_context`
4. `topic_group_id`
5. `ab_bucket`（将来用、初期は固定）

## 3.3 ユーザー傾向分析に必要な派生指標

1. 分野別閲覧比率
2. 共有率（シェア/閲覧）
3. 通知反応率（開封/配信）
4. 要約モード選好（100/200/300）
5. デバイス別滞在分布

## 4. 主要テーブル定義（抜粋）

## 4.1 コンテンツ

```sql
create table if not exists feeds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rss_url text not null unique,
  source_type text not null default 'google_alert',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists source_items (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references feeds(id) on delete cascade,
  raw_title text not null,
  raw_url text not null,
  normalized_url text not null,
  published_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','processed','failed','duplicate')),
  ingested_at timestamptz not null default now()
);

create table if not exists topic_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  topic_label text not null,
  confidence numeric(5,4) not null default 0.0,
  created_at timestamptz not null default now()
);

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  canonical_url text not null unique,
  title text not null,
  domain text not null,
  content_hash text not null,
  title_fingerprint text not null,
  primary_genre text not null check (primary_genre in ('video','official','blog')),
  topic_group_id uuid references topic_groups(id),
  language text not null default 'ja',
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists summaries (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null unique references articles(id) on delete cascade,
  summary_100 varchar(100) not null,
  summary_200 varchar(200),
  summary_300 varchar(300),
  innovation_delta text,
  hype_risk text not null check (hype_risk in ('low','medium','high')),
  target_audience text,
  tags text[] default '{}',
  model_name text not null,
  created_at timestamptz not null default now()
);
```

## 4.2 ユーザー設定

```sql
create table if not exists users_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  locale text not null default 'ja-JP',
  created_at timestamptz not null default now()
);

create table if not exists user_interest_profiles (
  user_id uuid not null references users_profile(id) on delete cascade,
  interest_key text not null,
  weight numeric(5,4) not null default 1.0,
  updated_at timestamptz not null default now(),
  primary key (user_id, interest_key)
);

create table if not exists user_summary_preferences (
  user_id uuid primary key references users_profile(id) on delete cascade,
  default_mode smallint not null default 100 check (default_mode in (100,200,300)),
  critic_default_open boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists user_notification_preferences (
  user_id uuid primary key references users_profile(id) on delete cascade,
  enabled boolean not null default true,
  notify_at_1 time not null default '07:00',
  notify_at_2 time not null default '12:00',
  notify_at_3 time not null default '18:00',
  timezone text not null default 'Asia/Tokyo',
  updated_at timestamptz not null default now()
);
```

## 4.3 通知と分析ログ

```sql
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users_profile(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists event_log (
  id bigserial primary key,
  user_id uuid,
  session_id uuid,
  event_name text not null,
  article_id uuid,
  topic_group_id uuid,
  device_type text not null check (device_type in ('mobile','tablet','desktop')),
  referrer_type text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists notification_delivery_log (
  id bigserial primary key,
  user_id uuid not null,
  scheduled_for timestamptz not null,
  delivered_at timestamptz,
  opened_at timestamptz,
  status text not null check (status in ('queued','sent','failed','opened')),
  reason text
);
```

## 5. インデックス方針

1. `articles(primary_genre, content_hash)` 重複判定高速化
2. `articles(topic_group_id)` 横断表示高速化
3. `event_log(event_name, occurred_at desc)` 行動集計高速化
4. `notification_delivery_log(status, scheduled_for)` 配信監視高速化

## 6. RLS 方針（要約）

1. 公開データ:
   - `articles`, `summaries`, 公開ランキングビューは読み取り可
2. ユーザー設定:
   - 本人のみ読書き
3. イベントログ:
   - 書き込みはアプリサーバー経由のみ

## 7. データ保持ポリシー

1. `source_items`: 90 日
2. `event_log`: 明細 180 日、日次集計は長期保持
3. `notification_delivery_log`: 180 日

## 8. 分析で最初に見るダッシュボード項目

1. ジャンル別 CTR
2. Topic Group 横断遷移率
3. 共有率（デバイス別）
4. 要約モード利用分布
5. 通知送信成功率・開封率
