# Agents Task Status

最終更新: 2026-04-03

運用ルール:
- 最新 50 件を目安に残し、古い行は下から削る
- 新しい行を上に積む
- 1 行 1 タスクで、`日時 | 状態 | 要約 | 結果/次` を短く書く
- ユーザー判断待ちはこのファイルではなく `docs/imp/implementation-wait.md` に残す

現在キュー:
- 2026-04-03 | done | `/admin/enrich-queue` に 8 サイクル実行を追加 | `runHourlyLayer12(maxEnrichBatches=8)` を admin API に接続し、即時実行ボタンから押せるようにした
- 2026-04-03 | done | `/admin/enrich-queue` を追加 | backlog/ジョブ状態/推奨フォロー/即時実行を 1 画面化、admin API で refresh と簡易ジョブ実行に対応、type-check 通過
- 2026-04-03 | done | 旧 Gemini enrich artifact の反映状況を照合 | `1500` 出力中 `1489` 件は現 `articles_enriched` に残存、欠落 `11` 件は `articles_enriched_history` に存在すると確認
- 2026-04-03 | done | enrich 行列解消の一時タスク盤を追加 | `db:check-layer12` で backlog=1325 を確認、Gemini CLI/旧artifact を棚卸しし、`docs/imp/enrich-queue-taskboard.md` で実行順と残論点を管理開始
- 2026-04-02 | done | タグ専用フロー節の準備を docs に追加 | `implementation-plan.md` に `flowchart.md` 追加手順を記載、`implementation-wait.md` にユーザー確定事項を分離、`imp-status.md` に反映
- 2026-04-02 | done | 初回読込ガイドから checklist 参照を削除 | `docs/handoff-next-prompt.md` と `docs/memo/memo.txt` の廃止ファイル参照を整理、主タグ/周辺分野タグは分離基盤導入後の公開導線評価フェーズと確認
- 2026-04-02 | done | Mercari Engineering Blog を source 追加 | seed.mjs に id:055 を追加、RSS疎通確認(100件insert)、PROJECT.md/batch-ops.md を更新、db:run-hourly-fetch を package.json に登録
- 2026-04-02 | done | GitHub Actions schedule を全 workflow に追加・復旧 | hourly-fetch/:00, hourly-enrich/8回, hourly-publish/:50, daily-tag-dedup/02:30, daily-db-backup/18:15, monthly-public-archive(新規)/毎月1日
- 2026-04-02 | done | docs 整理・バッチ運用資料を整備 | guide-backup/mock/init/dim2_memo 削除、batch-ops.md 新規、batch-reforme-spec.md を imp/ に移動、refactoring-plan.md 削除、run-hourly-compute-ranks CLI 追加
- 2026-04-02 | done | `docs/imp` / `docs/spec` を現行実装へ追随 | batch 名称・schedule・manual pending・隣接分野タグ・カテゴリ導線・`hourly-compute-ranks` の記述をコード基準へ更新
- 2026-04-02 | done | `docs/imp` と `docs/spec/04-data-model-and-sql.md` を圧縮 | 履歴ノイズと重複説明を削り、`imp` は現況/未決/次、`spec` は現行仕様中心へ再整理
- 2026-04-02 | done | 定時 batch の schedule を docs へ同期 | `data-flow` と `implementation-plan` を schedule 復旧後の前提へ更新
- 2026-04-02 | done | `monthly-public-archive` と ranks CLI を反映 | batch 改善の現況を docs に反映し、batch 系参照先を `batch-reforme-spec` / `batch-ops` へ整理
- 2026-03-31 | done | カスタムカーソル SVG を編集しやすく分離 | `CustomCursorArt.tsx` に紙飛行機 / アンテナ / 頭 / 耳 / 目を分割し、形状編集しやすい構成へ整理
- 2026-03-31 | done | デスクトップ用カスタムカーソルを追加 | 通常カーソルを隠し、発光した「ロボット + 左上紙飛行機」カーソルを追従表示する `CustomCursor` を layout / global CSS に接続
- 2026-03-31 | done | 短長カードの外周余白を統一 | 白エリア外周と footer 下余白の差をなくすため、カード外周マージンを共通 4px に揃え、長文モード全高を 296px に再計算
- 2026-03-31 | done | 短文カードを全高 215px 基準へ再配分 | 白エリア 168px・footer 35px・外余白 4px 系に再配分し、カード全体を短くしつつ内容が収まるよう調整
- 2026-03-31 | done | 短文カードの白エリア高さを再修正 | 100文字モードでもタイトル2行+メタ+要約4行が欠けないよう、上段白エリアの固定高さを 176px に引き上げ
- 2026-03-30 | done | `ui-memo` 14/15/16/19/20 を再調整 | footer 比率、関連トピック左線、LANG 表示削除、shadow/hover、上段白エリア高さを反映
- 2026-03-30 | done | Home の自動更新系を停止 | `return focus` 復元を削除し、PWA/service worker を env opt-in に変更
- 2026-03-28 | done | 導線評価を Web 実装優先へ切替 | 図だけではなく実画面を見ながらカテゴリ・主タグ・周辺分野タグ導線を評価する方針へ更新
- 2026-03-28 | done | 新導線の草案を docs に追加 | `screen-flow` と `flowchart` にカテゴリ / 主タグ / 周辺分野タグの役割分担を追記
- 2026-03-28 | done | Phase 1 正本の新規タグ案を DB 反映 | 新規主タグ 13 件を昇格し、broad tag を inactive 化して L2/L4 を洗い替え
- 2026-03-28 | done | タグ整理の実行方針を更新 | カテゴリはサイドバー導線、周辺分野タグは通常タグ導線、将来の視覚マッピングは後続へ整理
- 2026-03-28 | done | 優先タスクをタグ整理と公開導線へ切替 | SQL 深掘りより公開面導線確立を最優先へ更新
- 2026-03-28 | done | paper 専用タグ群の必要性を方針化 | `paper` / `arxiv-ai` 向け研究系タグ群の検討を後続タスクへ分離
- 2026-03-28 | done | canonicalTagHints prompt を調整して再 live run | `canonicalKeywordCount` の発火を確認し、次は無タグ記事分析へ進む状態に整理
- 2026-03-28 | done | OpenAI fallback を 20→10→5 分割再試行に対応 | manual_pending なしで 20 件 full_content を完了可能にした
- 2026-03-28 | done | enrich live run の実地確認と Neon SQL 修正 | `enrichment-raw.ts` の interval SQL を修正し live run を再開
- 2026-03-28 | done | 本文ベース canonical tag hints を enrich に追加 | alias / keyword 寄せを `tag_aliases` / `tag_keywords` へ高信頼反映
- 2026-03-27 | done | 1 周目 retag 方針を固定 | 完全除外タグ・カテゴリ候補・専用 artifact 方針を `imp-*` に反映
- 2026-03-26 | done | 隣接分野タグ + 背景テーマ基盤を実装 | migration 038、enrich/publish/UI反映、retag と Gemini 支援プロンプトを追加
- 2026-03-26 | done | Gemini enrich backlog artifact を整備 | backlog 用 input / prompt / manifest と part 出力の検証を進めた
- 2026-03-25 | done | 定時 enrich を 20件 x 8回/時 に拡張 | scheduler、route、docs を実運用前提に更新
- 2026-03-25 | done | `arxiv-ai` の監視項目と再判断条件を判断待ちへ追加 | backlog・流入・露出・コストの観測条件を固定
- 2026-03-25 | done | `arxiv-ai` の source 別保持ロジックを実装 | 5 か月超 raw を enrich skip、L4 は 2 か月保持へ更新
- 2026-03-23 | done | hourly-fetch の継続失敗 2 件を切り分けて修正 | google-ai-blog は collector 側で吸収、anthropic-news は inactive 化
- 2026-03-22 | done | thumbnail_url backfill を追加して実 DB へ再反映 | `articles_enriched` と `public_articles` の既存データへ再同期
- 2026-03-22 | done | 旧 `/api/thumb` URL の 400 を解消 | glyph fallback 描画で後方互換を維持
- 2026-03-22 | done | サムネイルを icon-only 合成へ変更 | `/api/thumb` を inline SVG 描画へ切替
- 2026-03-22 | done | タグ昇格時の icon_pending 可視化を追加 | `/admin/tags` に ready/pending を表示
- 2026-03-22 | done | daily-tag-dedup にマージ時の遡及タグ付けを追加 | L2/L4 両方に ILIKE 遡及 INSERT を追加
- 2026-03-22 | done | 日次タグ重複検出ジョブを追加 | Gemini で候補と既存タグを照合し自動統合
- 2026-03-22 | done | タグ候補を固有名詞限定へ絞り込み | 閾値と stopwords を調整してノイズを削減
- 2026-03-22 | done | タグ昇格を AI 固有名詞抽出に切り替え | enrich プロンプトに `properNounTags` を追加
- 2026-03-22 | done | ジョブログ管理画面を追加 | `/admin/jobs` と `compute-ranks` の job_runs 記録を追加
- 2026-03-21 | done | 最終仕上げを実施 | OGP API・sitemap.xml・robots.txt・言語カウントを追加
- 2026-03-21 | done | admin Phase 3 一式を実装 | login/articles/tags/sources/jobs・認証・hide_article・tag 昇格・is_active を追加
- 2026-03-21 | done | `content_language` / 内部サムネイル / 日本語ソース前準備を実装 | migration、`thumbnail_url`、seed を追加
- 2026-03-20 | done | Home と公開面の分割を進めた | Home 分割、`public-feed` 分割、`/feed.xml` 分離を実施
- 2026-03-18 | done | L4 公開ページ群を実装 | ranking/search/detail/category/tags/about/feed を追加
