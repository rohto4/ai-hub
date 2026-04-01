import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAliasReviewGroups,
  normalizeAliasComparableKey,
  type AliasReviewEntry,
} from '@/lib/tags/alias-review'

test('normalizeAliasComparableKey folds separators and plural forms', () => {
  assert.equal(normalizeAliasComparableKey('Hugging Face'), 'huggingface')
  assert.equal(normalizeAliasComparableKey('hugging-face'), 'huggingface')
  assert.equal(normalizeAliasComparableKey('VLMs'), 'vlm')
  assert.equal(normalizeAliasComparableKey('MLLMs'), 'mllm')
})

test('buildAliasReviewGroups groups likely notation variants only', () => {
  const entries: AliasReviewEntry[] = [
    { key: 'huggingface', label: 'Hugging Face', sourceType: 'current-tag' },
    { key: 'hugging face', label: 'Hugging Face', sourceType: 'new-tag-candidate' },
    { key: 'vlm', label: 'VLM', sourceType: 'new-tag-candidate' },
    { key: 'vlms', label: 'VLMs', sourceType: 'new-tag-candidate' },
    { key: 'enterprise-ai', label: 'Enterprise AI', sourceType: 'current-tag' },
  ]

  const groups = buildAliasReviewGroups(entries)

  assert.equal(groups.length, 2)
  assert.deepEqual(
    groups.map((group) => ({
      comparableKey: group.comparableKey,
      terms: group.terms.map((term) => term.key),
    })),
    [
      {
        comparableKey: 'huggingface',
        terms: ['hugging face', 'huggingface'],
      },
      {
        comparableKey: 'vlm',
        terms: ['vlm', 'vlms'],
      },
    ],
  )
})

test('buildAliasReviewGroups omits groups where all members are identical keys', () => {
  const entries: AliasReviewEntry[] = [
    { key: 'openai', label: 'OpenAI', sourceType: 'current-tag' },
    { key: 'openai', label: 'OpenAI', sourceType: 'new-tag-candidate' },
  ]

  const groups = buildAliasReviewGroups(entries)

  assert.deepEqual(groups, [])
})
