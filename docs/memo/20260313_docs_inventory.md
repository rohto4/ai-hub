# AI Trend Hub ドキュメント目録 & 活用ガイド

最終更新: 2026-03-13

このプロジェクトの SSOT（信頼できる唯一の情報源）である `docs/` 配下の全ファイルを整理しました。タスクのフェーズに合わせて適切なドキュメントを参照してください。

---

## 📂 ディレクトリ構造・ファイル一覧

### 1. `docs/guide/` (プロジェクト憲章・共通ルール)
| ファイル名 | 1行説明 |
| :--- | :--- |
| `README.md` | 全エージェント共通のマスターチートシート。スキル・ワークフロー・絶対ルール。 |
| `PROJECT.md` | プロジェクト固有の恒久ルール（DB接続、検索方針、非モック化方針等）。 |
| `gemini/gemini.md` | Geminiエージェント向けの最適化プロンプトとDDD（Document-Driven Development）の徹底。 |
| `claude/CLAUDE.md` | Claudeエージェント向けの行動規範、コマンド、ビルド/テスト手順。 |
| `codex/AGENTS.md` | エージェント（Copilot等）向けの指示書。 |
| `.agent/skills/*.md` | 16種類の専門家ペルソナ（UX, Tailwind, DDD等）の定義ファイル。 |
| `.agent/workflows/*.md` | 16種類の多段ステップSOP（スラッシュコマンド）の定義ファイル。 |

### 2. `docs/spec/` (詳細仕様書)
| ファイル名 | 1行説明 |
| :--- | :--- |
| `README.md` | 仕様書のインデックスとモックへのリンク。 |
| `00-overview.md` | プロジェクトの北極星、確定方針、MVPスコープ、成功条件の統合。 |
| `01-benchmark-existing-products.md` | Feedly, Product Hunt, Techmeme等の既存サービス比較と採用方針。 |
| `02-functional-requirements.md` | 収集、解析、重複排除、ランキング、表示、共有、通知の機能要件。 |
| `03-technical-architecture.md` | 技術スタック、4レイヤー構成、API境界、キャッシュ戦略。 |
| `04-data-model-and-sql.md` | Layer1〜Layer4のテーブル詳細設計とインデックス、RLS方針。 |
| `05-ingestion-and-ai-pipeline.md` | 収集・要約・公開パイプラインの詳細フローとバッチ責務。 |
| `06-ranking-and-activity.md` | ランキング計算式、時間減衰、アクティビティ演出の設計。 |
| `07-frontend-pwa-share.md` | デバイス別表示、PWA要件、OGP画像仕様、要約モード設計。 |
| `08-security-quality-operations.md` | セキュリティ、品質保証、監視、アラート、運用フロー。 |
| `09-kpi-rollout.md` | KPI定義、計測イベント、段階的リリース計画。 |
| `10-ingestion-layer-design.md` | Layer1/2に特化した取得・整形パイプラインの安定化設計。 |
| `research-links.md` | 競合サービス、デザインギャラリー、技術ドキュメント等の参考URL集。 |

### 3. `docs/imp/` (実装管理)
| ファイル名 | 1行説明 |
| :--- | :--- |
| `implementation-plan.md` | 現在の実装計画、フェーズ、完了したタスクの管理。 |
| `imp-status.md` | 進捗サマリと再開時の推奨確認順。 |
| `implementation-wait.md` | 実装を止めないための「判断待ち」論点の集約。 |
| `imp-hangover.md` | セッション間の引き継ぎ情報のまとめ。 |
| `constraints.md` | 実装しないもの（スコープ外）、禁止事項、制約の定義。 |
| `non-mock-ledger.md` | モックから実データへの移行（非モック化）対象項目の管理。 |
| `setup-guide.md` | 環境変数、Neon、Firebase、VAPID等のセットアップ手順。 |

### 4. `docs/init/` (プロジェクト初期・背景)
| ファイル名 | 1行説明 |
| :--- | :--- |
| `youken.md` | プロジェクト憲章、コアバリュー、技術仕様の初期案。 |
| `idea.md` | サービス拡張アイデア10選。 |
| `kenen.md` | コスト、精度、パフォーマンス、法務等のリスクと対策。 |
| `getdata_db_spec.md` | 外部バッチシステム向けのDB設計要件書。 |
| `getdata_youken_prompt.md` | Codex/Claude向けのバッチシステム実装依頼用プロンプト。 |

### 5. `docs/memo/` (メモ・設計図)
| ファイル名 | 1行説明 |
| :--- | :--- |
| `20260312-data-design.md` | 4レイヤー設計の意図とバッチ連鎖の詳細メモ。 |
| `20260312_dataflow.md` | Mermaidで記述された取得から公開までのデータフロー図。 |
| `memo.txt` | ユーザーからの細かいFBや要件変更のメモ。 |

### 6. `docs/mock* /` (プロトタイプ)
| ディレクトリ名 | 1行説明 |
| :--- | :--- |
| `mock/` | 初期の統合比較、意思決定ハブ等のモック。 |
| `mock2/` | 導線確認用のインタラクティブ・プロトタイプ。 |
| `mock3/` | 公開データ層（Layer 4）中心の閲覧用モック。 |

---

## 🧠 いつ読み込むべきかのチャンク分け

### 🔄 【再開時】状況とルールを最速で把握する
- `docs/guide/README.md` : プロジェクトの絶対ルール。
- `docs/imp/implementation-plan.md` : 次に何をすべきか。
- `docs/imp/imp-status.md` : 今どこまで終わっているか。
- `docs/imp/imp-hangover.md` : 直前のセッションで何が決まったか。

### 🚀 【Phase B/C 着手時】取得・整形パイプラインを組む
- `docs/spec/10-ingestion-layer-design.md` : 取得・整形の詳細（Layer 1/2）。
- `docs/memo/20260312-data-design.md` : レイヤー分離の意図。
- `docs/memo/20260312_dataflow.md` : データがどう流れるかの図解（Mermaid）。
- `docs/spec/05-ingestion-and-ai-pipeline.md` : バッチ責務と更新検知ルール。

### 🏗️ 【DB設計・移行時】データ構造と権限を扱う
- `docs/spec/04-data-model-and-sql.md` : テーブル設計の正解。
- `docs/memo/20260312-data-design.md` : なぜこのレイヤー構成なのか。
- `migrations/*.sql` : 実際のSQL（最新の状態。DDLのSSOTはここ）。
- `docs/spec/08-security-quality-operations.md` : RLSや監査ログの仕様。

### 📡 【パイプライン構築時】データ収集・AI要約を実装する
- `docs/spec/10-ingestion-layer-design.md` : 取得・整形の詳細。
- `docs/spec/05-ingestion-and-ai-pipeline.md` : バッチの責務と更新検知。
- `docs/init/getdata_youken_prompt.md` : 外部バッチの構造参考。

### 🎨 【ウェブサイト・UI/UX設計時】画面と体験を作る
- `docs/spec/07-frontend-pwa-share.md` : 画面仕様とOGP。
- `docs/mock3/` : 公開層データの見え方参考。
- `docs/imp/non-mock-ledger.md` : どの項目を実データにするか。
- `docs/guide/PROJECT.md` : UIの非モック化方針。

### 📊 【ロジック・アルゴリズム時】ランキングやタグを調整する
- `docs/spec/06-ranking-and-activity.md` : スコア計算式。
- `docs/spec/02-functional-requirements.md` : ユースケースと受入条件。
- `docs/imp/implementation-wait.md` : 未確定の閾値設定など。

### 🚨 【制約・運用確認時】やってはいけないことを確認する
- `docs/imp/constraints.md` : スコープ外、禁止事項。
- `docs/spec/08-security-quality-operations.md` : 監視とアラート。
- `docs/init/kenen.md` : 潜在的なリスク。
