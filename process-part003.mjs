import fs from 'fs';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const ENV_PATH = 'G:/devwork/ai-summary/.env.local';
const INPUT_PATH = 'G:/devwork/ai-summary/artifact/gemini-cli-enrich-backlog-1500/inputs/ai-enrich-inputs-part-003.json';
const TAG_MASTER_PATH = 'G:/devwork/ai-summary/artifact/gemini-cli-enrich-backlog-1500/prompts/tag-master.json';
const OUT_PATH = 'G:/devwork/ai-summary/artifact/gemini-cli-enrich-backlog-1500/output-templates/ai-enrich-outputs-part-003.json';

const BATCH_SIZE = 8;
const MAX_RETRY = 3;

function loadApiKey() {
  const envLocal = fs.readFileSync(ENV_PATH, 'utf8');
  for (const rawLine of envLocal.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    if (line.startsWith('GEMINI_API_KEY=')) {
      return line.slice('GEMINI_API_KEY='.length).trim();
    }
  }
  return '';
}

function toCharLimitedText(text, maxChars) {
  const src = (text || '').replace(/\s+/g, ' ').trim();
  if (src.length <= maxChars) {
    return src;
  }
  const candidate = src.slice(0, maxChars);
  const punctuations = ['。', '！', '？', '.', '!', '?', '）', ')'];
  let cut = -1;
  for (const p of punctuations) {
    const idx = candidate.lastIndexOf(p);
    if (idx > cut) {
      cut = idx;
    }
  }
  if (cut >= Math.floor(maxChars * 0.6)) {
    return candidate.slice(0, cut + 1).trim();
  }
  return candidate.trim().replace(/[、。！!？?・,:;]$/, '');
}

function hasJapanese(text) {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text || '');
}

function uniqueInOrder(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

function buildTagMaster(tagMasterJson) {
  const tags = Array.isArray(tagMasterJson?.tags) ? tagMasterJson.tags : [];
  const keySet = new Set();
  const aliasToKey = new Map();
  const idToKey = new Map();
  const keyToAliases = new Map();

  for (const tag of tags) {
    const key = String(tag?.tagKey || '').trim();
    if (!key) {
      continue;
    }
    keySet.add(key);
    idToKey.set(String(tag?.id || '').trim(), key);
    keyToAliases.set(key, [
      key,
      String(tag?.displayName || '').trim(),
      ...(Array.isArray(tag?.aliases) ? tag.aliases : [])
    ].filter(Boolean));

    aliasToKey.set(key.toLowerCase(), key);
    aliasToKey.set(String(tag?.displayName || '').trim().toLowerCase(), key);
    for (const alias of Array.isArray(tag?.aliases) ? tag.aliases : []) {
      const normalized = String(alias || '').trim().toLowerCase();
      if (normalized) {
        aliasToKey.set(normalized, key);
      }
    }
  }

  const tagCatalogText = tags
    .map((tag) => {
      const key = String(tag?.tagKey || '').trim();
      const aliases = Array.isArray(tag?.aliases) ? tag.aliases.filter(Boolean).join(', ') : '';
      return aliases ? `${key} (aliases: ${aliases})` : key;
    })
    .join('\n');

  return { keySet, aliasToKey, idToKey, keyToAliases, tagCatalogText };
}

function hasTagEvidence(textLower, aliases) {
  for (const alias of aliases) {
    const word = String(alias || '').trim().toLowerCase();
    if (!word) {
      continue;
    }
    if (textLower.includes(word)) {
      return true;
    }
  }
  return false;
}

function normalizeMatchedTagKeys(raw, tagMaster, item) {
  const input = Array.isArray(raw) ? raw : [];
  const mapped = [];
  for (const value of input) {
    const normalized = String(value || '').trim();
    if (!normalized) {
      continue;
    }
    if (tagMaster.keySet.has(normalized)) {
      mapped.push(normalized);
      continue;
    }
    const alias = tagMaster.aliasToKey.get(normalized.toLowerCase());
    if (alias) {
      mapped.push(alias);
    }
  }

  const evidenceText = `${String(item?.promptInput?.title || '')}\n${String(item?.normalizedSnippet || item?.promptInput?.content || '')}`.toLowerCase();
  const evidenceFiltered = mapped.filter((key) => hasTagEvidence(evidenceText, tagMaster.keyToAliases.get(key) || [key]));

  const merged = uniqueInOrder(evidenceFiltered);

  if (String(item?.sourceType || '').toLowerCase() === 'paper' && tagMaster.keySet.has('paper')) {
    merged.unshift('paper');
  }

  if (/llm|language model|gpt|gemini|claude|agent/i.test(evidenceText) && tagMaster.keySet.has('llm')) {
    merged.push('llm');
  }

  if (merged.length < 1) {
    if (String(item?.sourceCategory || '').toLowerCase() === 'llm' && tagMaster.keySet.has('llm')) {
      merged.push('llm');
    } else if (tagMaster.keySet.has('generative-ai')) {
      merged.push('generative-ai');
    }
  }

  return uniqueInOrder(merged).slice(0, 5);
}

function normalizeProposedTags(raw, tagMaster, matchedTagKeys) {
  const input = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const value of input) {
    const tag = String(value || '').trim();
    if (!tag) {
      continue;
    }
    const lowered = tag.toLowerCase();
    if (tagMaster.keySet.has(tag) || tagMaster.aliasToKey.has(lowered)) {
      continue;
    }
    if (matchedTagKeys.some((k) => k.toLowerCase() === lowered)) {
      continue;
    }
    if (!/^[a-z0-9][a-z0-9\- ]{1,39}$/.test(lowered)) {
      continue;
    }
    if (['ai', 'llm', 'model', 'paper', 'news', 'update', 'tech'].includes(lowered)) {
      continue;
    }
    out.push(lowered);
  }
  return uniqueInOrder(out).slice(0, 2);
}

function fallbackItem(item, tagMaster) {
  const inputTitle = String(item?.promptInput?.title || '').trim();
  const needsTranslation = Boolean(item?.promptInput?.needsTitleTranslation);
  const titleJa = !needsTranslation && hasJapanese(inputTitle) ? inputTitle : inputTitle || 'タイトル不明';

  const basis = String(item?.promptInput?.summaryInputBasis || '').trim();
  const source = String(item?.promptInput?.content || '').replace(/\s+/g, ' ').trim();
  const minSummary = basis
    ? `${basis}ベースで記事情報を確認。詳細は入力本文を参照。`
    : '記事情報を確認。詳細は入力本文を参照。';
  const summary100Ja = toCharLimitedText(source ? minSummary : '入力情報が限定的なため、記事概要のみ確認。', 100);
  const summary200Ja = toCharLimitedText(source ? `${minSummary} タイトルと本文の範囲で保守的に整理。` : '入力情報が限定的なため、タイトルと本文で確認できる範囲のみ整理。', 200);
  const matchedTagKeys = normalizeMatchedTagKeys([], tagMaster, item);
  return {
    rawArticleId: String(item.rawArticleId),
    titleJa,
    summary100Ja,
    summary200Ja,
    matchedTagKeys,
    proposedTags: []
  };
}

function normalizeModelOutput(rawOutput, item, tagMaster) {
  const out = rawOutput && typeof rawOutput === 'object' ? rawOutput : {};
  const inputTitle = String(item?.promptInput?.title || '').trim();
  const needsTranslation = Boolean(item?.promptInput?.needsTitleTranslation);

  let titleJa = String(out.titleJa || '').trim();
  if (!titleJa) {
    titleJa = inputTitle || 'タイトル不明';
  }
  if (!needsTranslation && hasJapanese(inputTitle)) {
    titleJa = inputTitle;
  }

  let summary100Ja = toCharLimitedText(String(out.summary100Ja || '').trim(), 100);
  let summary200Ja = toCharLimitedText(String(out.summary200Ja || '').trim(), 200);

  if (!summary100Ja) {
    summary100Ja = toCharLimitedText('入力本文に基づき、記事の要点を簡潔に整理。', 100);
  }
  if (!summary200Ja) {
    summary200Ja = toCharLimitedText('入力本文とタイトルに基づき、確認可能な範囲で記事内容を整理。', 200);
  }

  const matchedTagKeys = normalizeMatchedTagKeys(out.matchedTagKeys, tagMaster, item);
  const proposedTags = normalizeProposedTags(out.proposedTags, tagMaster, matchedTagKeys);

  return {
    rawArticleId: String(item.rawArticleId),
    titleJa,
    summary100Ja,
    summary200Ja,
    matchedTagKeys,
    proposedTags
  };
}

async function generateItem(model, item, tagMaster) {
  const promptInput = item?.promptInput || {};
  const contentForModel = String(item?.normalizedSnippet || promptInput.content || '');
  const prompt = `あなたは AI Trend Hub の Layer2 enrich 専用バッチオペレーターです。
以下の1件だけを処理し、JSONオブジェクトだけを返してください。

出力必須フィールド:
- rawArticleId (string)
- titleJa (string)
- summary100Ja (100文字以内)
- summary200Ja (200文字以内)
- matchedTagKeys (tag-masterのtagKeyのみ、最大5件)
- proposedTags (最大2件、不要なら空配列)

厳守ルール:
- 幻覚禁止。入力に無い企業名・製品名・数字・日付・効果を補わない
- summaryInputBasis を厳守
- needsTitleTranslation=true のときだけ titleJa を日本語化
- needsTitleTranslation=false かつ title が日本語なら titleJa はそのまま
- summary は自然な日本語で簡潔に。titleの機械的な焼き直しを避ける
- matchedTagKeys は以下 tagKey 一覧からのみ選択
- 既存タグで足りる場合は proposedTags を使わない

tag-master (tagKey 一覧):
${tagMaster.tagCatalogText}

入力:
rawArticleId: ${item.rawArticleId}
title: ${promptInput.title || ''}
content: ${contentForModel}
summaryInputBasis: ${promptInput.summaryInputBasis || ''}
needsTitleTranslation: ${String(Boolean(promptInput.needsTitleTranslation))}
`;

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt += 1) {
    try {
      const result = await model.generateContent(prompt);
      const text = result?.response?.text?.() || '{}';
      const parsed = JSON.parse(text);
      return normalizeModelOutput(parsed, item, tagMaster);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }

  console.error(`Fallback used for rawArticleId=${item.rawArticleId}`, lastError);
  return fallbackItem(item, tagMaster);
}

function validateOutput(output, inputItems, tagMaster) {
  if (!output || !Array.isArray(output.items)) {
    throw new Error('Output JSON shape invalid');
  }
  if (output.items.length !== inputItems.length) {
    throw new Error(`Item count mismatch: input=${inputItems.length}, output=${output.items.length}`);
  }

  const inputIds = inputItems.map((i) => String(i.rawArticleId));
  const outputIds = output.items.map((i) => String(i.rawArticleId));
  for (let i = 0; i < inputIds.length; i += 1) {
    if (inputIds[i] !== outputIds[i]) {
      throw new Error(`rawArticleId mismatch at index ${i}: input=${inputIds[i]} output=${outputIds[i]}`);
    }
  }

  for (const item of output.items) {
    if (!item.titleJa || !item.summary100Ja || !item.summary200Ja) {
      throw new Error(`Empty field detected: rawArticleId=${item.rawArticleId}`);
    }
    if (item.summary100Ja.length > 100) {
      throw new Error(`summary100Ja too long: rawArticleId=${item.rawArticleId}`);
    }
    if (item.summary200Ja.length > 200) {
      throw new Error(`summary200Ja too long: rawArticleId=${item.rawArticleId}`);
    }
    if (!Array.isArray(item.matchedTagKeys) || item.matchedTagKeys.length > 5) {
      throw new Error(`matchedTagKeys invalid: rawArticleId=${item.rawArticleId}`);
    }
    if (!Array.isArray(item.proposedTags) || item.proposedTags.length > 2) {
      throw new Error(`proposedTags invalid: rawArticleId=${item.rawArticleId}`);
    }
    for (const key of item.matchedTagKeys) {
      if (!tagMaster.keySet.has(key)) {
        throw new Error(`Unknown tagKey "${key}" at rawArticleId=${item.rawArticleId}`);
      }
    }
  }
}

async function run() {
  const apiKey = loadApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in .env.local');
  }

  const inputData = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  const tagMasterJson = JSON.parse(fs.readFileSync(TAG_MASTER_PATH, 'utf8'));
  const tagMaster = buildTagMaster(tagMasterJson);
  const items = Array.isArray(inputData?.items) ? inputData.items : [];

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
            items: { type: SchemaType.STRING }
          },
          proposedTags: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
          }
        },
        required: [
          'rawArticleId',
          'titleJa',
          'summary100Ja',
          'summary200Ja',
          'matchedTagKeys',
          'proposedTags'
        ]
      }
    }
  });

  const processed = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    console.log(`Processing ${i + 1}-${i + batch.length} / ${items.length}`);
    const results = await Promise.all(batch.map((item) => generateItem(model, item, tagMaster)));
    processed.push(...results);

    const partial = { items: processed };
    fs.writeFileSync(OUT_PATH, JSON.stringify(partial, null, 2), 'utf8');
  }

  const finalOutput = { items: processed };
  validateOutput(finalOutput, items, tagMaster);
  fs.writeFileSync(OUT_PATH, JSON.stringify(finalOutput, null, 2), 'utf8');
  console.log(`Done. Wrote ${processed.length} items to ${OUT_PATH}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
