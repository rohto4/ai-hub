import fs from 'fs';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const envLocal = fs.readFileSync('.env.local', 'utf8');
let apiKey = '';
for (const line of envLocal.split('\n')) {
  if (line.startsWith('GEMINI_API_KEY=')) {
    apiKey = line.split('=')[1].trim();
  }
}

if (!apiKey) {
  console.error("No API key found");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 0.1,
    responseMimeType: "application/json",
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        rawArticleId: { type: SchemaType.STRING },
        titleJa: { type: SchemaType.STRING },
        summary100Ja: { type: SchemaType.STRING },
        summary200Ja: { type: SchemaType.STRING },
        properNounTags: { 
          type: SchemaType.ARRAY, 
          items: { type: SchemaType.STRING } 
        }
      },
      required: ["rawArticleId", "titleJa", "summary100Ja", "summary200Ja", "properNounTags"]
    }
  }
});

const inputData = JSON.parse(fs.readFileSync('G:/devwork/ai-summary/artifact/gemini-cli-enrich-backlog-1500/inputs/ai-enrich-inputs-part-001.json', 'utf8'));

const outPath = 'G:/devwork/ai-summary/artifact/gemini-cli-enrich-backlog-1500/output-templates/ai-enrich-outputs-part-001.json';

const BATCH_SIZE = 10;
const processedItems = [];

async function processItem(item) {
  const prompt = `あなたは AI Trend Hub の Layer2 enrich 専用バッチです。
以下の記事データを処理し、日本語タイトルと要約を作成してください。

最重要ルール:
- 出力は JSON のみ
- 幻覚を避けて入力に忠実に
- summary100Ja は 100 文字以内、summary200Ja は 200 文字以内
- 入力に無い会社名・製品名・数字・時系列・効果を補わない
- summaryInputBasis を厳守する
  - full_content: content を主素材にするが、本文に無いことは足さない
  - source_snippet: title と content の両方に整合する内容だけを書く
  - title_only: title と content に明示されている最小限だけを書く
- needsTitleTranslation=true のときだけ titleJa を日本語化する (falseで日本語ならそのまま)
- properNounTags は最大 5 件、英語小文字、製品名・企業名・技術名・モデル名・ライブラリ名に限る (ai, llm, api など一般語は除外)
- 情報不足なら短く保守的に書く。空欄にしない。

入力データ:
rawArticleId: ${item.rawArticleId}
title: ${item.promptInput.title}
content: ${item.promptInput.content}
summaryInputBasis: ${item.promptInput.summaryInputBasis}
needsTitleTranslation: ${item.promptInput.needsTitleTranslation}
`;

  try {
    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error(`Error processing ${item.rawArticleId}:`, e);
    // Fallback if error
    return {
      rawArticleId: item.rawArticleId,
      titleJa: item.promptInput.title,
      summary100Ja: "情報抽出エラー",
      summary200Ja: "情報抽出エラー",
      properNounTags: []
    };
  }
}

async function run() {
  console.log(`Processing ${inputData.items.length} items...`);
  const items = inputData.items;
  
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${i/BATCH_SIZE + 1}/${Math.ceil(items.length/BATCH_SIZE)}...`);
    const results = await Promise.all(batch.map(processItem));
    processedItems.push(...results);
    
    // Save progress
    fs.writeFileSync(outPath, JSON.stringify({ items: processedItems }, null, 2), 'utf8');
  }
  
  console.log("Done!");
}

run();
