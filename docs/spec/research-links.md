# Research Links（見た目 + 情報収集重視版）

最終更新: 2026-03-05

## 1. 競合/隣接競合（情報収集・要約・ランキング）

## 1.1 まとめ/キュレーション系

1. Feedly（AI要約・収集運用）
   - https://feedly.com/
2. Feedly AI Summarization
   - https://feedly.com/new-features/posts/feedly-ai-and-summarization
3. Techmeme（テックニュース集約）
   - https://www.techmeme.com/
4. Hacker News（コミュニティ投票型）
   - https://news.ycombinator.com/
5. Product Hunt（ランキング体験）
   - https://www.producthunt.com/
6. Hugging Face Papers Trending
   - https://huggingface.co/papers/trending
7. Google News Full Coverage（同一トピック束ね）
   - https://blog.google/products/news/google-news-full-coverage/
8. TLDR Newsletter（短時間 digest）
   - https://tldr.tech/
9. The Rundown AI（AIニュース digest）
   - https://www.therundown.ai/
10. Ben's Bites（AIニュースまとめ）
   - https://www.bensbites.com/

## 1.2 日本語圏での参考（情報編集・一覧体験）

1. SmartNews（カード型ニュース体験）
   - https://www.smartnews.com/
2. NewsPicks（解説/コメント付きニュース）
   - https://newspicks.com/
3. はてなブックマーク（話題抽出）
   - https://b.hatena.ne.jp/
4. Yahoo!ニュース（速報性と一覧性）
   - https://news.yahoo.co.jp/

## 2. 見た目・UI参考（高評価サイト/ギャラリー）

## 2.1 デザインギャラリー

1. Awwwards
   - https://www.awwwards.com/
2. Lapa Ninja
   - https://www.lapa.ninja/
3. Land-book
   - https://land-book.com/
4. godly.website
   - https://godly.website/
5. Mobbin（UIパターン）
   - https://mobbin.com/

## 2.2 実サイト参考（情報密度 + ブランド体験）

1. Linear
   - https://linear.app/
2. Notion
   - https://www.notion.so/
3. Stripe
   - https://stripe.com/
4. Vercel
   - https://vercel.com/
5. Raycast
   - https://www.raycast.com/
6. Perplexity
   - https://www.perplexity.ai/
7. Anthropic
   - https://www.anthropic.com/
8. OpenAI
   - https://openai.com/

## 3. 情報収集実装の参考

1. Google Alerts（運用情報）
   - https://www.google.com/alerts
2. Google Alerts RSS の運用手順（実務記事）
   - https://feeder.co/help/rss/add-google-alerts-to-feeder/
3. Zapier: Google Alerts workflow
   - https://zapier.com/blog/track-google-alerts-in-any-app/
4. arXiv API
   - https://info.arxiv.org/help/api/index.html
5. YouTube Data API
   - https://developers.google.com/youtube/v3
6. RSSHub（補助取得の選択肢）
   - https://docs.rsshub.app/

## 4. 共有/通知/PWAの公式仕様

1. Open Graph Protocol
   - https://ogp.me/
2. X Card Markup
   - https://developer.x.com/en/docs/x-for-websites/cards/overview/markup
3. Vercel OG
   - https://vercel.com/docs/functions/og-image-generation
4. Next.js Metadata & OG
   - https://nextjs.org/docs/app/getting-started/metadata-and-og-images
5. MDN Web Push API
   - https://developer.mozilla.org/en-US/docs/Web/API/Push_API
6. Web.dev PWA install criteria
   - https://web.dev/articles/install-criteria

## 5. データ基盤/分析の公式仕様

1. Supabase RLS
   - https://supabase.com/docs/guides/database/postgres/row-level-security
2. Supabase Realtime
   - https://supabase.com/docs/guides/realtime
3. Supabase Cron
   - https://supabase.com/docs/guides/cron
4. Postgres JSONB
   - https://www.postgresql.org/docs/current/datatype-json.html

## 6. 本プロジェクトへの取り込み方針

1. 収集体験:
   - Feedly/Techmeme 型の「広く集めて後段で絞る」方式を採用
2. UI体験:
   - Linear/Notion 系の情報密度と可読性を参考
3. 共有体験:
   - OGP をプロダクト機能として前面化
4. 改善運用:
   - 行動ログを日次集計し、要約/導線を継続改善

## 7. 見た目の模倣要素マップ（今回モックへ反映）

1. Stripe / Vercel 系:
   - 柔らかいグラデーション背景 + セクション境界の明確化
   - 反映先: `mode-focus-feed.html`
2. Linear / Raycast 系:
   - 情報密度が高いが視線誘導が明確なオペレーションUI
   - 反映先: `mode-command-board.html`
3. Notion / NewsPicks / 紙面系:
   - タイポグラフィ主導の落ち着いた編集体験
   - 反映先: `mode-workspace-table.html`
4. Product Hunt / Hacker News:
   - ランク・トピックの即比較可能な構造
   - 反映先: 全パターン共通
5. Feedly:
   - 収集源を広く取り、後段でフィルタする思想
   - 反映先: 仕様（`05-ingestion-and-ai-pipeline.md`）

## 8. 今回の「模倣レベル」実装対応

1. `mode-command-board.html`
   - 模倣要素: 左固定ナビ、コマンド検索、密度高いカード一覧、暗色トーン
2. `mode-focus-feed.html`
   - 模倣要素: 小タイトル中心、柔らかいグラデーション、主導線をフィードに集中
3. `mode-workspace-table.html`
   - 模倣要素: ワークスペース型レイアウト、データベース風テーブル、余白重視のミニマル構成
4. `mode-card-grid-fixed.html`
   - 模倣要素: 固定カードグリッド + ユーティリティバーによる探索補助
