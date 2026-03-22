# 高品質サムネイル（Geminiアセット）実装設計・運用ガイド

## 1. コンセプト: "Aesthetic but Fast"
「見た目は派手でリッチ、描画は一瞬」を目指す。
Geminiで生成した高品質な透過画像（3D風アイコン、抽象背景）を、サーバーサイドのSVGテンプレートでレイヤー合成する。

## 2. 設計図（レイヤー構造）

### 2.1 レイヤー構成 (背面から順)
1.  **Base Background**: カテゴリ（LLM, Agent, Policy等）に基づいた、Gemini生成の「抽象的なテクスチャ画像」。
2.  **Glass Layer**: 半透明のぼかしが入った「ガラスの板」のような効果。SVGの `feGaussianBlur` または半透明の矩形で表現。
3.  **Main Asset**: 記事に紐付いた主要タグの「3D高品質アイコン」。
4.  **Lighting/Overlay**: ハイライトやシャドウをSVGで動的に重ね、奥行き感を出す。
5.  **Badge/Text**: 言語（JP/EN）やソース情報を配置。

### 2.2 技術スタック
- **Asset Format**: WebP (透過) を推奨。
- **Rendering**: `/api/thumb` エンドポイントでSVGを生成。画像は `data:image/webp;base64` または直リンクで埋め込む。
- **Caching**: Vercel/CDNで長期間キャッシュ（`immutable`）。

## 3. データモデルの拡張

### 3.1 `tags_master` テーブルの拡張
```sql
ALTER TABLE tags_master
  ADD COLUMN IF NOT EXISTS icon_asset_path text,         -- 高品質アセットへのパス
  ADD COLUMN IF NOT EXISTS icon_asset_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS preferred_bg_texture text;    -- タグ固有の推奨背景（任意）
```

## 4. 運用フロー

### 4.1 タグアセット生成サイクル (週次)
1.  **抽出**: `tags_master` から `icon_asset_path` が未登録、または `article_count` が多いタグを抽出。
2.  **プロンプト作成**: 専用スクリプトで、タグの `display_name` と `description` から「3Dアイコン生成プロンプト」を生成。
3.  **画像生成**: ユーザーがGemini CLI等を使用して画像を生成。
4.  **配置**: `public/thumbs/assets/<tag_key>.webp` として保存。
5.  **同期**: `db:backfill-thumbnail-urls` を実行して反映。

### 4.2 自動プロンプト例
> "A high-quality 3D render of a [Tag Name] icon. Minimalist, futuristic, glossy finish, soft studio lighting. Isolated on a transparent background. 8k resolution, cinematic style."

## 5. 動作イメージとフォールバック

### 5.1 優先順位
1.  **完全版**: 高品質アイコンアセットあり + 高品質背景テクスチャ。
2.  **準完全版**: 高品質アイコンアセットあり + 標準カテゴリ背景。
3.  **アイコンフォールバック**: 既存のSVGアイコン + 標準カテゴリ背景。
4.  **最終フォールバック**: カテゴリエモジ + 標準カテゴリ背景。

### 5.2 描画の高速化
- 合成はサーバーサイドで完結させ、クライアントには単一の `image/svg+xml` を送る。
- 重いフィルタ処理は極力避け、透過画像の重ね合わせをメインにする。
