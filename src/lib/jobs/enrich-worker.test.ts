import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveEnrichJobName } from '@/lib/jobs/enrich-worker'

test('resolveEnrichJobName uses enrich-worker-paper for paper queue', () => {
  assert.equal(resolveEnrichJobName('paper', null), 'enrich-worker-paper')
})

test('resolveEnrichJobName keeps enrich-worker for non-paper queue', () => {
  assert.equal(resolveEnrichJobName('non-paper', null), 'enrich-worker')
})

test('resolveEnrichJobName keeps enrich-worker for source-specific runs', () => {
  assert.equal(resolveEnrichJobName('paper', 'arxiv-ai'), 'enrich-worker')
})
