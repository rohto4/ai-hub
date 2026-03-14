# source_targets 候補メモ

最終更新: 2026-03-13

## 1. 目的

このメモは、`source_targets` の初期 seed を決める前段として、候補取得元を 20〜30 件レベルで並べるためのものです。  
P0 の原則どおり、まずは **RSS / Atom / 公式 API / 利用条件が読みやすい公開面** を優先し、HTML 巡回しかないものは次点候補として扱います。

## 2. 見方

- `取得方法`
  - `RSS/Atom`: feed reader 的に取りやすい
  - `API`: 公式 API あり
  - `HTML`: 公開ページ巡回。P0 では優先度低め
- `前提条件`
  - アカウント作成、API キー、手動セットアップの有無
- `初期採用`
  - `◎`: 初期 seed 候補として強い
  - `○`: 追加候補
  - `△`: 後回し候補

## 3. Google Alerts の推奨設計

### 3.1 方針

1. Google Alerts は 1 語 1 本ではなく、近い話題群をまとめて 1 本にする
2. ただし企業や製品群をまたいで広く混ぜすぎない
3. `source_targets` として品質管理できる粒度を保つ

### 3.2 初期推奨クエリ

1. `OpenAI OR ChatGPT OR Codex`
   - 用途: OpenAI 製品群
   - 補足: OpenAI 関連の話題はこれでかなり拾える

2. `Anthropic OR Claude OR Cowork`
   - 用途: Anthropic 製品群
   - 補足: Claude 本体に加え、2026 年時点で話題化している Cowork も追える

3. `Gemini OR "Google AI Studio"`
   - 用途: Gemini 製品群
   - 補足: Gemini 本体と開発者向け更新を同時に拾える

4. `"AI agent" OR "AI agents" OR "AIエージェント" OR "coding agent" OR "coding agents" OR "agentic AI" OR "agentic coding"`
   - 用途: Agent 系の横断トピック
   - 補足: 実装・運用ノウハウまで拾いやすい

5. `RAG OR "retrieval augmented generation" OR "retrieval-augmented generation" OR "検索拡張生成"`
   - 用途: 検索拡張生成
   - 補足: 実装寄り記事を拾うのに向く

6. `"voice AI" OR "voice agent" OR "speech to speech" OR "voice assistant" OR "音声AI" OR "音声エージェント"`
   - 用途: 音声 AI / 音声エージェント
   - 補足: 音声 UX や通話要約系の変化を追える

7. `"AI safety" OR "model safety" OR "LLM safety" OR "AI alignment" OR "red teaming" OR "AI evaluation"`
   - 用途: safety / governance 系
   - 補足: 導入判断に必要な評価・安全性情報を拾える

8. `"AI regulation" OR "AI policy" OR "AI Act" OR "AI governance" OR "AI law" OR "AI規制" OR "生成AI 規制"`
   - 用途: 規制 / 政策系
   - 補足: 運用や説明責任に影響する話題を拾う

9. `Antigravity`


https://www.google.com/alerts/feeds/03032972658729420425/1546181015068281061
https://www.google.com/alerts/feeds/03032972658729420425/16203284553843939981
https://www.google.com/alerts/feeds/03032972658729420425/14504957906878978853
https://www.google.com/alerts/feeds/03032972658729420425/6373579163630166292
https://www.google.com/alerts/feeds/03032972658729420425/11283218415457465409
https://www.google.com/alerts/feeds/03032972658729420425/13098842776851540914
https://www.google.com/alerts/feeds/03032972658729420425/4650888718584175059
https://www.google.com/alerts/feeds/03032972658729420425/4748134521054786223
https://www.google.com/alerts/feeds/03032972658729420425/13334698373516515488

### 3.2.1 RSS URL 対応表

1. `voice AI / voice agent / speech to speech / voice assistant / 音声AI / 音声エージェント`
   - `display_name`: `Google Alerts: Voice AI / Voice Agent`
   - `source_key`: `google-alerts-voice-ai-voice-agent`
   - `fetch_kind`: `alerts`
   - `source_category`: `voice`
   - `base_url`: `https://www.google.com/alerts/feeds/03032972658729420425/1546181015068281061`

2. `AI agent / AI agents / AIエージェント / coding agent / coding agents / agentic AI / agentic coding`
   - `display_name`: `Google Alerts: AI Agents / Coding Agents`
   - `source_key`: `google-alerts-ai-agents-coding-agents`
   - `fetch_kind`: `alerts`
   - `source_category`: `agent`
   - `base_url`: `https://www.google.com/alerts/feeds/03032972658729420425/16203284553843939981`

3. `AI regulation / AI policy / AI Act / AI governance / AI law / AI規制 / 生成AI 規制`
   - `display_name`: `Google Alerts: AI Regulation / Policy`
   - `source_key`: `google-alerts-ai-regulation-policy`
   - `fetch_kind`: `alerts`
   - `source_category`: `policy`
   - `base_url`: `https://www.google.com/alerts/feeds/03032972658729420425/14504957906878978853`

4. `AI safety / model safety / LLM safety / AI alignment / red teaming / AI evaluation`
   - `display_name`: `Google Alerts: AI Safety / Alignment`
   - `source_key`: `google-alerts-ai-safety-alignment`
   - `fetch_kind`: `alerts`
   - `source_category`: `safety`
   - `base_url`: `https://www.google.com/alerts/feeds/03032972658729420425/6373579163630166292`

5. `Anthropic / Claude / Cowork`
   - `display_name`: `Google Alerts: Anthropic / Claude / Cowork`
   - `source_key`: `google-alerts-anthropic-claude-cowork`
   - `fetch_kind`: `alerts`
   - `source_category`: `llm`
   - `base_url`: `https://www.google.com/alerts/feeds/03032972658729420425/11283218415457465409`

6. `Antigravity`
   - `display_name`: `Google Alerts: Antigravity`
   - `source_key`: `google-alerts-antigravity`
   - `fetch_kind`: `alerts`
   - `source_category`: `agent`
   - `base_url`: `https://www.google.com/alerts/feeds/03032972658729420425/13098842776851540914`

7. `Gemini / Google AI Studio`
   - `display_name`: `Google Alerts: Gemini / Google AI Studio`
   - `source_key`: `google-alerts-gemini-google-ai-studio`
   - `fetch_kind`: `alerts`
   - `source_category`: `llm`
   - `base_url`: `https://www.google.com/alerts/feeds/03032972658729420425/4650888718584175059`

8. `OpenAI / ChatGPT / Codex`
   - `display_name`: `Google Alerts: OpenAI / ChatGPT / Codex`
   - `source_key`: `google-alerts-openai-chatgpt-codex`
   - `fetch_kind`: `alerts`
   - `source_category`: `llm`
   - `base_url`: `https://www.google.com/alerts/feeds/03032972658729420425/4748134521054786223`

9. `RAG / retrieval augmented generation / retrieval-augmented generation / 検索拡張生成`
   - `display_name`: `Google Alerts: RAG / Retrieval-Augmented Generation`
   - `source_key`: `google-alerts-rag-retrieval-augmented-generation`
   - `fetch_kind`: `alerts`
   - `source_category`: `search`
   - `base_url`: `https://www.google.com/alerts/feeds/03032972658729420425/13334698373516515488`


### 3.3 避けたいクエリ

1. `OpenAI OR ChatGPT OR Codex OR Anthropic OR Claude OR Gemini`
   - 広すぎて source 単位の品質管理がしにくい

2. `AI`
   - ノイズが多すぎる

3. 1 社 1 製品ごとに細かく分けすぎた大量の Alert
   - 初期運用コストが上がりやすい

## 4. 初期採用推奨候補

### 4.1 まず入れやすいもの

1. Google Alerts: `OpenAI OR ChatGPT OR Codex`
   - 取得方法: RSS
   - 前提条件: Google アカウントで Alert 作成が必要
   - 補足: OpenAI 製品群をまとめて追える
   - 初期採用: ◎

2. Google Alerts: `Anthropic OR Claude OR Cowork`
   - 取得方法: RSS
   - 前提条件: Google アカウントで Alert 作成が必要
   - 補足: Anthropic 製品群に加え、Cowork の更新も追える
   - 初期採用: ◎

3. Google Alerts: `Gemini OR "Google AI Studio"`
   - 取得方法: RSS
   - 前提条件: Google アカウントで Alert 作成が必要
   - 補足: `Google AI` まで広げず、Gemini 製品群に寄せて拾う
   - 初期採用: ◎

4. Google Alerts: `"AI agent" OR "AI agents" OR "AIエージェント" OR "coding agent" OR "coding agents" OR "agentic AI" OR "agentic coding"`
   - 取得方法: RSS
   - 前提条件: Google アカウントで Alert 作成が必要
   - 補足: Agent 系の横断トピック用。P0 の母集団として重要
   - 初期採用: ◎

5. Google Alerts: `RAG OR "retrieval augmented generation"`
   - 取得方法: RSS
   - 前提条件: Google アカウントで Alert 作成が必要
   - 補足: 実装寄りの話題を拾いやすい
   - 初期採用: ○

6. Hugging Face Blog
   - 取得方法: RSS/Atom
   - 前提条件: なし
   - 補足: `https://huggingface.co/blog/feed.xml` がある。モデル、OSS、評価、推論周りを広く拾える
   - 初期採用: ◎

7. Replicate Blog
   - 取得方法: RSS/Atom
   - 前提条件: なし
   - 補足: `blog/rss`, `blog/atom` が明示されている。実装・運用視点が強い
   - 初期採用: ◎

8. NVIDIA Blog
   - 取得方法: RSS
   - 前提条件: なし
   - 補足: AI ハードウェア、推論基盤、企業導入の変化を拾える
   - 初期採用: ○

9. NVIDIA Developer Blog
   - 取得方法: RSS
   - 前提条件: なし
   - 補足: 実装記事が多く、開発者向けの signal が強い
   - 初期採用: ○

10. arXiv `cs.AI`
    - 取得方法: API
    - 前提条件: なし
    - 補足: 論文系の新着取得。要約コストが上がるため件数制限が必要
    - 初期採用: ◎

11. arXiv `cs.CL`
    - 取得方法: API
    - 前提条件: なし
    - 補足: LLM / NLP の中心カテゴリ
    - 初期採用: ◎

12. arXiv `cs.LG`
    - 取得方法: API
    - 前提条件: なし
    - 補足: 広く拾いすぎやすいので件数制限前提
    - 初期採用: ○

13. Hacker News
    - 取得方法: API
    - 前提条件: なし
    - 補足: 公式 API あり。`AI`, `agent`, `LLM`, `OpenAI`, `Anthropic` などで後段フィルタする想定
    - 初期採用: ○

14. GitHub Releases: `ggerganov/llama.cpp`
    - 取得方法: Atom
    - 前提条件: なし
    - 補足: OSS 推論基盤の変化を追える
    - 初期採用: ◎

15. GitHub Releases: `ollama/ollama`
    - 取得方法: Atom
    - 前提条件: なし
    - 補足: ローカル実行系の signal が強い
    - 初期採用: ○

16. GitHub Releases: `vllm-project/vllm`
    - 取得方法: Atom
    - 前提条件: なし
    - 補足: 推論サーバーの更新追跡に有効
    - 初期採用: ◎

17. GitHub Releases: `huggingface/transformers`
    - 取得方法: Atom
    - 前提条件: なし
    - 補足: 幅広い OSS エコシステム更新の signal になる
    - 初期採用: ○

18. GitHub Releases: `langchain-ai/langchain`
    - 取得方法: Atom
    - 前提条件: なし
    - 補足: Agent 実装周辺の変化を追いやすい
    - 初期採用: ○

## 5. 拡張候補

### 5.1 公式サイト系

19. OpenAI News / Index
    - 取得方法: HTML または RSS 要確認
    - 前提条件: なし
    - 補足: 企業公式の一次情報。feed 形式の最終採用は実装前に再確認
    - 初期採用: ○

20. Anthropic News
    - 取得方法: HTML
    - 前提条件: なし
    - 補足: 企業公式の一次情報。RSS が明示されていないため P0 では次点
    - 初期採用: ○

21. Anthropic Alignment Science Blog
    - 取得方法: HTML
    - 前提条件: なし
    - 補足: 研究・安全性の signal が濃い
    - 初期採用: △

22. Google Blog AI
    - 取得方法: HTML
    - 前提条件: なし
    - 補足: プロダクト、研究、政策が混在。分類前提で使う
    - 初期採用: ○

23. Google DeepMind Blog
    - 取得方法: HTML
    - 前提条件: なし
    - 補足: 研究 / 応用 / policy が混在。論文系とは別軸で有用
    - 初期採用: ○

24. Google AI for Developers
    - 取得方法: HTML
    - 前提条件: なし
    - 補足: Gemini API や開発者向け更新の一次情報
    - 初期採用: ○

25. Meta Newsroom `AI` タグ
    - 取得方法: HTML
    - 前提条件: なし
    - 補足: Meta AI / Llama / wearable 系を拾える
    - 初期採用: △

26. AWS Machine Learning Blog
    - 取得方法: HTML または RSS 要確認
    - 前提条件: なし
    - 補足: Bedrock、SageMaker、運用事例の signal がある
    - 初期採用: △

27. Microsoft Official Blog `AI`
    - 取得方法: HTML
    - 前提条件: なし
    - 補足: Copilot、Azure AI、企業導入系の情報が多い
    - 初期採用: △

28. Mistral AI News
    - 取得方法: HTML
    - 前提条件: なし
    - 補足: プロダクト更新は濃いが feed 形式は要確認
    - 初期採用: ○

29. Stability AI News
    - 取得方法: HTML
    - 前提条件: なし
    - 補足: 画像 / 音声 / enterprise 提携周りの signal を拾える
    - 初期採用: △

30. Together AI Blog
    - 取得方法: HTML
    - 前提条件: なし
    - 補足: OSS 学習 / 推論基盤寄り
    - 初期採用: △

31. Cohere Labs Research
    - 取得方法: HTML
    - 前提条件: なし
    - 補足: 研究色が強い。一般プロダクト news とは別扱いが必要
    - 初期採用: △

### 5.2 API / 認証が絡む候補

32. Google Trends
    - 取得方法: 非公式取得になりやすいため慎重
    - 前提条件: 実装方法の再検討が必要
    - 補足: タグ昇格判定で使いたいが、source_targets の一次取得元としては扱わない方がよい
    - 初期採用: △

33. OpenAI API
    - 取得方法: API
    - 前提条件: OpenAI アカウント、API キー、課金設定
    - 補足: これは「収集元」より要約・分類用の実行基盤候補
    - 初期採用: △

34. Anthropic API
    - 取得方法: API
    - 前提条件: Anthropic Console、API キー
    - 補足: これも source というより要約・分類用
    - 初期採用: △

35. Gemini API
    - 取得方法: API
    - 前提条件: Google AI Studio または Google Cloud、API キー
    - 補足: これも source ではなく要約・分類用の候補
    - 初期採用: △

36. Hugging Face Hub API
    - 取得方法: API
    - 前提条件: 読み取り系は公開 endpoint 多め。書き込みや一部取得で token が必要
    - 補足: モデル / dataset 更新監視に使えるが、P0 は blog と releases を先に使う方が軽い
    - 初期採用: △

37. Replicate API / Search API
    - 取得方法: API
    - 前提条件: Replicate アカウント、API token
    - 補足: blog/rss より先に入れる必要は薄い
    - 初期採用: △

## 6. 初期 seed のおすすめ絞り込み

### 6.1 まず 8〜12 件で始めるなら

1. Google Alerts: `"AI agent" OR "AI agents" OR "AIエージェント" OR "coding agent" OR "coding agents" OR "agentic AI" OR "agentic coding"`
2. Google Alerts: `OpenAI OR ChatGPT OR Codex`
3. Google Alerts: `Anthropic OR Claude OR Cowork`
4. Google Alerts: `Gemini OR "Google AI Studio"`
5. Hugging Face Blog
6. Replicate Blog
7. NVIDIA Developer Blog
8. arXiv `cs.CL`
9. arXiv `cs.AI`
10. GitHub Releases: `llama.cpp`
11. GitHub Releases: `vllm`
12. Hacker News

### 6.2 その次に足す候補

1. GitHub Releases: `ollama`
2. GitHub Releases: `transformers`
3. GitHub Releases: `langchain`
4. OpenAI News / Index
5. Anthropic News
6. Google DeepMind Blog
7. Mistral AI News

## 7. 実装前に決めること

1. Google Alerts を何本まで許容するか
2. GitHub Releases を何 repo まで監視するか
3. arXiv を日次で何件までに制限するか
4. HTML 巡回系を P0 に入れるか、P1 へ送るか
5. `source_category` の分類語彙をどう固定するか

## 8. 実装メモ

1. P0 の初期 seed は RSS / Atom / API だけで始めた方が安全
2. HTML 巡回系は `manual` または後続 collector として分ける方がよい
3. `source_targets` は開発用 seed と本番用 seed を分けた方がよい
4. Google Alerts は account 依存があるため、再現手順を `setup-guide.md` に残すべき
