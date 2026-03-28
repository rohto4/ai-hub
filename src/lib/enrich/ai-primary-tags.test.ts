import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAiPrimaryTagOptions, resolvePrimaryTagIds } from '@/lib/enrich/ai-primary-tags'
import type { TagReference } from '@/lib/tags/match'

const REFERENCES: TagReference[] = [
  { id: '1', tagKey: 'llm', displayName: 'LLM', aliases: [] },
  { id: '2', tagKey: 'openai', displayName: 'OpenAI', aliases: [] },
  { id: '3', tagKey: 'paper', displayName: 'Paper', aliases: [] },
  { id: '4', tagKey: 'gemini', displayName: 'Gemini', aliases: [] },
]

test('buildAiPrimaryTagOptions excludes phase1 generic tags', () => {
  assert.deepEqual(buildAiPrimaryTagOptions(REFERENCES), [
    { tagKey: 'openai', displayName: 'OpenAI' },
    { tagKey: 'gemini', displayName: 'Gemini' },
  ])
})

test('resolvePrimaryTagIds prioritizes AI tags for full content and filters excluded tags', () => {
  assert.deepEqual(
    resolvePrimaryTagIds({
      tagReferences: REFERENCES,
      keywordMatchedTagIds: ['1', '2', '4'],
      aiMatchedTagKeys: ['gemini', 'openai', 'paper'],
      summaryInputBasis: 'full_content',
    }),
    ['4', '2'],
  )
})

test('resolvePrimaryTagIds ignores AI tags when content is snippet-only', () => {
  assert.deepEqual(
    resolvePrimaryTagIds({
      tagReferences: REFERENCES,
      keywordMatchedTagIds: ['1', '2', '4'],
      aiMatchedTagKeys: ['gemini'],
      summaryInputBasis: 'source_snippet',
    }),
    ['2', '4'],
  )
})
