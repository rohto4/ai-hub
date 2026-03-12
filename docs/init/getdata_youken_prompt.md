# AI実装依頼プロンプト v1.1（Codex / Claude Code用）

## あなたの役割

あなたは世界トップレベルのNode.jsエンジニアです。
以下の仕様に基づき、**動作するコードをすべてファイルとして生成**してください。
説明だけでなく、必ずコードを書いてください。

---

## システム概要

AI技術情報を複数ソースから自動収集し、Gemini APIで処理してNeon DBに蓄積する
**定期バッチシステム**をNode.js（ESModules）で構築してください。
n8nは使用しません。Windowsのタスクスケジューラで定期実行します。

---

## 技術スタック

- Runtime: Node.js 20以上（ESModules、`"type": "module"`）
- DB: Neon DB（PostgreSQL互換）`@neondatabase/serverless`
- AI: Gemini Flash-Lite `@google/generative-ai`
- RSS解析: `rss-parser`
- HTTP: `axios`
- 環境変数: `dotenv`

---

## フォルダ構成（この通りに作成すること）

```
ai-news-batch/
├── src/
│   ├── fetchers/
│   │   ├── hackerNews.js
│   │   ├── arxiv.js
│   │   ├── qiita.js
│   │   ├── zenn.js
│   │   ├── github.js
│   │   ├── huggingface.js
│   │   ├── paperswithcode.js
│   │   ├── reddit.js
│   │   └── rssGeneric.js       # TechCrunch/ITmedia等の汎用RSS
│   ├── processors/
│   │   ├── gemini.js           # Gemini API呼び出し
│   │   ├── ruleBranch.js       # Full/Snippet判定
│   │   └── jinaReader.js       # Jina Reader本文取得
│   ├── db/
│   │   ├── client.js           # Neon DB接続
│   │   ├── articlesRaw.js      # articles_rawテーブルCRUD
│   │   ├── articles.js         # articlesテーブルCRUD（サイト表示用）
│   │   └── tagsMaster.js       # tags_masterテーブルCRUD
│   └── batch/
│       ├── hourly.js           # 毎時実行: フェッチ→raw投入
│       ├── daily.js            # 日次実行: raw処理→articles昇格
│       └── weekly.js           # 週次実行: rawアーカイブ＋タグ整理
├── sql/
│   └── schema.sql              # DDL（全テーブル）
├── .env.example
├── package.json
└── README.md
```

---

## ★ DB設計（最重要・厳守すること）

### テーブル構成と役割

テーブルは4つ。役割が明確に分離されており、**ウェブサイトは`articles`テーブルだけを参照する**。
他のテーブルはウェブサイトから一切参照しない。

```
articles_raw          ← フェッチャーが生データを投入するステージング
articles_raw_history  ← rawの1ヶ月超データを週次で移動するアーカイブ
articles              ← ★ウェブサイトが直接参照する唯一のテーブル
tags_master           ← タグの正規化・集計管理
```

### sql/schema.sql（この内容で生成すること）

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- ステージングテーブル（フェッチャーの投入先）
CREATE TABLE IF NOT EXISTS articles_raw (
  id              BIGSERIAL PRIMARY KEY,
  title           TEXT,
  url             TEXT NOT NULL,
  url_normalized  TEXT,
  snippet         TEXT,
  content         TEXT,
  source_name     TEXT,
  source_category TEXT,
  source_meta     JSONB DEFAULT '{}',
  is_processed    BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_url       ON articles_raw(url_normalized);
CREATE INDEX        IF NOT EXISTS idx_raw_processed ON articles_raw(is_processed);
CREATE INDEX        IF NOT EXISTS idx_raw_created   ON articles_raw(created_at DESC);

-- アーカイブテーブル（rawから週次で移動・参照はほぼしない）
CREATE TABLE IF NOT EXISTS articles_raw_history (
  LIKE articles_raw INCLUDING ALL
);

-- ★サイト表示用テーブル（ウェブサイトが唯一参照するテーブル）
-- このテーブルへの書き込みは日次バッチのみが行う
-- ウェブサイトはSELECTのみ
CREATE TABLE IF NOT EXISTS articles (
  id              BIGSERIAL PRIMARY KEY,
  raw_id          BIGINT REFERENCES articles_raw(id),
  title           TEXT NOT NULL,
  url             TEXT UNIQUE NOT NULL,
  summary         TEXT,
  tags            JSONB DEFAULT '[]',
  score           FLOAT DEFAULT 0.0,
  is_published    BOOLEAN DEFAULT false,
  is_full_text    BOOLEAN DEFAULT false,
  source_name     TEXT,
  source_category TEXT,
  source_meta     JSONB DEFAULT '{}',
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(is_published);
CREATE INDEX IF NOT EXISTS idx_articles_category  ON articles(source_category);
CREATE INDEX IF NOT EXISTS idx_articles_score     ON articles(score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_created   ON articles(created_at DESC);

-- タグ管理テーブル
CREATE TABLE IF NOT EXISTS tags_master (
  tag_name         TEXT PRIMARY KEY,
  confidence_score FLOAT DEFAULT 1.0,
  article_count    INTEGER DEFAULT 1,
  last_seen        TIMESTAMPTZ DEFAULT NOW()
);
```

### source_category の値定義

| 値 | 説明 | 対応ソース例 |
|---|---|---|
| `news` | 国内ニュース | ITmedia, Gigazine |
| `community` | エンジニア界隈 | HackerNews, Qiita, Zenn, Reddit |
| `paper` | 論文・研究 | Arxiv, HuggingFace, Papers with Code |
| `overseas` | 海外メディア | TechCrunch, Ars Technica, MIT TR |
| `oss` | OSSリポジトリ | GitHub Trending |

---

## 各フェッチャーの仕様

### 共通仕様（全フェッチャーで必ず守ること）

戻り値は以下の型の配列で統一すること。

```js
{
  title: string,
  url: string,
  snippet: string,        // スニペット or Abstract
  published_at: string,   // ISO8601
  source_name: string,
  source_category: string,
  source_meta: object
}
```

- 必ずtry-catchを入れ、エラーはconsole.errorでログ出力して空配列を返す
- APIキーは必ず環境変数から取得する（直書き禁止）
- リクエスト間隔は最低1秒のsleepを入れる

---

### hackerNews.js

- エンドポイント: `https://hacker-news.firebaseio.com/v0/topstories.json`
- 上位30件のIDを取得し、各アイテムを`/v0/item/{id}.json`で取得
- `source_category: 'community'`
- `source_meta`: `{ hn_score: number, comments: number, author: string }`

### arxiv.js

- エンドポイント: `http://export.arxiv.org/api/query`
- 検索クエリ: `cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL`
- 最新20件を取得
- `source_category: 'paper'`
- `source_meta`: `{ authors: string[], doi: string, arxiv_id: string, pdf_url: string }`
- titleは英語のまま保持し、summaryカラムにGeminiで日本語訳を入れる

### qiita.js

- エンドポイント: `https://qiita.com/api/v2/items?query=AI+OR+機械学習&per_page=20`
- Authorization: `Bearer ${process.env.QIITA_TOKEN}`
- `source_category: 'community'`
- `source_meta`: `{ likes: number, author: string, tags: string[] }`

### zenn.js

- RSS URL: `https://zenn.dev/topics/ai/feed`
- `rss-parser`で取得
- `source_category: 'community'`

### github.js

- GitHub REST API: `https://api.github.com/search/repositories`
- クエリ: `topic:ai topic:llm sort:stars-asc&per_page=20`
- Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
- `source_category: 'oss'`
- `source_meta`: `{ stars: number, language: string, topics: string[], repo_url: string }`

### huggingface.js

- RSS URL: `https://huggingface.co/blog/feed.xml`
- `rss-parser`で取得
- `source_category: 'paper'`

### paperswithcode.js

- エンドポイント: `https://paperswithcode.com/api/v1/papers/?ordering=-published`
- 最新20件取得
- `source_category: 'paper'`
- `source_meta`: `{ github_url: string, task: string }`

### reddit.js

- RSS URL: `https://www.reddit.com/r/MachineLearning/.rss`
- `rss-parser`で取得（認証不要）
- `source_category: 'community'`

### rssGeneric.js

```js
const RSS_SOURCES = [
  { url: 'https://techcrunch.com/feed/',                       name: 'techcrunch',  category: 'overseas' },
  { url: 'https://feeds.arstechnica.com/arstechnica/index',    name: 'arstechnica', category: 'overseas' },
  { url: 'https://www.technologyreview.com/feed/',             name: 'mittr',       category: 'overseas' },
  { url: 'https://venturebeat.com/feed/',                      name: 'venturebeat', category: 'overseas' },
  { url: 'https://rss.itmedia.co.jp/rss/2.0/itmedia_all.xml', name: 'itmedia',     category: 'news'     },
  { url: 'https://gigazine.net/news/rss_2.0/',                 name: 'gigazine',    category: 'news'     },
];
```

---

## processors/jinaReader.js の仕様

- エンドポイント: `https://r.jina.ai/{URL}`
- タイムアウト: 10秒
- エラー時は `{ statusCode: 0, content: '' }` を返す

---

## processors/ruleBranch.js の仕様

Jina Readerのレスポンスを受け取り `full` or `snippet` を判定する。

```
判定条件（いずれか1つでもtrueならsnippet）:
1. HTTPステータスが200以外
2. 本文のMarkdown文字数が800文字未満
3. 本文に以下の文字列を含む（大文字小文字無視）:
   "access denied", "paywall", "login required", "subscribe to", "paywalled", "会員限定", "有料記事"
```

戻り値: `{ path: 'full' | 'snippet', content: string, content_length: number }`

---

## processors/gemini.js の仕様

モデル: `gemini-2.0-flash-lite`
必ずJSON.parseのtry-catchを入れ、失敗時はデフォルト値を返す。

### Full Content用（summarize関数）

```
システムプロンプト:
You are an AI tech analyst. Respond ONLY in valid JSON, no markdown fences, no explanation.
Output schema:
{
  "summary": "string (日本語, max 300文字)",
  "tags": ["string"],
  "score": float,
  "score_reason": "string (日本語, max 100文字)"
}
tags: max 8個, lowercase-hyphenated英語
score基準: novelty 40% + technical_depth 30% + industry_impact 30%
```

### Snippet用（tagMatch関数）

```
システムプロンプト:
You are a tag classifier. Match ONLY tags from the master list below.
Respond ONLY in valid JSON, no markdown fences.
Output schema: { "tags": ["string"] }
If no tags match, return: { "tags": [] }
```

---

## バッチ処理フロー

### batch/hourly.js（毎時実行）

```
1. 全フェッチャーを並列実行（Promise.allSettled）
2. 結果をフラットな配列に統合
3. URL正規化・重複排除（url_normalizedで判定）
4. articles_rawにすでにあるURLをSKIP
5. articles_rawに生データを一括INSERT（is_processed=false）
```

※ hourlyはarticles_rawへの投入だけを責務とする。Gemini処理はしない。

### batch/daily.js（日次実行）

```
1. articles_rawからis_processed=falseの記事を全件取得
2. 各記事にJina Reader → ruleBranch判定
3. snippet → Gemini tagMatch → articles_rawのis_processed=trueに更新
                             → articlesにis_published=falseで INSERT
4. full    → Gemini summarize → score > 0.8 なら articlesにis_published=trueでINSERT
                              → score ≤ 0.8 なら articlesにis_published=falseでINSERT
5. tags_masterを更新
6. articlesのis_published=falseの記事を再評価（score > 0.7になったものをtrueに更新）
```

※ articlesへの書き込みはこのバッチのみが行う。

### batch/weekly.js（週次実行）

```
1. articles_rawの1ヶ月超のデータをarticles_raw_historyへ移動
   INSERT INTO articles_raw_history SELECT * FROM articles_raw WHERE created_at < NOW() - INTERVAL '1 month';
   DELETE FROM articles_raw WHERE created_at < NOW() - INTERVAL '1 month';
2. tags_masterのarticle_count=0のタグを削除
```

---

## エラーハンドリング方針

- 全ての非同期処理にtry-catchを入れる
- 個別記事のエラーはconsole.errorでログを出してSKIPする（全体を止めない）
- DB接続エラーのみプロセスを終了させる
- 各バッチの開始・終了・処理件数をconsole.logで出力する

---

## package.json に含めるべきdependencies

```json
{
  "type": "module",
  "dependencies": {
    "@neondatabase/serverless": "latest",
    "@google/generative-ai": "latest",
    "rss-parser": "latest",
    "axios": "latest",
    "dotenv": "latest"
  }
}
```

---

## .env.example（この内容で生成すること）

```env
NEON_DATABASE_URL=
GEMINI_API_KEY=
GITHUB_TOKEN=
QIITA_TOKEN=
```

---

## 生成物チェックリスト

- [ ] 全ファイルがESModules（import/export）で書かれている
- [ ] APIキーの直書きが0件である
- [ ] 全ての非同期関数にtry-catchがある
- [ ] フェッチャーの戻り値の型が統一されている
- [ ] hourlyはarticles_rawへの投入のみ・Gemini呼び出しをしていない
- [ ] dailyのみがarticlesテーブルへ書き込んでいる
- [ ] weeklyのアーカイブ処理がトランザクションで囲まれている
- [ ] sql/schema.sql が単独で実行可能なDDLになっている
- [ ] .env.example に必要な変数が全て列挙されている
- [ ] README.md にセットアップ手順が書かれている
- [ ] `node src/batch/hourly.js` で実行できる状態になっている