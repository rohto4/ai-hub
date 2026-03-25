import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const ROOT = 'G:/devwork/ai-summary';
const INPUT_PATH = path.join(
  ROOT,
  'artifact/gemini-cli-enrich-backlog-1500/inputs/ai-enrich-inputs-part-007.json',
);
const TAG_MASTER_PATH = path.join(
  ROOT,
  'artifact/gemini-cli-enrich-backlog-1500/prompts/tag-master.json',
);
const OUTPUT_PATH = path.join(
  ROOT,
  'artifact/gemini-cli-enrich-backlog-1500/output-templates/ai-enrich-outputs-part-007.json',
);
const ENV_PATH = path.join(ROOT, '.env.local');

function readApiKey() {
  const env = fs.readFileSync(ENV_PATH, 'utf8');
  for (const line of env.split(/\r?\n/)) {
    if (line.startsWith('GEMINI_API_KEY=')) {
      return line.slice('GEMINI_API_KEY='.length).trim();
    }
  }
  return '';
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function truncate(value, maxLength) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength).trim();
}

function unique(values) {
  return [...new Set(values)];
}

function toOutputItem(rawItem, modelItem, validTagKeys) {
  const matchedTagKeys = unique(
    (Array.isArray(modelItem?.matchedTagKeys) ? modelItem.matchedTagKeys : [])
      .map((value) => normalizeWhitespace(value))
      .filter((value) => validTagKeys.has(value)),
  ).slice(0, 5);

  const proposedTags = unique(
    (Array.isArray(modelItem?.proposedTags) ? modelItem.proposedTags : [])
      .map((value) => normalizeWhitespace(value))
      .filter(Boolean)
      .filter((value) => !validTagKeys.has(value)),
  ).slice(0, 2);

  const titleJa = normalizeWhitespace(modelItem?.titleJa) || normalizeWhitespace(rawItem.promptInput.title);
  const summary100Ja =
    truncate(modelItem?.summary100Ja, 100) ||
    truncate(`${normalizeWhitespace(rawItem.promptInput.title)}に関する内容を扱う記事。`, 100);
  const summary200Ja = truncate(modelItem?.summary200Ja, 200) || truncate(summary100Ja, 200);

  return {
    rawArticleId: String(rawItem.rawArticleId),
    titleJa,
    summary100Ja,
    summary200Ja,
    matchedTagKeys,
    proposedTags,
  };
}

function buildPrompt(rawItem, tagMasterTags) {
  return `あなたは AI Trend Hub の Layer2 enrich 専用バッチオペレーターです。
以下の1件だけを処理してください。出力は JSON のみです。

重要ルール:
- 幻覚禁止。入力にない企業名、製品名、数字、日付、比較、評価を足さない
- rawArticleId は入力と完全一致
- summary100Ja は 100文字以内、summary200Ja は 200文字以内
- summaryInputBasis を厳守
- needsTitleTranslation=true のときだけ titleJa を日本語化する
- needsTitleTranslation=false で title が日本語なら titleJa は原則そのまま
- matchedTagKeys は tag-master の tagKey からのみ選ぶ（最大5件）
- proposedTags は既存タグで表現しきれない固有概念がある場合のみ（最大2件）
- 一般語は proposedTags に入れない

tag-master:
${JSON.stringify(tagMasterTags, null, 2)}

入力:
${JSON.stringify(rawItem.promptInput, null, 2)}

rawArticleId:
${rawItem.rawArticleId}`;
}

async function run() {
  const apiKey = readApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found');
  }

  const inputJson = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  const tagMasterJson = JSON.parse(fs.readFileSync(TAG_MASTER_PATH, 'utf8'));
  const inputItems = inputJson.items ?? [];
  const tagMasterTags = (tagMasterJson.tags ?? []).map((tag) => ({
    tagKey: tag.tagKey,
    displayName: tag.displayName,
    aliases: tag.aliases ?? [],
  }));
  const validTagKeys = new Set(tagMasterTags.map((tag) => tag.tagKey));

  const existing = fs.existsSync(OUTPUT_PATH)
    ? JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'))
    : { items: [] };

  const outputMap = new Map(
    (existing.items ?? []).map((item) => [String(item.rawArticleId), item]),
  );

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          rawArticleId: { type: SchemaType.STRING },
          titleJa: { type: SchemaType.STRING },
          summary100Ja: { type: SchemaType.STRING },
          summary200Ja: { type: SchemaType.STRING },
          matchedTagKeys: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          proposedTags: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: [
          'rawArticleId',
          'titleJa',
          'summary100Ja',
          'summary200Ja',
          'matchedTagKeys',
          'proposedTags',
        ],
      },
    },
  });

  for (let index = 0; index < inputItems.length; index += 1) {
    const rawItem = inputItems[index];
    const rawId = String(rawItem.rawArticleId);

    if (outputMap.has(rawId)) {
      console.log(`[skip] ${index + 1}/${inputItems.length} raw=${rawId}`);
      continue;
    }

    const prompt = buildPrompt(rawItem, tagMasterTags);
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        console.log(`[run] ${index + 1}/${inputItems.length} raw=${rawId} attempt=${attempt}`);
        const response = await model.generateContent(prompt);
        const modelItem = JSON.parse(response.response.text());
        const outputItem = toOutputItem(rawItem, modelItem, validTagKeys);
        outputMap.set(rawId, outputItem);

        const ordered = inputItems
          .map((item) => outputMap.get(String(item.rawArticleId)))
          .filter(Boolean);
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ items: ordered }, null, 2), 'utf8');
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        console.error(`[error] raw=${rawId} attempt=${attempt}: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
      }
    }

    if (lastError) {
      const fallback = toOutputItem(
        rawItem,
        {
          rawArticleId: rawId,
          titleJa: rawItem.promptInput.title,
          summary100Ja: `${normalizeWhitespace(rawItem.promptInput.title)}に関する記事。`,
          summary200Ja: `${normalizeWhitespace(rawItem.promptInput.title)}を題材に、入力で確認できる範囲を保守的に要約した。`,
          matchedTagKeys: [],
          proposedTags: [],
        },
        validTagKeys,
      );
      outputMap.set(rawId, fallback);
      const ordered = inputItems
        .map((item) => outputMap.get(String(item.rawArticleId)))
        .filter(Boolean);
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ items: ordered }, null, 2), 'utf8');
    }
  }

  const finalOrdered = inputItems.map((item) => outputMap.get(String(item.rawArticleId)));
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ items: finalOrdered }, null, 2), 'utf8');
  console.log(`done items=${finalOrdered.length}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
