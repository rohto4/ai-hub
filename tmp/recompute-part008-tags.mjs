import fs from 'node:fs/promises';
import path from 'node:path';

const root = 'G:/devwork/ai-summary';
const inputPath = path.join(root, 'artifact/gemini-cli-enrich-backlog-1500/inputs/ai-enrich-inputs-part-008.json');
const outPath = path.join(root, 'artifact/gemini-cli-enrich-backlog-1500/outputs/ai-enrich-outputs-part-008.json');
const tagMasterPath = path.join(root, 'artifact/gemini-cli-enrich-backlog-1500/prompts/tag-master.json');

const norm = (s) => (s || '').toLowerCase().replace(/[\u2019']/g, '').replace(/[^a-z0-9+\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
const slugify = (s) => (s || '').toLowerCase().replace(/[^a-z0-9+\-\s]/g, ' ').trim().replace(/\s+/g, '-').replace(/-+/g, '-');

const GENERIC = new Set(['ai','ml','model','models','paper','study','method','approach','framework','system','data','dataset','results','research']);

function extractAbstract(text) {
  const src = (text || '').replace(/\s+/g, ' ').trim();
  if (!src) return '';
  const m = src.match(/Abstract:\s*(.*?)(Comments:|Subjects:|Cite as:|Submission history|$)/i);
  return (m?.[1] || src.slice(0, 800)).trim();
}

function computeMatchedKeys(item, tags) {
  const title = String(item.title || '');
  const abs = extractAbstract(item.summaryInputText || item.content || '');
  const text = norm(`${title} ${abs}`);

  const scored = [];
  for (const tag of tags) {
    const key = String(tag.tagKey || '').trim();
    if (!key) continue;

    const phrases = [key, String(tag.displayName || ''), ...(tag.aliases || [])]
      .map((x) => norm(String(x || '')))
      .filter(Boolean);

    let score = 0;
    for (const p of phrases) {
      if (!p || p.length < 3) continue;
      if (text.includes(p)) score = Math.max(score, Math.min(10, p.length));
    }

    if (score > 0) scored.push({ key, score });
  }

  scored.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

  const out = [];
  const push = (k) => {
    if (!k || out.includes(k) || out.length >= 5) return;
    out.push(k);
  };

  if (String(item.sourceType || '').toLowerCase() === 'paper') push('paper');
  if (String(item.sourceCategory || '').toLowerCase() === 'llm') push('llm');

  for (const { key } of scored) {
    if (out.length >= 5) break;
    if (key === 'hugging face' || key === 'huggingface' || key === 'replicate' || key === 'phi') continue;
    push(key);
  }

  // Keyword-based boost for core concept tags
  if (/\brag\b/.test(text)) push('rag');
  if (/\bagent\b/.test(text)) push('agent');
  if (/\bsafety\b|secure|security|privacy/.test(text)) push('safety');
  if (/policy|regulation|law|compliance|governance/.test(text)) push('policy');
  if (/voice|speech|audio|tts/.test(text)) push('voice-ai');
  if (/coding|code generation|software engineering|program synthesis/.test(text)) push('coding-ai');
  if (/generative|diffusion|image generation|text to image|video generation/.test(text)) push('generative-ai');

  return out.slice(0, 5);
}

function computeProposed(item, tags, matched) {
  const aliasToKey = new Map();
  for (const tag of tags) {
    const k = String(tag.tagKey || '').trim();
    if (!k) continue;
    aliasToKey.set(norm(k), k);
    aliasToKey.set(norm(String(tag.displayName || '')), k);
    for (const a of tag.aliases || []) aliasToKey.set(norm(String(a || '')), k);
  }

  const out = [];
  const matchedSet = new Set(matched);
  for (const c of item.candidateTags || []) {
    const raw = String(c.candidateKey || c.displayName || '').trim();
    if (!raw) continue;
    if (aliasToKey.has(norm(raw))) continue;
    const slug = slugify(raw);
    if (!slug || slug.length < 3 || slug.length > 40) continue;
    if (GENERIC.has(slug)) continue;
    if (matchedSet.has(slug)) continue;
    if (out.includes(slug)) continue;
    out.push(slug);
    if (out.length >= 2) break;
  }
  return out;
}

async function main() {
  const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const out = JSON.parse(await fs.readFile(outPath, 'utf8'));
  const tagMaster = JSON.parse(await fs.readFile(tagMasterPath, 'utf8'));
  const tags = tagMaster.tags || [];

  const fixedItems = out.items.map((row, idx) => {
    const src = input.items[idx] || {};
    const matchedTagKeys = computeMatchedKeys(src, tags);
    const proposedTags = computeProposed(src, tags, matchedTagKeys);
    return { ...row, matchedTagKeys, proposedTags };
  });

  await fs.writeFile(outPath, JSON.stringify({ items: fixedItems }, null, 2), 'utf8');
  console.log(`rewrote=${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

