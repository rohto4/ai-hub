import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveAutoCanonicalTagMappings,
  sanitizeCanonicalTagHints,
} from '@/lib/enrich/canonical-tag-hints'
import type { TagReference } from '@/lib/tags/match'

const TAG_REFERENCES: TagReference[] = [
  { id: '1', tagKey: 'chatgpt', displayName: 'ChatGPT', aliases: ['chat-gpt'] },
  { id: '2', tagKey: 'gpt-5', displayName: 'GPT-5', aliases: [] },
  { id: '3', tagKey: 'openai', displayName: 'OpenAI', aliases: [] },
]

test('sanitizeCanonicalTagHints normalizes and deduplicates valid hints', () => {
  const hints = sanitizeCanonicalTagHints([
    { candidateKey: ' GPT Five ', matchedTagKey: 'GPT-5', relation: 'alias', confidence: 'high' },
    { candidate: 'GPT Five', matchedTagKey: 'gpt-5', relation: 'alias', confidence: 'high' },
    { candidateKey: 'ignored', matchedTagKey: 'openai', relation: 'other', confidence: 'high' },
  ])

  assert.deepEqual(hints, [
    {
      candidateKey: 'gpt five',
      matchedTagKey: 'gpt-5',
      relation: 'alias',
      confidence: 'high',
    },
  ])
})

test('resolveAutoCanonicalTagMappings returns alias and keyword mappings for full content only', () => {
  const mappings = resolveAutoCanonicalTagMappings({
    tagReferences: TAG_REFERENCES,
    canonicalTagHints: [
      { candidateKey: 'gpt five', matchedTagKey: 'gpt-5', relation: 'alias', confidence: 'high' },
      { candidateKey: 'chatgpt enterprise', matchedTagKey: 'chatgpt', relation: 'keyword', confidence: 'high' },
      { candidateKey: 'chat-gpt', matchedTagKey: 'chatgpt', relation: 'alias', confidence: 'high' },
      { candidateKey: 'open ai', matchedTagKey: 'openai', relation: 'alias', confidence: 'medium' },
      { candidateKey: 'openai', matchedTagKey: 'gpt-5', relation: 'alias', confidence: 'high' },
    ],
    summaryInputBasis: 'full_content',
  })

  assert.deepEqual(mappings, {
    aliasMappings: [{ tagId: '2', aliasKey: 'gpt five' }],
    keywordMappings: [{ tagId: '1', keyword: 'chatgpt enterprise' }],
  })
})

test('resolveAutoCanonicalTagMappings ignores non-full-content articles', () => {
  const mappings = resolveAutoCanonicalTagMappings({
    tagReferences: TAG_REFERENCES,
    canonicalTagHints: [
      { candidateKey: 'gpt five', matchedTagKey: 'gpt-5', relation: 'alias', confidence: 'high' },
    ],
    summaryInputBasis: 'source_snippet',
  })

  assert.deepEqual(mappings, {
    aliasMappings: [],
    keywordMappings: [],
  })
})
