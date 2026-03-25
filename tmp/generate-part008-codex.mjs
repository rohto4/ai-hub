import fs from 'node:fs/promises';
import path from 'node:path';

const root = 'G:/devwork/ai-summary';
const inputPath = path.join(root, 'artifact/gemini-cli-enrich-backlog-1500/inputs/ai-enrich-inputs-part-008.json');
const tagMasterPath = path.join(root, 'artifact/gemini-cli-enrich-backlog-1500/prompts/tag-master.json');
const outputPath = path.join(root, 'artifact/gemini-cli-enrich-backlog-1500/output-templates/ai-enrich-outputs-part-008.json');

const GENERIC_PROPOSED = new Set([
  'ai','ml','model','models','paper','papers','study','method','approach','framework','system','data','dataset','datasets',
  'result','results','analysis','research','learning','deep-learning','machine-learning','neural-network','gaussian','distribution',
  'private','mixture','words','anchors','semi-supervised','image'
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const normalize = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9+\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const slugify = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9+\-\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const truncate = (text, max) => {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  let out = t.slice(0, max);
  out = out.replace(/[、。,.\-\s]+$/u, '');
  if (!out.endsWith('。')) out += '。';
  return out.slice(0, max);
};

async function translateEnToJa(text) {
  const q = encodeURIComponent(text || '');
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=t&q=${q}`;
  for (let i = 0; i < 4; i += 1) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (!Array.isArray(body) || !Array.isArray(body[0])) throw new Error('Unexpected response shape');
      const ja = body[0].map((x) => (Array.isArray(x) ? x[0] : '')).join('').trim();
      if (!ja) throw new Error('Empty translation');
      return ja;
    } catch (e) {
      if (i === 3) return '';
      await sleep(600 * (i + 1));
    }
  }
  return '';
}

function extractAbstract(text) {
  const src = (text || '').replace(/\s+/g, ' ').trim();
  if (!src) return '';
  const m = src.match(/Abstract:\s*(.*?)(Comments:|Subjects:|Cite as:|Submission history|$)/i);
  if (m?.[1]) return m[1].trim();
  return src.slice(0, 900);
}

function splitSentences(text) {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildTagMaps(tagMaster) {
  const byId = new Map();
  const aliasToKey = new Map();
  const keySet = new Set();

  for (const tag of tagMaster.tags || []) {
    const key = String(tag.tagKey || '').trim();
    const id = String(tag.id || '').trim();
    if (!key) continue;
    if (id) byId.set(id, key);
    keySet.add(key);
    aliasToKey.set(normalize(key), key);
    for (const alias of tag.aliases || []) {
      const n = normalize(String(alias || ''));
      if (n) aliasToKey.set(n, key);
    }
  }

  return { byId, aliasToKey, keySet };
}

function pickTags(item, maps) {
  const out = [];
  const seen = new Set();

  for (const id of item.matchedTagIds || []) {
    const key = maps.byId.get(String(id));
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
    if (out.length >= 5) break;
  }

  for (const c of item.candidateTags || []) {
    if (out.length >= 5) break;
    const raw = String(c.candidateKey || c.displayName || '').trim();
    const key = maps.aliasToKey.get(normalize(raw));
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }

  if (String(item.sourceType || '').toLowerCase() === 'paper' && !seen.has('paper')) {
    out.unshift('paper');
  }

  return Array.from(new Set(out)).slice(0, 5);
}

function pickProposed(item, maps, matchedTagKeys) {
  const matched = new Set(matchedTagKeys);
  const proposed = [];

  for (const c of item.candidateTags || []) {
    if (proposed.length >= 2) break;
    const raw = String(c.candidateKey || c.displayName || '').trim();
    if (!raw) continue;
    const n = normalize(raw);
    if (maps.aliasToKey.has(n)) continue;

    const slug = slugify(raw);
    if (!slug || slug.length < 3 || slug.length > 40) continue;
    if (GENERIC_PROPOSED.has(slug)) continue;
    if (matched.has(slug)) continue;
    if (proposed.includes(slug)) continue;

    proposed.push(slug);
  }

  return proposed;
}

async function buildItem(item, maps, index, total) {
  const title = String(item.title || '').trim();
  const needsTranslation = Boolean(item.needsTitleTranslation);

  let titleJa = title;
  if (needsTranslation && title) {
    const translated = await translateEnToJa(title);
    titleJa = translated || title;
    await sleep(120);
  }

  const abstract = extractAbstract(item.summaryInputText || item.content || '');
  const sentences = splitSentences(abstract);
  const s1 = sentences[0] || `This article discusses ${title}.`;
  const s2 = sentences[1] || '';

  const ja100Raw = await translateEnToJa(s1);
  await sleep(120);

  const src200 = s2 ? `${s1} ${s2}` : `${s1} The summary is kept conservative based on the provided text.`;
  const ja200Raw = await translateEnToJa(src200);
  await sleep(120);

  let summary100Ja = truncate(ja100Raw || `本稿は「${titleJa.slice(0, 42)}」の要点を扱う。`, 100);
  let summary200Ja = truncate(ja200Raw || `本稿は「${titleJa.slice(0, 60)}」を主題とし、提供本文で確認できる範囲の手法と結果を要約する。`, 200);

  if (!summary100Ja) summary100Ja = truncate(`本稿は「${titleJa.slice(0, 42)}」の要点を扱う。`, 100);
  if (!summary200Ja) summary200Ja = truncate(`本稿は「${titleJa.slice(0, 60)}」を主題とし、提供本文で確認できる範囲の手法と結果を要約する。`, 200);

  const matchedTagKeys = pickTags(item, maps);
  const proposedTags = pickProposed(item, maps, matchedTagKeys);

  if ((index + 1) % 20 === 0 || index === 0 || index + 1 === total) {
    console.log(`[part008] ${index + 1}/${total} raw=${item.rawArticleId}`);
  }

  return {
    rawArticleId: item.rawArticleId,
    titleJa,
    summary100Ja,
    summary200Ja,
    matchedTagKeys,
    proposedTags,
  };
}

async function main() {
  const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const tagMaster = JSON.parse(await fs.readFile(tagMasterPath, 'utf8'));
  const maps = buildTagMaps(tagMaster);

  const items = [];
  const total = (input.items || []).length;

  for (let i = 0; i < total; i += 1) {
    const row = input.items[i];
    const built = await buildItem(row, maps, i, total);
    items.push(built);
  }

  const payload = { items };
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`wrote=${outputPath}`);
  console.log(`count=${items.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

