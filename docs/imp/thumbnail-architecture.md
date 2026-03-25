# サムネイル・アイコン生成アーキテクチャ

このドキュメントは、記事カード左側の小型サムネイルが何に依存して、どこで生成され、どこでフォールバックするかを現行実装ベースで整理したものです。

## 1. 結論

現在のサムネイル表示は次の 5 つに依存しています。

1. `articles_enriched` / `public_articles`
   - `thumbnail_url`
   - `thumbnail_emoji`
   - `title` または表示用 `title`
   - `summary_100`, `summary_200` または表示用 summary
   - `source_type`, `source_category`
   - `content_language`
2. `articles_enriched_tags` / `public_article_tags`
   - 記事に紐づくタグ一覧
3. `tags_master`
   - `tag_key`
   - `display_name`
4. [`src/lib/publish/thumbnail-tag-registry.ts`](/G:/devwork/ai-summary/src/lib/publish/thumbnail-tag-registry.ts)
   - タグごとの `accentColor`
   - `iconPath`
   - `highQualityAssetPath`
   - registry 未登録タグの fallback ルール
5. `public/thumbs/icons/` と `public/thumbs/assets/`
   - 実際に描画で読み込まれる SVG / 画像アセット

## 2. 全体フロー

Mermaid 図は `docs/imp/flowchart.md` の「サムネイル生成フロー」へ移動した。

## 3. 保存時の依存関係

`thumbnail_url` は外部画像 URL を保存しているのではなく、内部の `/api/thumb?...` URL を保存しています。

生成箇所:

- [`src/lib/publish/thumbnail-template.ts`](/G:/devwork/ai-summary/src/lib/publish/thumbnail-template.ts)
  - `buildInternalThumbnailUrl()`
- [`src/lib/enrich/persist-enriched.ts`](/G:/devwork/ai-summary/src/lib/enrich/persist-enriched.ts)
  - Layer 2 保存時に `articles_enriched.thumbnail_url` へ反映
- [`src/lib/publish/hourly-publish-upsert.ts`](/G:/devwork/ai-summary/src/lib/publish/hourly-publish-upsert.ts)
  - Layer 4 へ `public_articles.thumbnail_url` を反映
- [`scripts/backfill-thumbnail-urls.ts`](/G:/devwork/ai-summary/scripts/backfill-thumbnail-urls.ts)
  - 既存データの再計算と再同期

`buildInternalThumbnailUrl()` が見ている情報:

1. `matchedTags`
   - 記事に紐づくタグ一覧
2. `title`, `summary100`, `summary200`
   - タグをどの順で優先表示するかのランキング材料
3. `sourceType`, `sourceCategory`
   - 背景バリエーションの決定
4. `contentLanguage`
   - `JP` / `EN` バッジ
5. registry に icon があるか
   - icon が 0 件なら `thumbnail_url` を返さず `null`

つまり、Gemini が改善した「見た目」は最終レンダリングに効きますが、そもそもそのタグが選ばれるか、`thumbnail_url` が作られるかは DB のタグ情報と `thumbnail-template.ts` のロジックに依存しています。

## 4. レンダリング時の依存関係

ブラウザ表示時は、保存済みの `thumbnail_url` を使って都度 SVG を返す。
シーケンス図は `docs/imp/flowchart.md` の「サムネイル描画シーケンス」へ移動した。

実装箇所:

- [`src/app/api/thumb/route.ts`](/G:/devwork/ai-summary/src/app/api/thumb/route.ts)
  - `GET`
  - `decodeThumbnailPayload()` と `renderThumbnailSvg()` の呼び出し
- [`src/lib/publish/thumbnail-template.ts`](/G:/devwork/ai-summary/src/lib/publish/thumbnail-template.ts)
  - クエリ decode
  - asset 読み込み
  - SVG 合成
- [`src/lib/publish/thumbnail-tag-registry.ts`](/G:/devwork/ai-summary/src/lib/publish/thumbnail-tag-registry.ts)
  - タグごとの asset 解決

## 5. どこを変えると見た目が変わるか

### 5.1 アイコンの見た目

依存箇所:

- [`public/thumbs/icons/`](/G:/devwork/ai-summary/public/thumbs/icons)
- [`public/thumbs/assets/`](/G:/devwork/ai-summary/public/thumbs/assets)
- [`src/lib/publish/thumbnail-tag-registry.ts`](/G:/devwork/ai-summary/src/lib/publish/thumbnail-tag-registry.ts)

変化内容:

- アイコン SVG を差し替える
- 特定タグの `highQualityAssetPath` を追加する
- `accentColor` を調整する

### 5.2 レイアウトと質感

依存箇所:

- [`src/lib/publish/thumbnail-template.ts`](/G:/devwork/ai-summary/src/lib/publish/thumbnail-template.ts)

主な変更ポイント:

- `renderIconTile()`
- `renderThumbnailSvg()`
- `BACKGROUNDS`
- `resolveLayout()`

ここが、今回の「ギリ良い感じ」の改善を継続していく本丸です。

### 5.3 どのタグが選ばれるか

依存箇所:

- [`src/lib/publish/thumbnail-template.ts`](/G:/devwork/ai-summary/src/lib/publish/thumbnail-template.ts)
  - `rankTags()`
  - `selectDisplayTags()`
- `articles_enriched_tags`
- `public_article_tags`

主な変更ポイント:

- title 内の出現順をどれだけ強く優先するか
- summary 側の重み
- overflow の扱い
- registry 未登録タグを表示対象に含めるか

## 6. フォールバックの境界

現在のフォールバックは次の順です。

1. `thumbnail_url` が生成できる
   - `/api/thumb` で SVG 表示
2. `thumbnail_url` はあるが、tag asset が弱い
   - registry / asset fallback で描画
3. `thumbnail_url` を生成できない
   - `thumbnail_emoji` を使う

補足:

- `buildInternalThumbnailUrl()` は registry 上で icon が 1 件も無い場合 `null` を返します
- `ArticleCard` は `thumbnail_url` を優先し、空なら `thumbnail_emoji` を表示します

## 7. いまのドキュメント上の注意

以前の説明にあった以下は、現行実装とはズレています。

- `generate-tag-icons.ts` が主導する説明
- `public/thumbs/assets/*.svg` だけに依存する説明
- `/api/thumb` が query だけで完結していて DB に依存しないように見える説明

正しくは、

- 保存時は DB と tag 紐付けに依存
- 表示時は `thumbnail_url` と registry / asset に依存
- `thumbnail_emoji` が最後の保険

です。

## 8. 検証メモ

2026-03-23 時点で、以下の実装と突き合わせて内容を確認済みです。

- [`src/lib/publish/thumbnail-template.ts`](/G:/devwork/ai-summary/src/lib/publish/thumbnail-template.ts)
  - `buildInternalThumbnailUrl()`
  - `decodeThumbnailPayload()`
  - `renderThumbnailSvg()`
- [`src/lib/publish/thumbnail-tag-registry.ts`](/G:/devwork/ai-summary/src/lib/publish/thumbnail-tag-registry.ts)
- [`src/app/api/thumb/route.ts`](/G:/devwork/ai-summary/src/app/api/thumb/route.ts)
- [`src/lib/enrich/persist-enriched.ts`](/G:/devwork/ai-summary/src/lib/enrich/persist-enriched.ts)
- [`src/lib/publish/hourly-publish-upsert.ts`](/G:/devwork/ai-summary/src/lib/publish/hourly-publish-upsert.ts)
- [`scripts/backfill-thumbnail-urls.ts`](/G:/devwork/ai-summary/scripts/backfill-thumbnail-urls.ts)
- [`src/components/card/ArticleCard.tsx`](/G:/devwork/ai-summary/src/components/card/ArticleCard.tsx)
- [`src/lib/db/public-shared.ts`](/G:/devwork/ai-summary/src/lib/db/public-shared.ts)

確認結果:

- 図の主フローは現行ソースと一致
- `thumbnail_url` の生成元、保存先、表示時 API は一致
- `thumbnail_emoji` fallback の説明は一致
- registry / asset 依存の説明は一致
- 文言だけ 2 箇所修正し、`public_articles` 側の表示用 title/summary と route の責務表現をソース準拠に寄せた
