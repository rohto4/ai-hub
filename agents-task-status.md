# Agents Task Status

最終更新: 2026-03-20 12:10 JST

運用ルール:
- 新しい行を上に積む
- 1 行 1 タスクで、`日時 | 状態 | 要約 | 結果/次` を短く書く
- 全体はおおむね 40 行前後に保ち、古い行は下から間引く
- ユーザー判断待ちはこのファイルではなく `docs/imp/implementation-wait.md` に残す

現在キュー:
- 2026-03-20 23:46 | done | 機能単位へ追加分割 | `public-articles` を rankings/listings/detail に再分割、Home 状態を shared/data/actions/state に分割、build/type-check OK
- 2026-03-20 23:15 | done | T2-B public-feed 分割 | `public-feed` を 5 ファイル + barrel に分割、build/type-check OK、記事系 384 行は残課題
- 2026-03-20 22:58 | done | Tier1 リファクタリングを先行実施 | `mock4` 削除、`SourceCategory/LaneKey` へ整理、Home 分割、`/feed.xml` へ分離、type-check/build OK
- 2026-03-20 15:05 | done | DB バックアップ基盤を追加 | `pg_dump` 全 DB バックアップを取得し日次 GitHub Actions と 7 日保持を追加、`artifacts/` を削除
- 2026-03-20 12:10 | done | 計画タスクを20件へ拡張 | `content_language`→日本語ソース→公開面調整→管理画面→ランキング調整まで分解
- 2026-03-20 12:00 | done | `implementation-plan.md` / `imp-status.md` 更新 | `content_language` 先行導入と日本語ソース追加前提の 10 タスク分解を反映
- 2026-03-18 10:15 | done | L4 公開ページ群を実装 | ranking/search/detail/category/tags/about/feed を Layer4 読み取りで追加
- 2026-03-18 10:12 | done | mock4 を作成 | Home/Ranking/Search/Detail/Category/Tag/About/Feed/PWA/Share/Topic Group を一通り確認可能
- 2026-03-18 10:08 | done | Home 導線を再整理 | source lane を `official/alerts/blog/paper/news` に統一し topic chips と分離
- 2026-03-18 10:05 | done | `public-feed.ts` 拡張 | tag/detail/feed query と `public_key` 導線を追加
- 2026-03-18 07:30 | done | 絵文字サムネイル backfill | `public_articles 911` 件に `thumbnail_emoji` を反映
- 2026-03-18 07:24 | done | paper タグ制限を DB 反映 | `source_type='paper'` は `paper` タグのみ `437` 件
- 2026-03-18 07:22 | done | migration 031/032 適用 | `thumbnail_emoji` 列と `paper` タグを追加
- 2026-03-18 07:18 | done | snippet 整合強化を実装 | prompt 制約 + 軽い整合チェックを `daily-enrich` に追加
- 2026-03-18 03:12 | done | 公開候補 10 件を抜き取り監査 | title は良好、summary 切れ・snippet ずれ・paper タグ誤付与を確認
- 2026-03-18 03:10 | done | 非日本語 title 一括補正 | `articles_enriched` / `public_articles` とも残件 0
- 2026-03-18 03:08 | done | 翻訳 artifact 保存 | `artifacts/title-translations-non-ja-20260318.json` 出力
- 2026-03-18 03:00 | done | backlog 1882 件の title 漏れ確認 | backlog 分の非日本語 title は 0 件
- 2026-03-18 02:58 | done | `implementation-plan.md` 再構成 | L2->L4 要件定義中心の計画へ更新
- 2026-03-18 02:56 | done | `implementation-wait.md` 更新 | 分類方針、publish 高速化、残 211 title を判断待ちへ整理
- 2026-03-18 02:55 | done | `imp-status.md` 更新 | import・分類再同期・publish 試行結果を追記
- 2026-03-18 02:54 | done | `imp-hangover.md` 更新 | 次セッション向け引き継ぎを追加
- 2026-03-18 02:53 | done | `docs/spec/04-data-model-and-sql.md` 補強 | 表示分類は L4 派生概念と明記
- 2026-03-18 02:52 | done | L2/L4 是正 SQL 保存 | `docs/imp/sql/2026-03-18-l2-l4-data-realign.sql` 作成
- 2026-03-18 02:51 | done | `articles_enriched.source_type` 再同期 | 1866 行修正、不一致 0
- 2026-03-18 02:50 | done | title 補正 13 件反映 | Neon の `articles_enriched.title` を更新
- 2026-03-18 02:49 | done | `public_articles` 分布確認 | published 911、official 736、alerts 145、blog 30
- 2026-03-18 02:48 | done | `hourly-publish` 再試行 | 長時間化のため停止、`job_run_id=93` を failed 化
- 2026-03-18 02:47 | done | publish 途中反映確認 | `public_articles` は 745 -> 911 に増加
- 2026-03-18 02:46 | done | L2/L4 分類整合調査 | source_category は一致、source_type だけドリフトと確定
- 2026-03-18 02:45 | done | Web 実装と DB 軸の差分確認 | UI が `source_type` と `source_category` を混在利用
- 2026-03-18 02:44 | done | `docs/dim2_memo` 再確認 | dim2 は表示分類の参考資料として扱うと整理
- 2026-03-18 02:43 | done | `source_targets` / `public_articles` 分布取得 | Home の空タブ要因を数値で確認
- 2026-03-18 02:42 | done | `tags_master` / `tag_keywords` 実カラム確認 | tags は横断軸として成立、tier 列は未採用
- 2026-03-18 02:41 | done | backlog import 後の title 候補抽出 | 13 件を補正対象として確定
- 2026-03-18 02:40 | done | backlog 1882 件 import 完了確認 | `articles_enriched=1882/1882`, `raw_processed=1882/1882`
- 2026-03-18 02:39 | done | `artifacts/` の Git 追跡解除 | `.gitignore` 追加、index から除外
- 2026-03-18 02:38 | done | importer 軽量化 | tag count を記事単位更新から最後の 1 回へ変更
- 2026-03-18 02:37 | done | manual import 高速化方針検証 | 既存 importer は重く、bulk SQL 併用が有効と確認
- 2026-03-18 02:36 | done | `docs/guide/codex/AGENTS.md` 読込 | docs 更新ルールと UTF-8 読解ルールを再確認
- 2026-03-18 02:35 | done | `l3-l4-screen-flow.md` 読込 | Home / Search / Trends / Actions の接続点を確認
- 2026-03-18 02:34 | done | `implementation-plan.md` 読込 | 旧版が進捗メモ寄りで要更新と判断
- 2026-03-18 02:33 | done | `implementation-wait.md` 読込 | ユーザー不在時はここへ論点を書く前提を確認
- 2026-03-20 23:59 | done | Home action 再分割 | `useHomeActions` を `derived/article/share` に再分割、`useHomeActions.ts 216->104`、build/type-check OK
- 2026-03-21 00:12 | done | Home page shell 分割 | `src/app/page.tsx 222->65`、左カラムを `HomePrimaryColumn` へ抽出、build/type-check OK
- 2026-03-21 00:35 | done | hourly-publish 分割 | `hourly-publish.ts 553->88`、候補取得/source/tag/upsert/hide を `src/lib/publish/` に分離、build/type-check OK
- 2026-03-21 01:12 | done | summarize/enrichment/daily-enrich/topic 分割 | `summarize.ts 129->35`、`enrichment.ts 757->24`、`daily-enrich.ts 800->92`、`/api/home?topic=` 追加、build/type-check OK
