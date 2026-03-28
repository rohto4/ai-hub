import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEnrichBatchPrompt } from '@/lib/ai/prompts/enrich-batch-ja'

test('buildEnrichBatchPrompt includes canonicalTagHints guidance with matchedTagKeys schema', () => {
  const prompt = buildEnrichBatchPrompt(
    [
      {
        id: '1',
        title: 'OpenAI updates GPT-5',
        content: 'OpenAI updated GPT-5 with coding improvements.',
        summaryInputBasis: 'full_content',
        contentLanguage: 'en',
      },
    ],
    [
      { tagKey: 'openai', displayName: 'OpenAI' },
      { tagKey: 'gpt-5', displayName: 'GPT-5' },
    ],
  )

  assert.match(prompt, /matchedTagKeys/)
  assert.match(prompt, /canonicalTagHints/)
  assert.match(prompt, /relation/)
  assert.match(prompt, /allowedPrimaryTags/)
  assert.match(prompt, /"tagKey": "openai"/)
  assert.match(prompt, /"id": "1"/)
})
