# AI Trend Hub 非モック化台帳

最終更新: 2026-03-11
対象:
- [src/app/page.tsx](/G:/devwork/ai-summary/src/app/page.tsx)
- [src/components/layout/Header.tsx](/G:/devwork/ai-summary/src/components/layout/Header.tsx)
- [src/components/toolbar/Toolbar.tsx](/G:/devwork/ai-summary/src/components/toolbar/Toolbar.tsx)
- [src/components/card/ArticleCard.tsx](/G:/devwork/ai-summary/src/components/card/ArticleCard.tsx)
- [src/components/sidebar/RightSidebar.tsx](/G:/devwork/ai-summary/src/components/sidebar/RightSidebar.tsx)
- [docs/mock/mock-requirements-coverage.md](/G:/devwork/ai-summary/docs/mock/mock-requirements-coverage.md)

## 方針
- この台帳は、現状 UI に残っている「可変項目」をセクション単位・項目単位で棚卸しするためのもの。
- 装飾だけの固定要素は原則除外し、将来的に DB / API / local state / config に逃がす可能性があるものだけを載せる。
- 「モックが残っていて気づかない」リスクを減らすため、`取得元` と `非モック化ステータス` を必須で持つ。

## 除外ルール
- 左右の背景ガター、影、罫線、角丸など純粋な装飾値
- レイアウト上の固定余白や固定サイズ
- 画面タイトル `AI Trend Hub` のように現時点で設定値化の必要が低いもの

## セクション台帳

| セクションID | セクション名 | 画面/状態 | 主データ源 | 現在の取得元 | 非モック化優先度 | 状態 | 備考 |
|---|---|---|---|---|---|---|---|
| `HDR001` | ヘッダー検索・チップ | Home 常時表示 | local + API + settings | local/derived | 高 | 一部モック | Enter / ボタン submit へ切替済み |
| `KPI001` | KPI ヒーロー | Home 上部 | derived / analytics | derived | 高 | 一部モック | 取得可能な live 値へ暫定差替済み |
| `FCS001` | Focus バナー | Home 本文先頭 | derived / ops | derived | 中 | 一部モック | API結果とフォールバック状態を表示 |
| `TLB001` | 一覧ツールバー | Home 一覧 | local + config | local/mock | 高 | 一部モック | タブ状態は local、ボタン文言は固定 |
| `MOD001` | 表示モード群 | Home 一覧直下 | local + user prefs | local/mock | 高 | 一部モック | 要約モード、批評表示 |
| `LST001` | 記事カード一覧 | Home 一覧 | `api:/api/trends` | api/mock fallback | 最優先 | 暫定 live化 | API失敗時のみモックへフォールバック |
| `TOP001` | Topic Group セクション | Home セクション[5] | `topic_groups` + `articles` | derived/local | 中 | 暫定実装 | Home 内スクロール固定表示で仮導線化 |
| `SRC001` | 検索結果セクション | Home セクション[6] | `api:/api/search` | api/mock fallback | 高 | 暫定 live化 | submit 型検索へ切替済み |
| `DGT001` | ダイジェストセクション | Home セクション[7] | `digest_logs` + derived | derived | 中 | 暫定実装 | 一覧上位3件から暫定構成 |
| `SDB001` | サイドバーカテゴリ/保存 | Home 右サイド | local + derived | local/derived | 高 | 一部 live化 | 保存件数は local save 反映済み |
| `ACT001` | リアルタイム活動 | Home 右サイド | derived / action_logs | mock | 低 | モックのみ | P0 では固定でも進行可能 |
| `NTF001` | 通知設定 | Home 右サイド | local + `push_subscriptions` | local/mock | 中 | 一部モック | ON/OFF のみ確定済み |
| `SHR001` | 共有モーダル | Home モーダル | article + share template | local/derived | 中 | 暫定 live化 | コピー・タグ切替・Misskey設定を先行実装 |
| `EMP001` | 空状態 | Home 検索空結果 | derived | mock | 中 | モックのみ | 文言は仮でも進められる |

## 項目台帳

| 項目ID | セクションID | 項目名 | 項目に入れる実数値文字列の例 | どこに格納するか | 管理画面での編集可否 | データ型 | 取得元 | 非モック化ステータス | フォールバック値 |
|---|---|---|---|---|---|---|---|---|---|
| `HDR001` | `HDR001` | 検索入力値 | `Gemini` | `local.search.query` | 否 | string | local | switchable | `''` |
| `HDR002` | `HDR001` | 検索プレースホルダ | `タイトル検索: Claude / Gemini / Agent` | `config.ui.header.search_placeholder` | 可 | string | mock/config | mock_only | 既存文言 |
| `HDR003` | `HDR001` | ヘッダーチップ1 | `通知` | `config.ui.header.chips[0]` | 可 | string | mock/config | mock_only | `通知` |
| `HDR004` | `HDR001` | ヘッダーチップ2 | `総合ランキング` | `config.ui.header.chips[1]` | 可 | string | mock/config | mock_only | `総合ランキング` |
| `HDR005` | `HDR001` | ヘッダーチップ3 | `批評: 非表示中` | `derived.ui.header.critique_label` | 否 | string | derived | switchable | `批評: 非表示中` |
| `KPI001` | `KPI001` | KPI1ラベル | `本日の新着` | `config.ui.kpis[0].label` | 可 | string | mock/config | mock_only | `本日の新着` |
| `KPI002` | `KPI001` | KPI1値 | `4` | `derived.kpi.new_articles_today` | 否 | number/string | derived | switchable | `0` |
| `KPI003` | `KPI001` | KPI2ラベル | `表示中記事` | `config.ui.kpis[1].label` | 可 | string | derived/config | switchable | `表示中記事` |
| `KPI004` | `KPI001` | KPI2値 | `4` | `derived.kpi.visible_articles` | 否 | string | derived | switchable | `0` |
| `KPI005` | `KPI001` | KPI3ラベル | `Topic Group 付与` | `config.ui.kpis[2].label` | 可 | string | derived/config | switchable | `Topic Group 付与` |
| `KPI006` | `KPI001` | KPI3値 | `3` | `derived.kpi.topic_group_attached` | 否 | string | derived | switchable | `0` |
| `KPI007` | `KPI001` | KPI4ラベル | `公式ソース` | `config.ui.kpis[3].label` | 可 | string | derived/config | switchable | `公式ソース` |
| `KPI008` | `KPI001` | KPI4値 | `1` | `derived.kpi.official_source_count` | 否 | number/string | derived | switchable | `0` |
| `FCS001` | `FCS001` | Focus見出し | `Focus` | `config.ui.focus.label` | 可 | string | mock/config | mock_only | `Focus` |
| `FCS002` | `FCS001` | Focus本文 | `4 件の実データを表示中です。` | `derived.ui.focus_message` | 否 | string | derived | switchable | `最新状態を表示しています。` |
| `TLB001` | `TLB001` | 並び替えタブ配列 | `ランキング順 / 新着順 / ユニーク順` | `config.ui.toolbar.tabs` | 可 | array | config | mock_only | 既存配列 |
| `TLB002` | `TLB001` | アクティブ並び順 | `ranking` | `local.feed.sort_tab` | 否 | enum | local | switchable | `ranking` |
| `TLB003` | `TLB001` | ランキング期間 | `24h` | `local.feed.period` | 否 | enum | local | switchable | `24h` |
| `TLB004` | `TLB001` | OGP共有ボード文言 | `OGP共有ボード` | `config.ui.toolbar.share_board_label` | 可 | string | config | mock_only | `OGP共有ボード` |
| `MOD001` | `MOD001` | 要約モード100ラベル | `100字` | `config.ui.summary_modes[0]` | 可 | string | config | mock_only | `100字` |
| `MOD002` | `MOD001` | 要約モード200ラベル | `200字` | `config.ui.summary_modes[1]` | 可 | string | config | mock_only | `200字` |
| `MOD003` | `MOD001` | 要約モード300ラベル | `300字` | `config.ui.summary_modes[2]` | 可 | string | config | mock_only | `300字` |
| `MOD004` | `MOD001` | 選択中要約モード | `100` | `local.feed.summary_mode` | 否 | enum | local | switchable | `100` |
| `MOD005` | `MOD001` | 批評表示ラベル | `批評表示` | `config.ui.summary_modes.critique_toggle_label` | 可 | string | config | mock_only | `批評表示` |
| `MOD006` | `MOD001` | 批評表示状態 | `true` | `local.feed.show_critique` | 否 | boolean | local | switchable | `false` |
| `LST001` | `LST001` | 記事一覧配列 | `4件の記事` | `api:/api/trends -> ui.home.cards` | 否 | array | api/mock fallback | switchable | `[]` |
| `LST002` | `LST001` | カードID | `6d6f7c...0001` | `db.articles.id` | 否 | uuid | db | live_ready | none |
| `LST003` | `LST001` | カード順位 | `#1` | `derived.ui.cards.rank` | 否 | number/string | derived | switchable | `-` |
| `LST004` | `LST001` | カードタイトル | `Gemini 2.0 Flash が低コスト化...` | `db.articles.title` | 否 | string | db | live_ready | `タイトル未設定` |
| `LST005` | `LST001` | カードジャンル | `llm` | `db.articles.genre` | 否 | enum | db | live_ready | `unknown` |
| `LST006` | `LST001` | カードソース種別 | `official` | `db.articles.source_type` | 否 | enum | db | live_ready | `news` |
| `LST007` | `LST001` | カードサムネイルURL | `https://.../thumb.png` | `db.articles.thumbnail_url` | 否 | string/null | db | live_ready | `null` |
| `LST008` | `LST001` | カード公開日時 | `2026-03-10T08:00:00+09:00` | `db.articles.published_at` | 否 | date | db | live_ready | `null` |
| `LST009` | `LST001` | 100字要約 | `Google が Gemini 2.0 Flash を刷新...` | `db.articles.summary_100` | 否 | string | db | live_ready | `要約準備中` |
| `LST010` | `LST001` | 200字要約 | `...既存ワークフローへ埋め込みやすい...` | `db.articles.summary_200` | 否 | string | db | live_ready | `summary_100` |
| `LST011` | `LST001` | 300字要約 | `...Flash 級を多点配置する設計が再評価...` | `db.articles.summary_300` | 否 | string | db | live_ready | `summary_200` |
| `LST012` | `LST001` | 批評本文 | `差別化の本丸は性能そのものより...` | `db.articles.critique` | 否 | string | db | live_ready | `null` |
| `LST013` | `LST001` | Topic Group ID | `6d6f7c...0001` | `db.articles.topic_group_id` | 否 | uuid/null | db | live_ready | `null` |
| `LST014` | `LST001` | ランキングスコア | `96.4` | `db.rank_scores.score` | 否 | number/string | db | live_ready | `null` |
| `LST015` | `LST001` | カード詳細ボタン文言 | `詳細` | `config.ui.card.buttons.detail` | 可 | string | config | mock_only | `詳細` |
| `LST016` | `LST001` | Topic Groupボタン文言 | `Topic Group` | `config.ui.card.buttons.topic_group` | 可 | string | config | mock_only | `Topic Group` |
| `LST017` | `LST001` | 共有ボタン文言 | `共有` | `config.ui.card.buttons.share` | 可 | string | config | mock_only | `共有` |
| `LST018` | `LST001` | 保存ボタン文言 | `保存` | `config.ui.card.buttons.save` | 可 | string | config | mock_only | `保存` |
| `LST019` | `LST001` | 批評ボタン文言 | `批評` | `config.ui.card.buttons.critique` | 可 | string | config | mock_only | `批評` |
| `TOP001` | `TOP001` | セクションラベル | `[5] Topic Group` | `config.ui.sections.topic_group.label` | 可 | string | config | mock_only | `[5] Topic Group` |
| `TOP002` | `TOP001` | セクションタイトル | `Gemini 2.0 Flash 関連コンテンツ一覧` | `derived.topic_group.title` | 否 | string | derived | switchable | `Topic Group` |
| `TOP003` | `TOP001` | セクションサブタイトル | `動画・公式・ブログの導線を同一画面で比較` | `config.ui.sections.topic_group.subtitle` | 可 | string | mock/config | mock_only | `関連コンテンツ一覧` |
| `TOP004` | `TOP001` | カラム1タイトル | `動画` | `derived.topic_group.columns[0].label` | 否 | string | mock/derived | mock_only | `動画` |
| `TOP005` | `TOP001` | カラム1件数文言 | `YouTube 解説 3 件` | `derived.topic_group.columns[0].headline` | 否 | string | derived | switchable | `0件` |
| `TOP006` | `TOP001` | カラム2タイトル | `公式` | `derived.topic_group.columns[1].label` | 否 | string | mock/derived | mock_only | `公式` |
| `TOP007` | `TOP001` | カラム2件数文言 | `Google 公式発表 2 件` | `derived.topic_group.columns[1].headline` | 否 | string | derived | switchable | `0件` |
| `TOP008` | `TOP001` | カラム3タイトル | `ブログ` | `derived.topic_group.columns[2].label` | 否 | string | mock/derived | mock_only | `ブログ` |
| `TOP009` | `TOP001` | カラム3件数文言 | `実装比較ブログ 5 件` | `derived.topic_group.columns[2].headline` | 否 | string | derived | switchable | `0件` |
| `TOP010` | `TOP001` | カラム補助文言 | `同一トピックの読み分け導線をここに集約` | `config.ui.sections.topic_group.helper` | 可 | string | config | mock_only | `関連導線` |
| `SRC001` | `SRC001` | セクションラベル | `[6] 検索結果` | `config.ui.sections.search.label` | 可 | string | config | mock_only | `[6] 検索結果` |
| `SRC002` | `SRC001` | セクションタイトル | `検索 / タグ絞り込み` | `config.ui.sections.search.title` | 可 | string | config | mock_only | `検索` |
| `SRC003` | `SRC001` | 検索状態サブタイトル | `現在の検索語: Gemini / 1件` | `derived.search.summary` | 否 | string | local/api | switchable | `現在の検索語: 未入力 / 0件` |
| `SRC004` | `SRC001` | 検索タグ配列 | `LLM, Google, Agent...` | `config.ui.sections.search.tags` | 可 | array | mock/config | mock_only | `[]` |
| `SRC005` | `SRC001` | 検索結果カード | `Gemini 2.0 Flash...` | `api:/api/search -> ui.search.results` | 否 | array | api/mock fallback | switchable | `[]` |
| `DGT001` | `DGT001` | セクションラベル | `[7] ダイジェスト` | `config.ui.sections.digest.label` | 可 | string | config | mock_only | `[7] ダイジェスト` |
| `DGT002` | `DGT001` | ダイジェストタイトル | `07:00 朝の AI ダイジェスト` | `derived.digest.title` | 否 | string | mock/derived | mock_only | `最新ダイジェスト` |
| `DGT003` | `DGT001` | ダイジェスト説明 | `共有向けに整理した上位3件` | `config.ui.sections.digest.subtitle` | 可 | string | mock/config | mock_only | `上位記事` |
| `DGT004` | `DGT001` | ダイジェスト項目配列 | `Gemini 2.0 Flash の価格刷新...` | `derived.digest.items` | 否 | array | derived | switchable | `[]` |
| `DGT005` | `DGT001` | ダイジェスト補助文 | `上位記事を100字要約で再構成...` | `config.ui.sections.digest.item_helper` | 可 | string | mock/config | mock_only | `上位記事を再構成` |
| `SDB001` | `SDB001` | サイドバーカテゴリ配列 | `総合, 動画, 公式, ブログ, Agent` | `config.ui.sidebar.categories` | 可 | array | config | mock_only | 既存配列 |
| `SDB002` | `SDB001` | 選択中カテゴリ | `all` | `local.sidebar.active_category` | 否 | enum | local | switchable | `all` |
| `SDB003` | `SDB001` | 未読件数 | `24` | `derived.sidebar.saved.unread` | 否 | number | derived/local | switchable | `0` |
| `SDB004` | `SDB001` | 高評価件数 | `41` | `derived.sidebar.saved.top_rated` | 否 | number | derived | switchable | `0` |
| `SDB005` | `SDB001` | 後で読む件数 | `64` | `derived.sidebar.saved.read_later` | 否 | number | derived/local | switchable | `0` |
| `ACT001` | `ACT001` | 活動メイン文 | `この1時間で 28 件シェア` | `derived.sidebar.activity.main` | 否 | string | mock/derived | mock_only | `活動データなし` |
| `ACT002` | `ACT001` | 活動補助文 | `+3 件が急上昇` | `derived.sidebar.activity.sub` | 否 | string | mock/derived | mock_only | `変動なし` |
| `NTF001` | `NTF001` | 通知時刻配列 | `07:00 ダイジェスト / true` | `local.notifications.times` | 否 | array | local | switchable | 既存配列 |
| `NTF002` | `NTF001` | 通知セクション名 | `通知設定` | `config.ui.sidebar.notifications_title` | 可 | string | config | mock_only | `通知設定` |
| `SHR001` | `SHR001` | モーダル表示対象記事 | `shareTarget article` | `local.share.target_article` | 否 | object/null | local | switchable | `null` |
| `SHR002` | `SHR001` | モーダルタイトル | `この記事を共有` | `config.ui.share.modal_title` | 可 | string | config | mock_only | `この記事を共有` |
| `SHR003` | `SHR001` | 共有文面テンプレ | `タイトル\n\n要約\n\nURL\n#AIHub` | `derived.share.template` | 否 | string | local/derived | switchable | `''` |
| `SHR004` | `SHR001` | 共有先ボタン配列 | `X, Threads, Slack, Misskey, URLをコピー` | `config.ui.share.targets` | 可 | array | local/config | switchable | 既存配列 |
| `EMP001` | `EMP001` | 空状態アイコン文言 | `NO` | `config.ui.empty.icon_label` | 可 | string | config | mock_only | `NO` |
| `EMP002` | `EMP001` | 空状態タイトル | `該当記事なし` | `config.ui.empty.title` | 可 | string | config | mock_only | `該当記事なし` |
| `EMP003` | `EMP001` | 空状態説明 | `検索語またはカテゴリを変更してください。` | `config.ui.empty.description` | 可 | string | config | mock_only | `条件を変更してください。` |

## 検証メモ
- `mock-requirements-coverage.md` の PC 版表現済み要件 14 件を起点に、Home 画面の可変要素を逆引きした。
- `page.tsx` の Home 本体は `/api/trends` を基準に取得し、失敗時のみモックへフォールバックする構成へ更新済み。
- 検索 UI は `searchDraft` / `searchQuery` の二段 state に変更し、Enter / ボタン submit 型へ切替済み。
- `ArticleCard` / `Header` / `Toolbar` / `RightSidebar` に含まれる文言・配列・派生表示を個別項目へ分解済み。
- 現在の Home 実装に存在しない SP/TB・詳細ページ・PWA セクションは、この台帳の対象外。別モック実装時に追加する。

## 先に着手すべき順
1. `SDB003`〜`SDB005` 保存件数を local save と同期
2. `SHR003` 共有文面テンプレを設定可能に変更
3. `TOP001` Topic Group を暫定導線から本導線へ差替
4. `ACT001` を `action_logs` 由来へ差替
5. SP / TB UI を別台帳へ追加
