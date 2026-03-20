# AI Trend Hub モバイル・タブレット画面遷移図

最終更新: 2026-03-19

## 1. 基本方針

1. 公開面は `layer4` を読む（PC 版と同じデータ責務）
2. ブレークポイントを3段階で設計する: mobile / tablet / desktop
3. モバイルでは上部ヘッダーを自動隠しし、ボトムナビで主要画面へ遷移する
4. 横スクロールカルーセルで Source Lane を縦スペース消費なく表示する

---

## 2. ブレークポイント定義

| 区分 | 幅 | Tailwind prefix |
|---|---|---|
| Mobile | < 768px | (default) |
| Tablet | 768px - 1023px | `md:` |
| Desktop | ≥ 1024px | `lg:` |
| Wide desktop | ≥ 1280px | `xl:` |

---

## 3. ナビゲーション構造

### 3.1 ボトムナビゲーションバー（mobile のみ）

- `md:hidden` で制御
- 高さ 56px、固定 bottom-0
- 項目: ホーム `/` / ランキング `/ranking` / 検索 `/search` / タグ `/tags` / その他 `/about`
- アクティブ状態: `usePathname` で判定、orange 色 + strokeWidth 2.5

### 3.2 ヘッダー（auto-hide）

- Mobile のみ: スクロール下方向 4px 超で `translateY(-100%)` 隠し
- スクロール上方向 4px 超で `translateY(0)` 再表示
- Tablet 以上 (≥ 768px): 常時表示

### 3.3 PublicScaffold ヘッダーナビ（tablet 以上のみ）

- `hidden md:flex` で制御
- Mobile では BottomNav が代替するため非表示

---

## 4. Home 画面レイアウト

### 4.1 Mobile (< 768px)

```
[ヘッダー fixed / auto-hide]
Stats ダッシュボード → 横スクロール（min-w-[72px] chips）
Focus バー
Toolbar + mode buttons
Topic chips → flex-wrap
ランキングセクション → 1カラム
ソースレーンセクション:
  official → 横スクロールカルーセル (w-[260px] snap)
  alerts  → 同上
  blog    → 同上
  paper   → 同上
  news    → 同上
Topic Group / Digest / Search / PWA
[BottomNav fixed bottom-0 h-56px]
main: pb-[80px]
```

### 4.2 Tablet (768px - 1023px)

```
[ヘッダー fixed / 常時表示]
Stats ダッシュボード → grid-cols-6
Focus バー
Toolbar + mode buttons
Topic chips → flex-wrap
ランキングセクション → grid-cols-2
ソースレーンセクション → grid-cols-2（各レーン 2カラム）
RightSidebar → 非表示 (hidden xl:block)
Topic Group / Digest / Search / PWA
[BottomNav 非表示]
main: pb-8
```

### 4.3 Desktop (≥ 1024px)

```
[ヘッダー fixed / 常時表示]
Stats ダッシュボード → grid-cols-8 (lg) / repeat(16) (xl)
固定サイドバー帯 (xl のみ)
ランキングセクション → grid-cols-2
ソースレーンセクション → grid-cols-4 (lg)
RightSidebar → xl のみ表示 (hidden xl:block xl:shrink-0)
main: pb-10
```

---

## 5. 公開ページ群（PublicScaffold ベース）

| ページ | モバイル変更点 |
|---|---|
| /ranking | PublicScaffold 内 nav hidden、pb-[80px]、BottomNav |
| /search | 同上 |
| /articles/:key | 同上 |
| /tags | 同上 |
| /tags/:tagKey | 同上 |
| /category/:slug | 同上 |
| /about | 同上 |

---

## 6. 未確定事項

1. BottomNav「その他」タップ → `/about` か、将来的にドロワー形式か
2. 検索 UX → ヘッダー検索フォームと `/search` ページの使い分け（現状は両方有効）
3. PublicArticleList の記事カードをモバイルで横スクロール化するか（現在は縦リスト）
4. `share_x` / `share_threads` 等の SNS シェアボタン（Header の隠し chip と統合するか）
