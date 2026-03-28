import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PHASE1_PRIMARY_TAG_EXCLUSION_KEYS,
  buildPhase1RetagPromptSection,
  filterPhase1PrimaryTagMaster,
  isPhase1ExcludedTagLikeValue,
  normalizePhase1CandidateName,
} from '@/lib/tags/retag-phase1'

test('isPhase1ExcludedTagLikeValue matches tag key and display variants', () => {
  assert.equal(isPhase1ExcludedTagLikeValue('llm'), true)
  assert.equal(isPhase1ExcludedTagLikeValue('Generative AI'), true)
  assert.equal(isPhase1ExcludedTagLikeValue('hugging face'), true)
  assert.equal(isPhase1ExcludedTagLikeValue('enterprise-ai'), false)
})

test('filterPhase1PrimaryTagMaster removes excluded keys only', () => {
  const actual = filterPhase1PrimaryTagMaster([
    { tag_key: 'llm', display_name: 'LLM' },
    { tag_key: 'openai', display_name: 'OpenAI' },
    { tag_key: 'paper', display_name: 'Paper' },
    { tag_key: 'claude', display_name: 'Claude' },
  ])

  assert.deepEqual(
    actual.map((item) => item.tag_key),
    ['openai', 'claude'],
  )
})

test('normalizePhase1CandidateName keeps review output stable', () => {
  assert.equal(normalizePhase1CandidateName('  GPT-5   Release  '), 'gpt-5 release')
})

test('buildPhase1RetagPromptSection includes exclusion list', () => {
  const prompt = buildPhase1RetagPromptSection()

  for (const key of PHASE1_PRIMARY_TAG_EXCLUSION_KEYS) {
    assert.match(prompt, new RegExp(key.replace('-', '\\-')))
  }
})
