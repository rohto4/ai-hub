# AI Retag Prompt

## Goal
全記事に対して、以下を返してください。
1. 本タグ（primary）: 0〜5件（推奨は5件）
2. 隣接分野タグ（adjacent）: 0〜2件
3. 判定根拠キーワード（primaryEvidenceKeywords / adjacentEvidenceKeywords）
4. 既存マスタに無い妥当タグ候補（proposedPrimaryTags / proposedAdjacentTags）

## Hard Constraints
- `primaryTagKeys` は既存タグマスタの `tag_key` を優先する
- `adjacentTagKeys` は隣接タグマスタの `tag_key` のみ
- `primaryTagKeys` は最大5件
- `adjacentTagKeys` は最大2件
- 根拠キーワードは必ず本文（title/summary100/summary200）由来

## Output Format
- output-template と同一JSON形式で返却
- `enrichedArticleId` の欠落・重複は禁止

## Phase 1 Policy
- 1周目はカテゴリ確定ではなく、属性としての全件再構築を目的にする
- primaryTagKeys は固有名詞・製品名・企業名・モデル名・OSS名を優先する
- 抽象タグや分類タグは primaryTagKeys に入れない
- primary から完全除外するタグ: llm, generative-ai, rag, agent, huggingface, hugging-face, paper, policy, safety
- 将来カテゴリ候補として観察する値: paper, official, news, search-rag, oss, enterprise-ai
- proposedPrimaryTags でも除外タグと同義の提案は出さない
- title / summary100 / summary200 の明示的な語だけを根拠にする

## Existing Masters
- primaryTagMaster: `af-20260326/phase1-retag/prompts/primary-tag-master.json`
- adjacentTagMaster: `af-20260326/phase1-retag/prompts/adjacent-tag-master.json`
