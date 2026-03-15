# 2026-03-12 データ設計メモ

最終更新: 2026-03-12

## 1. このメモの目的

このメモは、2026-03-12 時点で合意したデータ設計を、後からそのまま再実装できる粒度で固定するためのものです。  
実装対象は Neon/PostgreSQL を前提とし、まずはデータ取得から公開までの全体像を 4 つのレイヤーに分けて整理します。

このメモを読めば、少なくとも次を再現できる状態を目指します。

1. `layer1` から `layer4` の責務分離
2. 毎時・日次・週次バッチの役割
3. タグマスタ更新と Google Trends 連携の流れ
4. 即時運営操作と公開データ反映の関係
5. Neon に適用する SQL スキーマの意図

## 2. 全体方針

### 2.1 レイヤーの定義

1. `layer1`
   - 外部ソースから取得した直後の生データ層
   - 物理テーブルは `articles_raw`
   - URL 重複を許容する
2. `layer2`
   - 要約、タグ照合、確定重複判定まで済ませた整形層
   - 物理テーブルは `articles_enriched`
   - まだ公開可否は確定しない
3. `layer3`
   - ウェブサイト運用により自動蓄積される運用データ層
   - 行動ログ、行動集計、運営ログ、優先処理キューを含む
   - 手動承認層ではない
4. `layer4`
   - サイトが直接参照する公開データ層
   - 物理テーブルは `public_articles` などの公開系テーブル
   - サイト表示はこの層だけを見る

### 2.2 実装優先順位

1. まず `layer1` と `layer2` を安定実装する
2. 次に `layer2 -> layer4` の公開反映経路を作る
3. `layer3` はサイト稼働と同時に蓄積を開始する
4. `layer4` は毎時更新されるが、表示参照先としては安定させる

### 2.3 公開面の原則

1. サイト表示は `layer4` のみを参照する
2. `layer2` はサイトが直接読まない
3. `layer3` は公開反映に使う補助情報であり、一覧表示の直接ソースではない

## 3. レイヤー別設計

### 3.1 Layer1: 生データ層

#### 役割

1. 外部ソースの取得結果をそのまま受け取る
2. URL 正規化前後の差分や更新検知材料を残す
3. 1 か月以内の再取得・再要約判断の元になる
4. 1 か月超のデータは履歴へ移す

#### 保持する考え方

1. 本文全文は保持しない
2. 要約前処理に必要な最小情報だけ持つ
3. ソースが更新日時を持つ場合は `source_updated_at` を保持する
4. 更新日時を持たないソースでも `snippet_hash` の差分で再処理判断できるようにする

#### 重複の考え方

1. `layer1` は URL 重複を許容する
2. 同じ `normalized_url` でも複数ソースから入ってよい
3. 同じソースから再取得された場合も別レコードとして入れてよい
4. 後段で更新判定や代表ソース選定に使う

### 3.2 Layer2: 整形層

#### 役割

1. `layer1` の生データを解析して要約を生成する
2. タグ候補を出し、タグマスタ照合を行う
3. 確定重複をマークする
4. 将来 `layer4` へ公開するための元データを保持する
5. 履歴を残しつつ最新状態を管理する

#### この段階でやること

1. `full` / `snippet` の判定
2. `summary_100` / `summary_200` の生成
3. タグ候補抽出
4. `tags_master` / `tag_aliases` との照合
5. `tag_candidate_pool` への未採用タグ蓄積
6. `normalized_url` 一致の確定重複判定
7. 同一引用元一致の確定重複判定
8. `publish_candidate` の初期判定

#### この段階でやらないこと

1. 類似文章の AI 自動削除
2. 最終公開ソースの確定
3. サイト表示用ランキングの確定

### 3.3 Layer3: 運用データ層

#### 役割

1. サイト稼働により自動蓄積される運用情報を持つ
2. 公開更新に必要な補助信号を持つ
3. 運営操作を即時反映できる状態を作る

#### 含めるもの

1. `activity_logs`
2. `activity_metrics_hourly`
3. `admin_operation_logs`
4. `priority_processing_queue`

#### 重要な整理

1. `layer3` は手動承認層ではない
2. 人の判断が入る可能性があるのはタグマスタ追加だけ
3. 運営操作は毎時バッチ待ちではなく即時反映ルートを持つ

### 3.4 Layer4: 公開データ層

#### 役割

1. サイトが直接参照する公開用データをまとめる
2. 代表ソース、表示要約、公開タグ、順位を保持する

#### 含めるもの

1. `public_articles`
2. `public_article_sources`
3. `public_article_tags`
4. `public_rankings`

## 4. バッチ設計

### 4.1 毎時バッチ: 情報取得

入力:

1. `source_targets`
2. 外部 RSS / API / Alerts

処理:

1. 有効な取得元を列挙する
2. ソースごとに取得処理を実行する
3. URL を正規化する
4. `articles_raw` に投入する
5. 記事単位で失敗時はスキップし、全体ジョブは止めない

出力:

1. `articles_raw`

### 4.2 毎時連鎖: 公開反映

入力:

1. `articles_enriched`
2. `activity_metrics_hourly`
3. `priority_processing_queue`
4. `source_priority_rules`

処理:

1. 公開候補を抽出する
2. 同一引用元や重複群に対して代表ソースを決める
3. `public_articles` を更新する
4. `public_article_sources` を更新する
5. `public_article_tags` を更新する
6. `public_rankings` を更新する
7. 即時反映キューがあれば先に処理する
8. 記事単位失敗でスキップし、後続全体は止めない

### 4.3 日次バッチ: 整形

入力:

1. `articles_raw`

処理:

1. 未処理または再処理対象の raw を取得する
2. `full` / `snippet` を判定する
3. AI 要約を生成する
4. タグ候補を抽出する
5. 既存タグと照合する
6. 未採用タグ候補を `tag_candidate_pool` に蓄積する
7. 確定重複判定を行う
8. `articles_enriched` に保存する
9. 旧版があれば `articles_enriched_history` へ退避する
10. `articles_raw.is_processed` を更新する

### 4.4 日次バッチ: タグ候補集計

入力:

1. `tag_candidate_pool`

処理:

1. 一定件数を超えた候補を抽出する
2. Google Trends と照合する
3. マッチしたものを `tags_master` に昇格させる
4. 必要なら `tag_aliases` を追加する
5. 昇格済み候補を `promoted` に更新する
6. 新規マスタ追加後、次の毎時バッチで再タグ付け対象に含める

### 4.5 週次バッチ: アーカイブと整理

入力:

1. `articles_raw`
2. `articles_enriched`
3. `tag_candidate_pool`

処理:

1. `articles_raw` の 1 か月超データを `articles_raw_history` に移す
2. 不要な旧版履歴や補助データを整理する
3. 古いタグ候補の棚卸しを行う

## 5. タグ運用詳細

### 5.1 生成時

1. 記事要約時に AI がタグ候補を出す
2. `tags_master` と `tag_aliases` に照合する
3. 一致した候補は標準化タグとして `articles_enriched_tags` に保存する
4. 一致しなかった候補は `tag_candidate_pool` に保存する

### 5.2 日次昇格時

1. `tag_candidate_pool.seen_count` が閾値以上の候補を対象にする
2. Google Trends と照合する
3. Trends と一致した候補は `tags_master` に追加する
4. 同義語が必要なら `tag_aliases` に追加する
5. 追加されたタグを持つ既存記事は次の毎時バッチで再タグ付けする

### 5.3 手動承認

1. 人の承認が入る可能性があるのはタグマスタ追加だけ
2. そのため `tag_candidate_pool.review_status` を持つ
3. `manual_review_required` を立てられるようにする

## 6. 重複設計

### 6.1 確定重複

1. `normalized_url` 一致
2. 同一引用元一致

### 6.2 類似重複

1. 類似文章の AI 判定は後段で使う
2. `layer2` では `similar_candidate` として保持してよい
3. 自動削除はしない

## 7. 更新検知設計

更新とみなす条件:

1. `source_target_id` が同一
2. `normalized_url` が同一
3. かつ `source_updated_at` が新しい、または `snippet_hash` が変化した

更新時の挙動:

1. 新しい raw を追加する
2. `has_source_update = true` を立てる
3. 次の日次整形で再要約対象にする
4. 旧 enriched は `articles_enriched_history` に残す

## 8. 保持ポリシー

1. `articles_raw`
   - 1 か月保持後に `articles_raw_history` へ移動
2. `articles_enriched`
   - 1 年程度保持
3. `articles_enriched_history`
   - 旧版を保持して差分追跡を可能にする
4. `activity_logs`
   - 明細は長期保持してよいが、公開側は毎時集計を優先利用

## 9. 実テーブル一覧

1. `source_targets`
2. `source_priority_rules`
3. `articles_raw`
4. `articles_raw_history`
5. `articles_enriched`
6. `articles_enriched_history`
7. `articles_enriched_tags`
8. `tags_master`
9. `tag_aliases`
10. `tag_candidate_pool`
11. `activity_logs`
12. `activity_metrics_hourly`
13. `admin_operation_logs`
14. `priority_processing_queue`
15. `public_articles`
16. `public_article_sources`
17. `public_article_tags`
18. `public_rankings`
19. `push_subscriptions`
20. `digest_logs`

## 10. 未確定事項

1. 新語タグ候補の昇格閾値
2. Google Trends との一致判定ルール
3. 類似重複を AI と pgvector のどちら寄りで扱うか
4. `public_rankings` の正式計算式
5. `layer4` を完全テーブルで持つか、一部 view を使うか
