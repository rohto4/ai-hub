# AI Trend Hub — P0 実装計画

最終更新: 2026-03-11

---

## 確定済み技術決定

| # | 項目 | 決定内容 |
|---|---|---|
| 1 | DB | Neon (PostgreSQL 16) |
| 2 | Auth | Firebase Auth (Admin SDK + Client SDK) |
| 3 | AI | Gemini Flash → テンプレートフォールバック（2段） |
| 4 | OGP | @vercel/og |
| 5 | 通知 | Web Push (07:00 / 12:00 / 18:00 固定) |
| 6 | Topic Group | 同ジャンル内コサイン類似度 ≥ 0.8（クロスジャンルなし） |
| 7 | パーソナライズ | 匿名ブラウザ保存 + 任意ログイン同期 |
| 8 | ポーリング | なし（手動リロードのみ） |
| 9 | 要約モード | 100字標準 + 200/300展開 |
| 10 | 本文キャッシュ | 7日間（メタデータ・要約は永続） |
| 11 | 収集元 | Google Alerts 中心 + 重要ソース限定追加 |
| 12 | サムネ生成 | プロバイダ抽象化（AIフォールバック層と共通） |
| 13 | 検索 | P0 でキーワード検索（ILIKEベース、拡張は後段で再評価） |
| A | pgvector | 最初から導入（embedding vector(768)、IVFFlat） |
| B | action_logs | 細粒度15種類・セッション単位・週次パーティション |
| C | rank_scores更新 | 30分バッチ（Vercel Cron） |

**未確定**: #17 Topic Group遷移方式（別ページ / ドロワー / インライン展開）

## ローカル開発メモ（2026-03-10）

- Neon アカウント未準備の間は `DATABASE_URL` / `DATABASE_URL_UNPOOLED` を未設定のままでよい。
- その状態でもアプリ本体は起動可能とし、DB依存APIは `503 database unavailable` を返す。
- 先行着手対象は UI 実装、バリデーション、非DBロジック、マイグレーション整備。
- Neon 接続後の初期確認は `npm run db:migrate` → `npm run db:seed` → `npm run dev` の順で行う。

## 現在ステータス（2026-03-11）

- Neon 接続確認済み
- migration 適用済み（`001`〜`009`）
- 開発用 seed 投入済み（feeds / topic_groups / articles / rank_scores）
- `GET /api/trends` 正常
- `GET /api/search` 正常
- Home 一覧は `/api/trends` ベースの暫定 live 化済み（失敗時はモックへフォールバック）
- 検索 UI は Enter / ボタン submit で `/api/search` 接続済み
- 次の主対象は「SP/TB 対応」「OGP 実装」「PWA 導線」

## 実装フェイズ方針（Sprint 1）

1. ホーム画面をモック配列から `/api/trends` ベースへ切替
2. 検索 UI は Enter / ボタン submit で `/api/search` へ接続
3. `actions` API は速度優先で接続し、重いものは表示後非同期送信を許容する
4. Topic Group は仮実装を先行し、後で最終確定させる
5. SP / TB UI を OGP 実装前に入れ、公開面の情報量出し分けを先に固める
6. Firebase Auth / Web Push / ingest cron は Sprint 2 以降へ送る
7. 管理画面の MVP は「フィード管理 + 要約監査キュー + ジョブ履歴」を前提に設計する

## ソース取得方針（2026-03-10 確定）

- 重要ソース 20% を自動取得対象にすること自体は可能。
- ただし「どの URL でも自動収集」ではなく、取得手段を限定する。
- 実装方針は **`RSS / Atom / 公式 API / 利用条件が明示された公開 feed のみ自動取得`** とする。

### 実務上の判断

1. `Google Alerts 100%` は立ち上げは楽。
2. ただし品質と速度が不安定になりやすい。
3. 一方で「重要ソース20%」を雑にスクレイピングすると、規約確認・変更追従・例外処理が重い。
4. そのため中間案として、`Google Alerts` を母集団にしつつ、重要ソースは自動取得してよいものだけを追加する。

### 追加条件

- 公式 RSS / Atom がある
- 公式 API がある
- robots / 利用条件上、機械取得を明確に拒否していない
- ログイン不要の公開面
- 保存・再配布の扱いが今の設計と矛盾しない

### 運用ルール

- 上記条件を満たす重要ソースのみ、自動取得対象にする
- それ以外は「候補として管理画面に出すが、自動取得対象にはしない」
- P0 は `Google Alerts` 中心 + `RSS / Atom / 公式 API` 限定の重要ソース追加で進める
- P1 以降で source ごとの取得方式と要確認フラグを管理画面に持つ

### 初期投入方針

- 初期投入する重要ソースは、**公式 RSS / Atom / API がある範囲に限定してよい**
- 理由:
  - 規約面の不確実性を減らせる
  - 取得方式を標準化しやすい
  - 例外処理や保守コストを抑えられる
  - P0 の目的である「安定運用開始」に合う

## 未確定仕様の扱い（2026-03-10）

- 未確定事項は `docs/imp/implementation-wait.md` に集約する。
- `implementation-plan.md` では、未確定事項のうち「暫定仕様で前進するもの」と「判断確定後に着手するもの」を実装手順に反映する。

---

## DBスキーマ（確定版）

### 拡張機能

```sql
CREATE EXTENSION IF NOT EXISTS vector;    -- Topic Group類似度計算
```

### feeds — RSSフィード管理

```sql
CREATE TABLE feeds (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  url              text        NOT NULL UNIQUE,
  genre            text        NOT NULL,        -- 'llm'|'agent'|'coding'|...
  source_type      text        NOT NULL,        -- 'youtube'|'blog'|'official'|'news'
  active           boolean     DEFAULT true,
  fetch_interval_m int         DEFAULT 60,
  last_fetched_at  timestamptz,
  error_count      int         DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);
```

### source_items — RSS生データ（月次パーティション）

```sql
CREATE TABLE source_items (
  id                 uuid        DEFAULT gen_random_uuid(),
  feed_id            uuid        REFERENCES feeds(id),
  url                text        NOT NULL,
  url_hash           text        NOT NULL,      -- SHA-256(正規化URL)
  title              text,
  published_at       timestamptz,
  raw_content        text,                      -- 本文キャッシュ（7日）
  content_expires_at timestamptz,
  processed          boolean     DEFAULT false,
  fetched_at         timestamptz DEFAULT now()
) PARTITION BY RANGE (fetched_at);

-- 月次パーティション（Cronで月初に自動作成）
CREATE TABLE source_items_2026_03
  PARTITION OF source_items
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE UNIQUE INDEX si_url_hash_month ON source_items (url_hash, fetched_at);
CREATE INDEX        si_unprocessed    ON source_items (fetched_at) WHERE processed = false;
```

### articles — 正規記事（中核テーブル）

```sql
CREATE TABLE articles (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  url             text        NOT NULL UNIQUE,
  url_hash        text        GENERATED ALWAYS AS (
                    encode(sha256(url::bytea), 'hex')) STORED,
  title           text        NOT NULL,
  genre           text        NOT NULL,
  source_type     text        NOT NULL,
  thumbnail_url   text,
  published_at    timestamptz NOT NULL,
  summary_100     text,
  summary_200     text,
  summary_300     text,
  critique        text,
  ai_model        text,                         -- 'gemini-flash'|'template'
  topic_group_id  uuid        REFERENCES topic_groups(id),
  embedding       vector(768),                  -- pgvector（Topic Group用）
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX articles_genre_published   ON articles (genre, published_at DESC);
CREATE INDEX articles_topic_group       ON articles (topic_group_id)
  WHERE topic_group_id IS NOT NULL;
CREATE INDEX articles_url_hash          ON articles (url_hash);
CREATE INDEX articles_published_at      ON articles (published_at DESC);
CREATE INDEX articles_embedding_ivfflat ON articles
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### topic_groups — トピッククラスタ

```sql
CREATE TABLE topic_groups (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  genre         text        NOT NULL,
  label         text        NOT NULL,
  article_count int         DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
```

### rank_scores — 事前計算ランキング（30分更新）

```sql
CREATE TABLE rank_scores (
  article_id   uuid    REFERENCES articles(id) ON DELETE CASCADE,
  period       text    NOT NULL,   -- '24h'|'7d'|'30d'
  genre        text    NOT NULL,   -- 'all'|'llm'|'agent'|...
  score        numeric NOT NULL,
  breakdown    jsonb,              -- {share,save,view,expand} 管理画面用のみ
  computed_at  timestamptz DEFAULT now(),
  PRIMARY KEY (article_id, period, genre)
);

CREATE INDEX rank_scores_lookup      ON rank_scores (period, genre, score DESC);
CREATE INDEX rank_scores_computed_at ON rank_scores (computed_at);
```

**スコア計算式:**
```
score =
  share_count    × 5.0   -- SNS拡散（最重要）
  + save_count   × 4.0   -- 保存（高意図）
  + expand_300   × 3.0   -- 深読み
  + article_open × 2.0   -- 外部遷移
  + expand_200   × 1.5
  + critique_exp × 1.0
  + view_count   × 0.1   -- 表示は弱め
  × exp(-0.1 * hours_since_published)   -- 時間減衰
```

### action_logs — 行動ログ（週次パーティション）

```sql
CREATE TABLE action_logs (
  id          bigserial,
  article_id  uuid        REFERENCES articles(id),  -- NULLable（search等）
  action_type text        NOT NULL,
  session_id  text        NOT NULL,
  user_id     text,                                  -- Firebase UID（任意）
  platform    text,                                  -- 'pc'|'sp'|'tb'
  source      text,                                  -- 'direct'|'digest'|'search'|'topic_group'
  meta        jsonb,
  created_at  timestamptz DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE TABLE action_logs_2026_w10
  PARTITION OF action_logs
  FOR VALUES FROM ('2026-03-02') TO ('2026-03-09');

CREATE INDEX al_article_action ON action_logs (article_id, action_type, created_at);
CREATE INDEX al_session        ON action_logs (session_id, created_at);
```

**action_type 定義（15種類）:**

| action_type | 説明 | meta |
|---|---|---|
| `view` | カードがビューポートに入った | `{duration_ms}` |
| `expand_200` | 200字展開 | — |
| `expand_300` | 300字展開 | — |
| `article_open` | 外部記事を開く | — |
| `return_focus` | 記事から戻りフォーカス | — |
| `share_open` | シェアポップアップを開く | — |
| `share_copy` | URLコピー | — |
| `share_x` | X(Twitter)投稿 | — |
| `share_threads` | Threads投稿 | — |
| `share_slack` | Slack投稿 | — |
| `share_misskey` | Misskey投稿 | `{instance}` |
| `save` | 保存 | — |
| `unsave` | 保存解除 | — |
| `topic_group_open` | Topic Group遷移 | `{topic_group_id}` |
| `critique_expand` | 批評展開 | — |
| `search` | 検索実行 | `{query, result_count}` |
| `digest_click` | ダイジェスト通知クリック | `{scheduled_at}` |

### push_subscriptions / digest_logs

```sql
CREATE TABLE push_subscriptions (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text,
  session_id  text    NOT NULL,
  endpoint    text    NOT NULL UNIQUE,
  keys        jsonb   NOT NULL,   -- {auth, p256dh}
  genres      text[]  DEFAULT '{}',
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE digest_logs (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid    REFERENCES push_subscriptions(id),
  scheduled_at    timestamptz NOT NULL,
  sent_at         timestamptz,
  status          text    DEFAULT 'pending',  -- 'pending'|'sent'|'failed'
  article_ids     uuid[],
  error_msg       text,
  retry_count     int     DEFAULT 0
);

CREATE INDEX digest_logs_retry
  ON digest_logs (status, scheduled_at) WHERE status != 'sent';
```

---

## RLS ポリシー

```sql
-- 記事・ランキングは全員読み取り可
ALTER TABLE articles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_scores  ENABLE ROW LEVEL SECURITY;
CREATE POLICY articles_read    ON articles    FOR SELECT USING (true);
CREATE POLICY rank_scores_read ON rank_scores FOR SELECT USING (true);

-- 書き込みはサービスロールのみ（RLSバイパス）
-- push_subscriptionsは自分のセッションのみ
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ps_own ON push_subscriptions
  FOR ALL USING (session_id = current_setting('app.session_id', true));
```

---

## 実装フェーズ（推奨順）

### Phase 1: 基盤
- [x] Next.js 15 App Router + TypeScript 初期構成
- [x] Neon接続（`@neondatabase/serverless` シングルトン）
- [ ] Firebase Auth（Admin SDK + クライアントSDK）
- [x] マイグレーション基盤（`/migrations/*.sql` 管理）
- [ ] 型生成フロー（DB型 → TypeScript型）

### Phase 2: データモデル
- [x] 拡張機能 + 全テーブル + インデックス作成
- [ ] パーティション自動作成 Cron（月初/週初）
- [x] RLSポリシー適用
- [ ] EXPLAIN ANALYZEで主要クエリ検証

### Phase 3: 収集・解析パイプライン
- [ ] RSS収集ジョブ（`/api/cron/ingest-feeds`）
- [ ] URL正規化 + url_hash重複排除
- [ ] 本文抽出器（cheerio + 抽象化レイヤー）
- [ ] AI要約サービス（Gemini Flash → テンプレートフォールバック）
- [ ] 100字バリデーション + 禁止語チェック
- [ ] embedding生成 → pgvector格納
- [ ] Topic Groupバッチ（IVFFlat近傍 → 閾値0.8クラスタリング）

### Phase 4: 公開API・UI
- [x] `GET /api/trends?period=24h&genre=all`
- [x] `GET /api/search?q=...`
- [x] 一覧ページの暫定 live 化（PC優先）
- [x] 検索 UI の submit 接続
- [ ] 行動ログ送信
- [x] 保存のローカル状態管理（ブラウザ依存）
- [x] Topic Group の暫定導線
- [ ] SP UI
- [ ] TB UI
- [x] rank_scoresバッチ（`/api/cron/compute-ranks`、30分おき）

### Phase 5: シェア・OGP
- [ ] `@vercel/og` 画像API（1テンプレ + ジャンル色分岐）
- [ ] metadata設定（Open Graph + Twitter Card）
- [ ] OGPキャッシュ（ISR）
- [ ] 共有文面テンプレート生成

### Phase 6: 通知
- [ ] Web Push購読導線
- [ ] 07:00 / 12:00 / 18:00 ダイジェスト配信Cron
- [ ] digest_logs + 失敗再送（retry_count ≤ 3）

### Phase 7: パーソナライズ
- [ ] 匿名設定ローカル保存
- [ ] Firebaseログイン後のサーバープロファイル同期
- [ ] 匿名↔ログイン設定マージ処理

---

## 完了条件（DoD）

1. 新着反映 15分以内（95%ile）
2. 100字要約違反率 1% 未満
3. Topic Group 同ジャンル内グループ遷移可能
4. X / Slack でOGP意図通り表示
5. 通知配信成功率 98% 以上
6. 重大障害なしで7日連続運用

---

## P1以降（スコープ外）

- ジャンル横断Topic Group統合
- メール通知
- 通知時刻ユーザーカスタマイズ
- スコア内訳のユーザー向け公開
- 管理画面（フィード管理 / 要約監査キュー / 行動ログダッシュボード）
- SP / TB デバイス別UI最適化

