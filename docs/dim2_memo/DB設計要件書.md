# DB設計要件書 - AI情報集積システム

## 前提

- DB: Neon DB（PostgreSQL互換 / pgvector対応）
- ORM不使用・生SQLで実装
- `articles` テーブル**だけ**がウェブサイトから直接参照される

---

## テーブル一覧

### 1. articles_raw（ステージング）

フェッチャーが収集した生データを投入するテーブル。
NULLや重複を許容し、Gemini処理前の状態も保持する。
直近1ヶ月分のみ保持し、それ以降は`articles_raw_history`へ週次で移動する。

```sql
CREATE TABLE IF NOT EXISTS articles_raw (
  id              BIGSERIAL PRIMARY KEY,
  title           TEXT,
  url             TEXT NOT NULL,
  url_normalized  TEXT,
  snippet         TEXT,
  content         TEXT,
  source_name     TEXT,        -- 'hackernews' | 'arxiv' | 'qiita' など
  source_category TEXT,        -- 'news' | 'community' | 'paper' | 'overseas' | 'oss'
  source_meta     JSONB DEFAULT '{}',
  is_processed    BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_processed ON articles_raw(is_processed);
CREATE INDEX IF NOT EXISTS idx_raw_created   ON articles_raw(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_url ON articles_raw(url_normalized);
```

### 2. articles_raw_history（アーカイブ）

`articles_raw`から週次バッチで移動してくる1ヶ月超の古いデータ。
サイトもバッチも基本的に参照しない。調査・監査用。

```sql
CREATE TABLE IF NOT EXISTS articles_raw_history (
  LIKE articles_raw INCLUDING ALL
);
```

### 3. articles（サイト表示用 ★本番テーブル）

**ウェブサイトが直接参照する唯一のテーブル。**
Gemini処理・スコア判定を通過し、is_published=trueになったデータのみが入る。
常にクリーンで完結したデータだけを保持する。

```sql
CREATE TABLE IF NOT EXISTS articles (
  id              BIGSERIAL PRIMARY KEY,
  raw_id          BIGINT REFERENCES articles_raw(id),
  title           TEXT NOT NULL,
  url             TEXT UNIQUE NOT NULL,
  summary         TEXT,         -- Geminiが生成した日本語要約
  tags            JSONB DEFAULT '[]',
  score           FLOAT DEFAULT 0.0,
  is_published    BOOLEAN DEFAULT false,
  is_full_text    BOOLEAN DEFAULT false,
  source_name     TEXT,
  source_category TEXT,
  source_meta     JSONB DEFAULT '{}',
  published_at    TIMESTAMPTZ,  -- 元記事の公開日時
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(is_published);
CREATE INDEX IF NOT EXISTS idx_articles_category  ON articles(source_category);
CREATE INDEX IF NOT EXISTS idx_articles_score     ON articles(score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_created   ON articles(created_at DESC);
```

### 4. tags_master（タグ管理）

Geminiが生成したタグを正規化・集計するテーブル。
週次バッチでarticle_count=0のタグを削除する。

```sql
CREATE TABLE IF NOT EXISTS tags_master (
  tag_name         TEXT PRIMARY KEY,
  confidence_score FLOAT DEFAULT 1.0,
  article_count    INTEGER DEFAULT 1,
  last_seen        TIMESTAMPTZ DEFAULT NOW()
);
```

---

## データライフサイクル

```
[フェッチャー 毎時]
    ↓ 生データ投入
articles_raw
    ↓ 日次バッチ（Gemini処理・スコア判定）
    ↓ score > 0.8 のみ
articles  ←←← ウェブサイトはここだけ参照
    
articles_raw
    ↓ 週次バッチ（1ヶ月超のデータを移動）
articles_raw_history
```

---

## 週次アーカイブSQL（参考）

```sql
BEGIN;

INSERT INTO articles_raw_history
  SELECT * FROM articles_raw
  WHERE created_at < NOW() - INTERVAL '1 month';

DELETE FROM articles_raw
  WHERE created_at < NOW() - INTERVAL '1 month';

COMMIT;
```

---

## source_category の値定義

| 値 | 説明 | 対応ソース例 |
|---|---|---|
| `news` | 国内ニュース | ITmedia, Gigazine |
| `community` | エンジニア界隈 | HackerNews, Qiita, Zenn, Reddit |
| `paper` | 論文・研究 | Arxiv, HuggingFace, Papers with Code |
| `overseas` | 海外メディア | TechCrunch, Ars Technica, MIT TR |
| `oss` | OSSリポジトリ | GitHub Trending |

---

## 実装上の注意

- `articles`テーブルへの書き込みは日次バッチのみが行う
- ウェブサイトは`articles`に対してSELECTのみ
- `articles_raw`はウェブサイトから一切参照しない
- `updated_at`はトリガーで自動更新することを推奨
