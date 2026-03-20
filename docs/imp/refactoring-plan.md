# リファクタリング計画

作成日: 2026-03-20
対象フェーズ: 未リリース（今月リリース予定）
方針: リリース前の今が最もコスト低い。優先度別に段階で整理する。

**このプロジェクトのコード品質の基準:**
- コードはエージェント（Claude / Codex / Gemini）が読めれば十分。コメントの日本語化・詳細化は不要。
- ファイルを開いたときのトークン量を減らすことが目標。コメントは「なぜそう書いたか」だけ残す。
- 関数名・型名・変数名で意図が分かるものにはコメント不要。

---

## 0. セッション引き継ぎ手順（Codex / Gemini が新しいセッションで始める場合）

### 0.1 最初に読むファイル（この順番で読む）

1. `docs/guide/codex/AGENTS.md` — 行動規範・docs 更新ルール
2. `docs/guide/COMMON.md` — 共通ルール
3. `docs/guide/PROJECT.md` — 恒久方針
4. **このファイル** (`docs/imp/refactoring-plan.md`) — 計画本体
5. `agents-task-status.md` — 直近の作業記録（何が終わっているか確認）
6. `docs/imp/imp-hangover.md` — 前セッションの残件

### 0.2 作業開始前の確認

1. `agents-task-status.md` の最新行を確認し、どのタスクまで完了しているかを把握する
2. 完了記録欄（本ファイル末尾）で完了済みタスクを確認する
3. 着手するタスクの「依存タスク」が完了しているかを確認する（→ §0.3 参照）
4. `npm run type-check` を実行し、現状がエラーなしであることを確認する

### 0.3 タスク依存関係（実施順序の制約）

```
T1-A（mock4削除）        ─── 依存なし。最初に実施する
T1-B（型整理）           ─── 依存なし。T1-A と並列可
T1-C（Genre改名）        ─── T1-B 完了後に実施する
                              ※ T1-B で ContentLaneKey を整理してから型ファイルを触る
T1-D（page.tsx分割）     ─── T1-C 完了後に実施する
                              ※ T1-C で型名が確定してから分割する（新ファイルの型が混在しない）
T0（コメント整理）       ─── 各ファイル分割と同ターンで実施
T2-A（resolveEmoji）     ─── T1-D 完了後
T2-B（public-feed分割）  ─── T1-D 完了後（Home クエリ型が確定してから）
T2-C（scripts統一）      ─── T2-A / T2-B と並列可
T3-A（enrichment分割）   ─── T2-B 完了後
T3-B（daily-enrich分割） ─── T3-A と並列可
T3-C（topicフィルタ移行）─── T3-A / T3-B 完了後
```

### 0.4 各タスク完了時に必ず行うこと

1. `npm run type-check` を実行してエラーなしを確認する
2. `npm run dev` でホーム・記事詳細・検索が表示されることを確認する
3. 本ファイル末尾の「完了記録欄」に完了日・行数を記録する
4. `agents-task-status.md` の先頭行に結果を1行追記する（例: `2026-03-21 T1-A 完了 mock4削除 641行削除`）
5. 仕様変更があれば `docs/spec/` を更新する

### 0.5 Human-in-the-Loop（Codex が独断で決めてはいけない事項）

以下は必ずユーザー確認を取ってから実施する：

- `docs/spec/04-data-model-and-sql.md` の変更を伴う修正
- 新規依存パッケージの追加
- `scripts/backup-neon-all.mjs` への変更
- `vercel.json` / GitHub Actions の変更
- このリファクタリング計画自体の方針変更

---

## 1. 現状の問題点

コードを読んだ結果、以下の問題が確認された。

### 1.1 ファイルが大きすぎる（最重要）

| ファイル | 行数 | 問題 |
|---|---|---|
| `src/app/page.tsx` | **786行** | 18個以上の useState、モーダル・セクション・小コンポーネントがすべてインライン |
| `src/lib/db/public-feed.ts` | **746行** | Home・検索・記事・タグ・ランキング・ダイジストの全クエリを1ファイルに集約 |
| `src/lib/db/enrichment.ts` | **757行** | enriched 系の全 CRUD + 重複検出ロジックを1ファイルに集約 |
| `src/lib/jobs/daily-enrich.ts` | **800行** | 1つのジョブファイルが800行 |
| `src/app/mock4/page.tsx` | **641行** | 開発用モックがリリース候補コードに残っている |

### 1.2 型の命名不一致（概念的な混乱）

- DB・バッチ側: `source_category`（例: `'llm' | 'agent' | 'voice'`）
- TypeScript 型定義 (`types.ts`): `Genre`（`Article.genre`）
- UI 側: `activeTopic`（フィルタ変数名）
- 同じ概念が3つの名前で呼ばれており、コードを読むたびに変換コストが発生している

### 1.3 型の二重定義（ContentLaneKey vs HomeLaneKey）

```typescript
// types.ts
type HomeLaneKey = 'official' | 'alerts' | 'blog' | 'paper' | 'news'  // 5種
type ContentLaneKey = 'official' | 'paper' | 'news'                    // 3種
```

- `HomeLanes` は定義されているが実際に使われていない（`ContentLanes` が使われている）
- API レスポンスには `official / paper / news` しか返っていない
- 名前から用途が分からない

### 1.4 resolveEmoji が page.tsx にインライン

- `page.tsx` 内で定義されている `resolveEmoji` 関数が、他のファイル（ArticleCard 等）と重複している可能性がある
- 共通ユーティリティとして `src/lib/publish/thumbnail-emoji.ts` に集約すべき

### 1.5 mock4 がプロダクションコードに残っている

- `src/app/mock4/page.tsx` (641行) は開発・確認用のモックページ
- リリース後に外部からアクセス可能な状態のままになっている

### 1.6 scripts/ の拡張子が混在

- `.mjs` (ESModule) と `.ts` (TypeScript) が混在している
- 実行方法が `node` と `npx tsx` で分かれており、どちらで動くかが不明確

---

## 2. 現状のコメント分析

コードを確認した結果、コメントは約 **122行分** 存在し、以下の3種類に分類できる。

### 2.1 削除すべきコメント（約80行）

**種類A: セクション区切り線**（自明なセクションを `// ──` で区切っているだけ）

```typescript
// ── ホームデータ取得
// ── 検索
// ── 小コンポーネント ─────────────────────────────
// ── 1. 公開候補を全件取得（unique かつ AI 処理完了のみ）────────
// ── Tier-1 / Tier-2 共通: batch を bulk UPSERT する内部関数 ───
// チャンクサイズ設定
```

**種類B: 関数名・型名と内容が重複する説明**（読めば分かる）

```typescript
// トピックフィルタ適用       ← 直後に filterByTopic = ... がある
// KPI 定義                   ← 直後に kpis = useMemo(...) がある
// ArticleCard レンダリングヘルパー ← 関数名 renderCard で分かる
// 全記事プール（findArticle 用） ← useMemo の返り値で明らか
// ソースレーンの絵文字解決（ArticleRow でも使うシンプル版）
```

**種類C: JSDoc で型シグネチャと重複するもの**（型定義を見れば分かる）

```typescript
/** ランダム表示（1年以内の記事からランダム抽出） */   ← 関数名 listRandomArticles で分かる
/** 最新順 */                                          ← 関数名 listLatestArticles で分かる
/** ジャンル多様順 */                                  ← 関数名 listUniqueArticles で分かる
/** 1フィードを取得してアイテム一覧を返す */           ← 関数名 ingestFeed で分かる
/** Gemini Flash で要約・批評を生成 */                 ← 関数名で分かる
```

**種類D: 後方互換メモ**（コードを削除するなら不要、残すなら TODO 1行で十分）

```typescript
// 旧 listPublicArticlesLanes（後方互換 - 不要になったら削除）
```

### 2.2 残すべきコメント（約40行）

**理由があるコメント** = 「なぜそう書いたか」が分からないと後で誤って変更されるリスクがある

| 場所 | 内容 | 残す理由 |
|---|---|---|
| `actions/route.ts` JSDoc | `share_open` / `return_focus` / `unsave` が集計対象外の理由 | 削除すると意図が失われる。運用判断の根拠 |
| `daily-enrich.ts:693-701` | 3段階フォールバック（Tier-1→2→3）の設計説明 | 非自明なアルゴリズム。なぜ3段階かが分からなくなる |
| `hourly-fetch.ts:58-59` | "preserve the failure for later inspection" | 直感に反する実装（エラー行を消さない理由） |
| `auth/admin.ts:11` | 環境変数の改行エスケープを復元 | Firebase秘密鍵の扱い。非自明な文字列処理 |
| `hackernews.ts:42` | DB接続不可時は基本キーワードで継続 | エラーハンドリングの意図 |
| `daily-enrich.ts:557` | `paper` は `paper` タグのみ付与 | 設計判断。なぜ例外扱いかが分からなくなる |
| `ai/summarize.ts:59` | 本文は最初の3000文字に制限 | コスト・速度トレードオフの根拠 |

---

## 3. リファクタリング計画（優先度順）

### Tier 0：全ファイル横断・コメント削減（ファイル分割と並行して実施）

**目的:** AI エージェントがファイルを開いたときのトークン消費量を削減する。
ファイル分割と組み合わせることで二度手間を防ぐ（分割するファイルはその都度コメントも整理する）。

**削除ルール（迷ったときの基準）:**

| 削除する | 残す |
|---|---|
| 関数名・型名と内容が同じ説明 | 直感に反する実装の理由 |
| セクション区切り線 (`// ──`) | 設計判断の根拠（なぜこの方針か） |
| JSDoc で型シグネチャと重複する説明 | コスト・制限値の根拠（「なぜ3000文字か」等） |
| `// 続き` `// ここから` 等のナビゲーション | エラーハンドリングの意図（なぜ例外を飲むか） |
| 後方互換メモ（コードごと削除するなら不要） | 外部依存の制約（API仕様・DBの挙動） |

**実施単位:** ファイル分割タスク（T1-D, T2-B, T3-A, T3-B）と同じターンで実施する。
分割しないファイルは T2 終了後に一括パスをかける。

**完了条件:** `npm run type-check` がエラーなし。

**コメント整理の作業手順（1ファイルあたり）:**
1. ファイルを開いて `//` と `/**` のコメント行をすべてリストアップする
2. 削除ルールのテーブル（下記 §3 参照）に照らして分類する
3. 「削除する」に該当するものを消す（コードは変更しない）
4. `npm run type-check` を通す
5. `agents-task-status.md` に1行追記する

#### T0 対象ファイル一覧（各ファイルのコメント整理方針）

| ファイル | 現状 | 方針 |
|---|---|---|
| `src/app/page.tsx` | セクション区切り10行・説明コメント8行 | T1-D の分割時に同時整理 |
| `src/lib/jobs/daily-enrich.ts` | 3段階フォールバック説明（残す）+ セクション区切り（削除）計約15行削減 | T3-B の分割時に整理 |
| `src/lib/jobs/hourly-publish.ts` | セクション区切り5行・定数コメント1行 | T2 完了後に単独パス |
| `src/lib/db/public-feed.ts` | JSDoc 8個（ほぼ削除対象）・後方互換メモ1行 | T2-B の分割時に同時整理 |
| `src/lib/db/types.ts` | ファイルヘッダー3行・インラインコメント5行 | T1-B / T1-C 完了後に整理 |
| `src/lib/db/enrichment.ts` | 型定義の説明コメント数行 | T3-A の分割時に整理 |
| `src/lib/ai/summarize.ts` | JSDoc 3個（一部残す）・制限値コメント（残す） | 単独パス |
| `src/lib/auth/admin.ts` | JSDoc 2個（削除）・改行処理コメント（残す） | 単独パス |
| `src/app/api/actions/route.ts` | action_type マッピング JSDoc（**全文残す**） | 変更なし |
| `src/lib/collectors/hackernews.ts` | 3行（2行残す・1行削除） | 単独パス |
| その他小ファイル | 散発的なコメント数行 | T2 後にまとめて1パス |

---

### Tier 1：リリース前に必ず実施（1〜2日）

---

#### T1-A: `mock4` ページの削除

**対象:** `src/app/mock4/page.tsx`（641行）

**理由:** リリース後に外部からアクセスできる状態は問題。削除してよい。

**手順:**
1. `src/app/mock4/` ディレクトリごと削除する
2. `src/app/page.tsx` 等に `/mock4` への内部リンクが残っていないか確認する
3. 削除後に型チェック (`npm run type-check`) を通す

**リスク:** なし（外部参照がなければ他に影響しない）

---

#### T1-B: `ContentLaneKey` / `HomeLaneKey` の整理

**対象:** `src/lib/db/types.ts`

**理由:** 使われていない型は混乱のもと。`HomeLaneKey` は削除し `ContentLaneKey` に統一する。

**現状:**
```typescript
type HomeLaneKey = 'official' | 'alerts' | 'blog' | 'paper' | 'news'  // 未使用
type ContentLaneKey = 'official' | 'paper' | 'news'                    // 実際に使われている
type HomeLanes = Record<HomeLaneKey, ...>                               // 未使用
type ContentLanes = Record<ContentLaneKey, ...>                         // 実際に使われている
```

**手順:**
1. `HomeLaneKey` と `HomeLanes` を削除する
2. `ContentLaneKey` を `LaneKey` に改名する（より短く、用途が明確）
3. `ContentLanes` を `Lanes` に改名する
4. 全ファイルの参照を一括置換する
5. `npm run type-check` を通す

**影響範囲:** `types.ts`・`public-feed.ts`・`page.tsx`・`api/home/route.ts`

---

#### T1-C: `Genre` → `SourceCategory` に改名

**対象:** `src/lib/db/types.ts` + 全参照箇所

**理由:** DB の `source_category` が UI では `Genre` という別名で呼ばれており、
コードを追うたびに概念の変換が必要。DB の命名を正として統一する。

**現状:**
```typescript
type Genre = 'llm' | 'agent' | 'voice' | 'policy' | 'safety' | 'search' | 'news'
interface Article { genre: Genre }   // DBの source_category に相当
```

**手順:**
1. `src/lib/db/types.ts` で `Genre` → `SourceCategory`、`Article.genre` → `Article.sourceCategory` に改名する
2. 下記の影響ファイルを順に更新する
3. API レスポンスの `genre` キーも `sourceCategory` に統一する（`/api/trends` 等）
4. `npm run type-check` を通す

**影響ファイル（この順に更新する）:**

| ファイル | 変更箇所 |
|---|---|
| `src/lib/db/types.ts` | `type Genre` → `type SourceCategory`、`Article.genre` → `Article.sourceCategory` |
| `src/lib/db/public-feed.ts` | `genre:` の列エイリアス → `sourceCategory:`、戻り値型 |
| `src/app/api/home/route.ts` | レスポンスの `genre` フィールド → `sourceCategory` |
| `src/app/api/trends/route.ts` | クエリパラメータ `genre` → `sourceCategory`（URL 互換は維持してよい） |
| `src/app/api/search/route.ts` | 同上 |
| `src/app/page.tsx` | `a.genre === activeTopic` → `a.sourceCategory === activeTopic`（`activeTopic` 変数名はそのままでよい） |
| `src/components/card/ArticleCard.tsx` | `article.genre` → `article.sourceCategory` |
| `src/app/articles/[publicKey]/page.tsx` | `article.genre` の参照箇所 |
| `src/app/category/[slug]/page.tsx` | genre/sourceCategory の参照箇所 |

**注意:** `activeTopic` / `TOPIC_CHIPS` などの UI 変数名は変更しない。これらは UI の状態変数であり、型とは別物。

---

#### T1-D: `page.tsx` の分割（最大のリファクタリング）

**対象:** `src/app/page.tsx`（786行）

**理由:** 786行の単一 Client Component は保守不可能。
18個以上の useState を抱え、モーダル・セクション・小コンポーネントが混在している。

**分割方針:**

```
src/
  app/
    page.tsx                         ← 200行以内に削減（オーケストレーターのみ）
  components/
    home/
      useHomeState.ts                ← 全 useState と effect を Custom Hook に抽出（新規）
      SummaryModal.tsx               ← サマリーモーダル（新規）
      ShareModal.tsx                 ← 共有モーダル（新規）
      HomeStatsBar.tsx               ← KPI ダッシュボード行（新規）
      HomeArticleSection.tsx         ← ランダム/新着/ユニークの3セクション（新規）
      HomeLaneSection.tsx            ← ソースレーンのレンダリング（新規）
    ui/
      KpiCard.tsx                    ← KpiCard コンポーネント（page.tsx から抽出）
      SectionHeading.tsx             ← SectionHeading（page.tsx から抽出）
      EmptyState.tsx                 ← EmptyState（page.tsx から抽出）
      LoadingGrid.tsx                ← LoadingGrid（page.tsx から抽出）
      CustomCheckbox.tsx             ← CustomCheckbox（page.tsx から抽出）
```

**`useHomeState` の返り値シグネチャ（このとおりに実装する）:**

```typescript
// src/components/home/useHomeState.ts

export type TopicChip = 'all' | 'llm' | 'agent' | 'voice' | 'policy' | 'safety' | 'search' | 'news'

export interface ShareState {
  target: UiArticle | null
  status: string | null
  textContent: string
  includeAiTrendHub: boolean
  includeTitle: boolean
  includeSummary: boolean
}

export interface UseHomeStateReturn {
  // ── データ ──
  homeData: HomeData
  homeStats: HomeStats
  homeActivity: HomeActivity
  searchState: SearchLoadState
  kpis: { label: string; value: string | number; group: string }[]
  // ── フィルタ済み記事 ──
  randomArticles: UiArticle[]
  latestArticles: UiArticle[]
  uniqueArticles: UiArticle[]
  visibleSearchArticles: UiArticle[]
  // ── UI 状態 ──
  period: RankPeriod
  activeTopic: TopicChip
  summaryMode: 100 | 200
  summaryModalArticle: UiArticle | null
  share: ShareState
  savedArticleIds: string[]
  likedArticleIds: string[]
  focusedArticleId: string | null
  searchDraft: string
  // ── アクション ──
  setPeriod: (p: RankPeriod) => void
  setActiveTopic: (t: TopicChip) => void
  setSummaryMode: (m: 100 | 200) => void
  setSummaryModalArticle: (a: UiArticle | null) => void
  setShareTarget: (a: UiArticle | null) => void
  setShareIncludeAiTrendHub: (v: boolean) => void
  setShareIncludeTitle: (v: boolean) => void
  setShareIncludeSummary: (v: boolean) => void
  setSearchDraft: (v: string) => void
  handleCardClick: (articleId: string) => void
  handleOpenArticle: (articleId: string) => void
  handleArticleAction: (type: ActionType, articleId: string) => void
  handleSearchSubmit: () => void
  handleShareCopyUrl: () => void
  handleShareCopyText: () => void
}

export function useHomeState(): UseHomeStateReturn { ... }
```

**`useHomeState.ts` に移す内容:**
- すべての `useState`（18個）
- すべての `useEffect`（4個）
- `filterByTopic` / `allArticles` / `randomArticles` / `latestArticles` / `uniqueArticles` / `visibleSearchArticles` の useMemo
- `kpis` の useMemo
- `findArticle` / `handleCardClick` / `handleOpenArticle` / `handleLike` / `handleSaveToggle` / `handleArticleAction` / `handleSearchSubmit`
- `handleShareCopyUrl` / `handleShareCopyText`（現在 page.tsx の JSX インラインに書かれている処理をハンドラとして抽出）
- `fetchJson` / `hydrateArticle` / `toUiArticles` / `resolveEmoji`（→ T2-A で共通化するまでの仮置き）

**`page.tsx` に残す内容:**
- `useHomeState()` を呼ぶだけの薄いオーケストレーター
- グローバルレイアウト（Header・Sidebar・BottomNav の配置）
- モーダルのマウント制御（`{summaryModal ? <SummaryModal ... /> : null}`）
- 定数: `TOPIC_CHIPS` / `LANE_ORDER` / `LANE_LABELS` / `LANE_TONES`（UI 定数なので page.tsx に残す）

**手順:**
1. `src/components/ui/` に小コンポーネント 5 つを作成する
2. `src/components/home/useHomeState.ts` を作成し、useState + effect + handler を移す
3. `src/components/home/SummaryModal.tsx` を作成する
4. `src/components/home/ShareModal.tsx` を作成する
5. `src/components/home/HomeStatsBar.tsx` を作成する
6. `page.tsx` を useHomeState を呼ぶだけの薄いコンポーネントに書き換える
7. `npm run type-check` を通す

**目標行数:** `page.tsx` → 150行以内、各新規ファイル → 150行以内

---

### Tier 2：リリース直後に実施（3〜5日）

---

#### T2-A: `resolveEmoji` の共通化

**対象:** `src/app/page.tsx`・`src/lib/publish/thumbnail-emoji.ts`

**理由:** `resolveEmoji` が page.tsx に重複定義されている疑いがある。

**手順:**
1. `src/lib/publish/thumbnail-emoji.ts` に `resolveEmoji` を移す（既存関数があれば統合する）
2. `page.tsx`・`ArticleCard.tsx` 等から import する
3. `pickThumbnailEmoji` と `resolveEmoji` の役割が重複していないか確認し、統合する

---

#### T2-B: `public-feed.ts` の分割

**対象:** `src/lib/db/public-feed.ts`（746行）

**分割方針:**

```
src/lib/db/
  public-articles.ts   ← 記事取得・詳細・一覧（listPublicArticles / getPublicArticleDetail 等）
  public-rankings.ts   ← ランキング関連（listPublicRankings / getRankBreakdown 等）
  public-tags.ts       ← タグ関連（listPublicTags / getTagDetail 等）
  public-home.ts       ← Home 専用クエリ（getHomeStats / listHomeLanes / getHomeActivity 等）
  public-search.ts     ← 検索クエリ（searchPublicArticles）
  public-feed.ts       ← 廃止（上記 4 ファイルで置換）
```

**手順:**
1. 関数の依存関係を確認し、循環参照が起きないように分割方針を確定する
2. 上記 5 ファイルを作成し、関数を移す
3. `public-feed.ts` を削除する（または re-export のみにして移行期を設ける）
4. 全参照先を更新し、`npm run type-check` を通す

---

#### T2-C: `scripts/` の拡張子統一

**対象:** `scripts/` 配下の全ファイル

**問題:**
- `.mjs`: `node scripts/xxx.mjs` で実行
- `.ts`: `npx tsx scripts/xxx.ts` で実行
- どちらで実行するかが `package.json` の scripts を見ないと分からない

**方針:**
- 全て `.ts` に統一する（tsx で実行）
- `package.json` の `scripts` に `"db:*"` エントリを揃えて `npx tsx` を隠蔽する

**手順:**
1. 各 `.mjs` ファイルを `.ts` に改名し、`require` を `import` に書き換える（既に ESM なら最小変更）
2. `package.json` の `scripts` を整理する（現在 `npm run db:check-layer12` 等が混在）
3. `README` 相当のコマンドリファレンスを `imp-hangover.md` の「すぐ使うコマンド」セクションに反映する

---

### Tier 3：リリース後（余裕があれば）

---

#### T3-A: `enrichment.ts` の分割

**対象:** `src/lib/db/enrichment.ts`（757行）

**分割方針:**

```
src/lib/db/
  enriched-articles.ts   ← upsertEnrichedArticle / listRawArticlesForEnrichment 等
  deduplication.ts       ← findDuplicateMatch / findSemanticDuplicate / findSimilarTitleDuplicate
  enrichment.ts          ← 廃止
```

---

#### T3-B: `daily-enrich.ts` の分割

**対象:** `src/lib/jobs/daily-enrich.ts`（800行）

**分割方針:**

```
src/lib/jobs/
  daily-enrich.ts         ← エントリーポイント（orchestration のみ）
src/lib/enrich/
  prepare-articles.ts     ← コンテンツ取得・前処理（PreparedEnrichArticle の構築）
  generate-summaries.ts   ← AI 要約生成バッチ処理
  save-enriched.ts        ← DB への upsert と job_run_items の記録
```

---

#### T3-C: topic フィルタのサーバー側移行（パフォーマンス改善）

**対象:** `src/app/page.tsx` の `filterByTopic`・`/api/home` route

**現状:** クライアントがすべての記事を受け取り、`source_category` フィルタをブラウザ側で実行している

**方針:**
- `/api/home?topic=agent` のようなクエリパラメータを追加し、DB 側でフィルタする
- ただし Home の記事数が少ない現状では体感差がないため、リリース後の最適化として扱う

---

## 4. 実施順序まとめ

```
Week 1（リリース前）:
  T1-A: mock4 削除              → 30分
  T1-B: ContentLaneKey 整理     → 1時間
         └─ T0: types.ts のコメント整理（同時実施）
  T1-C: Genre → SourceCategory  → 2時間（参照箇所が多い）
  T1-D: page.tsx 分割           → 1日（最大のタスク）
         └─ T0: page.tsx のコメント整理（同時実施）

Week 2（リリース直後）:
  T2-A: resolveEmoji 共通化     → 1時間
  T2-B: public-feed.ts 分割     → 半日
         └─ T0: public-feed.ts のコメント整理（同時実施）
  T2-C: scripts/ 拡張子統一     → 半日
  T0（単独パス）: hourly-publish.ts / summarize.ts / auth/admin.ts
                  / hackernews.ts / その他小ファイル → まとめて半日

Week 3 以降（余裕があれば）:
  T3-A: enrichment.ts 分割
         └─ T0: enrichment.ts のコメント整理（同時実施）
  T3-B: daily-enrich.ts 分割
         └─ T0: daily-enrich.ts のコメント整理（同時実施）
  T3-C: topic フィルタのサーバー移行
```

---

## 5. 実施時の注意事項

### 5.1 各タスクの完了条件

1. `npm run type-check` がエラーなし
2. `npm run dev` でホーム・記事詳細・検索・タグが表示される
3. 分割前後でファイル数と行数を記録する（効果の証跡を残す）

### 5.2 AIエージェントへの委託ルール

各 Tier の実施時は、エージェントへのプロンプトに以下を必ず含める：

```
実装完了後、同一ターンで以下を更新すること：
- docs/imp/refactoring-plan.md の該当タスクに「完了」と日付を記録する
- 分割前後の行数を記録する
- docs/imp/imp-hangover.md に残件を追記する
```

### 5.3 変更しないもの

以下はリファクタリング対象外とする（動作に影響するため）：

- DB スキーマ・migration ファイル
- `hourly-publish` の bulk upsert ロジック（本番で動作確認済み）
- `scripts/backup-neon-all.mjs`（バックアップスクリプトは触らない）
- Vercel の cron 設定（`vercel.json` / GitHub Actions）

---

## 6. 完了記録欄

| タスク | 完了日 | 変更前行数 | 変更後最大行数 | 備考 |
|---|---|---|---|---|
| T1-A mock4 削除 | 2026-03-20 | 588 | 0（削除） | `src/app/mock4/page.tsx` を削除 |
| T1-B ContentLaneKey 整理 | 2026-03-20 | 141 | 132 | `HomeLaneKey/HomeLanes` を削除、`LaneKey/Lanes` へ整理 |
| T1-C Genre→SourceCategory | 2026-03-20 | 全参照 | 全参照 | API は旧 `genre` クエリ互換を維持 |
| T1-D page.tsx 分割 | 2026-03-20 | 715 | 216 | `page.tsx=203`、Home 状態は `useHomeState/useHomeData/useHomeActions/shared` へ再分割 |
| T0 types.ts コメント整理 | 2026-03-20 | 141 | 132 | T1-B/C と同時 |
| T0 page.tsx コメント整理 | 2026-03-20 | 715 | 203 | T1-D と同時 |
| T2-A resolveEmoji 共通化 | 2026-03-20 | - | 62 | `src/lib/publish/thumbnail-emoji.ts` に集約 |
| T2-B public-feed.ts 分割 | 2026-03-20 | 698 | 114 | `public-feed/public-articles` を barrel 化し、`rankings/listings/detail/home/search/tags/shared` に分割 |
| T0 public-feed.ts コメント整理 | 2026-03-20 | 698 | 15 | barrel 側のみ整理。新分割ファイルは最小コメント維持 |
| T2-C scripts/ 統一 | - | - | - | |
| T0 単独パス（hourly-publish等） | - | - | - | |
| T3-A enrichment.ts 分割 | - | 757 | <200 | |
| T0 enrichment.ts コメント整理 | - | 757 | - | T3-A と同時 |
| T3-B daily-enrich.ts 分割 | - | 800 | <200 | |
| T0 daily-enrich.ts コメント整理 | - | 800 | - | T3-B と同時 |
| T3-C topic フィルタ移行 | - | - | - | |
### 2026-03-20 実績追記

| タスク | 実施日 | 実装前最大行数 | 実装後最大行数 | 補足 |
|---|---|---|---|---|
| T1-D Home actions 再分割 | 2026-03-20 | 216 | 111 | `useHomeActions` を orchestrator 化し、`derived/article/share` へ分割 |
| T1-D Home page shell 分割 | 2026-03-21 | 222 | 182 | `page.tsx` を shell のみにし、左カラムを `HomePrimaryColumn` へ分離 |
### 2026-03-21 実績追記

| タスク | 実施日 | 実装前最大行数 | 実装後最大行数 | 補足 |
|---|---|---|---|---|
| T2-C hourly-publish 分割 | 2026-03-21 | 553 | 197 | `jobs/hourly-publish.ts` を orchestrator 化し、publish ロジックを `src/lib/publish/` へ分離 |
| T3-A enrichment.ts 分割 | 2026-03-21 | 757 | 283 | `enrichment.ts` を barrel 化し、raw/dedupe/upsert へ分離 |
| T3-B daily-enrich.ts 分割 | 2026-03-21 | 800 | 324 | `daily-enrich.ts` を orchestrator 化し、`src/lib/enrich/` へ helper を分離 |
| T0 summarize.ts 分割 | 2026-03-21 | 129 | 41 | `summarize.ts` を facade 化し、prompt/provider/fallback を分離 |
| T3-C topic filter server-side | 2026-03-21 | - | - | `/api/home?topic=...` を追加し、Home topic 絞り込みをサーバー側へ移行 |
