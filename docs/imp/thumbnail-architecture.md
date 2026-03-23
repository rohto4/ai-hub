# サムネイル・アイコン生成アーキテクチャ

このドキュメントでは、AI Trend Hub における「記事の左側に表示されるサムネイル・アイコン」が、どの情報に依存し、どのような流れで生成・表示されているかを整理します。

## 0. 全体アーキテクチャ図

以下の図は、入力データから最終的なSVG画像がブラウザに返されるまでのデータの流れを示しています。

```mermaid
graph TD
    %% 入力データ (DB / コード)
    subgraph Data Sources [入力データ (Layer 2 / 4)]
        TM[(tags_master)] --> |tag_key, display_name| SG[generate-tag-icons.ts]
        SI[simple-icons / CUSTOM_ICONS] --> |ベクターパス, 公式カラー| SG
        
        AE[(articles_enriched)] --> |title, summary, category| U[URL 生成バッチ]
        PAT[(public_article_tags)] --> |記事に紐づくタグ| U
        PA[(public_articles)] --> |言語バッジ| U
    end

    %% 処理1: アセット生成
    subgraph Asset Generation [アイコン素材の準備 (ビルド/運用時)]
        SG --> |生成 (公式 or 幾何学)| FS[public/thumbs/assets/*.svg]
    end

    %% 処理2: URL生成
    subgraph URL Generation [サムネイルURL生成 (バッチ処理時)]
        U --> |ランキング & フィルタ| URL[thumbnail_url: /api/thumb?tags=a,b&bg=...]
        URL --> |保存| PA
    end

    %% 処理3: 描画
    subgraph Rendering [リアルタイム描画 (アクセス時)]
        REQ[Browser Request] --> |GET| API[/api/thumb/route.ts]
        API --> |クエリ解析| TMPL[thumbnail-template.ts]
        FS --> |Data URL変換| TMPL
        TMPL --> |レイアウト計算 (グラスモーフィズム合成)| SVG((最終的な SVG 画像))
    end

    %% 依存関係の接続
    PA -.-> |表示時にURLを参照| REQ
    SVG -.-> |レスポンス| REQ
```

## 1. 依存するデータソース (情報の源泉)

サムネイルの表示内容は、以下のデータに依存して決定されます。

1.  **`tags_master` テーブル (タグの定義)**
    *   `tag_key`: タグの一意な識別子 (例: `openai`, `agent`)。
    *   `display_name`: アイコン生成時に公式ロゴがない場合のフォールバック（文字やパターンのシード値）として間接的に使用されます。
    *   ※ 現在は `icon_asset_path` などのカラムを追加していますが、表示そのものはローカルのSVGファイルを正としています。

2.  **`public_article_tags` テーブル (記事へのタグ紐付け)**
    *   記事にどのタグが紐づいているか。このタグ群がサムネイルに表示されるアイコンの「パーツ」になります。

3.  **`public_articles` テーブル (記事のメタデータ)**
    *   `content_language`: サムネイル左上の言語バッジ (`EN` / `JP`) を決定。
    *   `thumbnail_url`: 最終的な描画先URL (`/api/thumb?...`) が保持されます。このURLクエリに、背景色、レイアウト、対象タグなどの描画指示が含まれています。

4.  **`articles_enriched` テーブル (記事の本文)**
    *   `title`, `summary_100`, `summary_200`: 記事に紐づく複数のタグのうち、「どれを一番手前に表示するか」の**優先順位付け（ランキング）**に使用されます。（タイトルや要約に早く出現するタグほど優先度が高くなります）
    *   `source_type`, `source_category`: サムネイル全体の**背景グラデーション色**（例: `blog-llm` なら緑系、`alerts` なら紫系など）を決定します。

## 2. アセットの管理 (パーツの準備)

アイコンそのもののベクター画像（SVG）は、以下の仕組みで管理・生成されています。

*   **生成スクリプト**: `scripts/generate-tag-icons.ts`
*   **アセットの保存先**: `public/thumbs/assets/*.svg`
*   **マッピング定義**: `src/lib/publish/thumbnail-tag-registry.ts`

### 2.1 アイコンの生成ロジック (`generate-tag-icons.ts`)
1.  **カスタム指定 (`CUSTOM_ICONS`)**: OpenAI や Gemini, ChatGPT, Microsoft Copilot など、商標の都合等で汎用ライブラリにないものは、スクリプト内にベクターパスをハードコードして使用します。
2.  **公式ロゴ (`simple-icons`)**: 上記以外のタグ（Anthropic, Google, GitHub など）は、npm パッケージ `simple-icons` から完全な公式ロゴのパスとブランドカラーを取得します。
3.  **幾何学パターン (Fallback)**: 公式ロゴが存在しないマイナーなタグに対しては、アルファベットの羅列ではなく、`tag_key` の文字列からハッシュ値（Seed）を計算し、**「固有のブランドカラーを持つ、近未来的な幾何学パターン」**を動的に生成します。

生成されたこれらはすべて、半透明のガラスベース（グラスモーフィズム）とドロップシャドウを合成した**1つの完全なSVGファイル**として `public/thumbs/assets/` に保存されます。

## 3. URLの生成 (バッチ処理)

記事が収集・公開される際（または `npm run db:backfill-thumbnail-urls` 実行時）、以下の流れで `thumbnail_url` が生成されます。

*   **担当コード**: `src/lib/publish/thumbnail-template.ts` の `buildInternalThumbnailUrl` 関数

1.  **タグの絞り込み**: 記事に紐づくタグの中から、レジストリ（`thumbnail-tag-registry.ts`）に登録されているタグのみを抽出します。
2.  **タグの順位付け (`rankTags`)**: タイトルや要約内での「出現位置の早さ」をスコア化し、上位最大3つのタグを選定します。
3.  **URLクエリの組み立て**:
    *   `bg`: `source_type` と `source_category` から決定。
    *   `tags`: 選定された最大3つのタグ（カンマ区切り）。
    *   `lang`: `content_language`。
    *   `overflow`: 選ばれなかったタグの数（右下の「...」の描画判定用）。
4.  完成したURL（例: `/api/thumb?bg=alerts&tags=openai,agent&lang=ja...`）をDBに保存します。

## 4. ブラウザでの描画 (実行時)

ブラウザが画像をリクエストすると、Next.js の API Route が動的にSVGを合成して返します。

*   **担当コード**: `src/app/api/thumb/route.ts` -> `renderThumbnailSvg`

1.  URLクエリの解析。
2.  **アセットの読み込み**: `public/thumbs/assets/` から該当するSVGファイルを読み込み、**Data URL (`data:image/svg+xml;base64,...`) に変換**します。これにより、外部へのHTTPリクエストなしに高速に画像をインライン展開できます。
3.  **レイアウトの計算**:
    *   タグが1つの場合: 中央に巨大なアイコンを配置（枠からはみ出す演出）。
    *   タグが2つの場合: 左上と右下に大きく重なり合うように配置。
    *   タグが3つの場合: トライアングル状にダイナミックに配置。
4.  **最終合成**: 背景グラデーション、装飾（円や多角形）、ガラスのメインカード、バッジ、そしてインライン化されたアイコンをすべて統合し、1つの `<svg>` タグとしてブラウザに返却（長期間キャッシュ）します。
