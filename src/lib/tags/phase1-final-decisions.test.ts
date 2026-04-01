import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPhase1TagDecisionPlan,
  normalizePhase1DecisionTagKey,
  toComparablePhase1DecisionToken,
  type Phase1FinalDecisions,
} from '@/lib/tags/phase1-final-decisions'

test('normalizePhase1DecisionTagKey makes DB-safe tag keys', () => {
  assert.equal(normalizePhase1DecisionTagKey('Federated Learning'), 'federated-learning')
  assert.equal(normalizePhase1DecisionTagKey(' Diffusion models '), 'diffusion-models')
  assert.equal(normalizePhase1DecisionTagKey('R&D Agent'), 'r-and-d-agent')
})

test('toComparablePhase1DecisionToken collapses spacing and punctuation differences', () => {
  assert.equal(toComparablePhase1DecisionToken('hugging face'), 'huggingface')
  assert.equal(toComparablePhase1DecisionToken('open-source'), 'opensource')
  assert.equal(toComparablePhase1DecisionToken(' Generative AI '), 'generativeai')
})

test('buildPhase1TagDecisionPlan extracts adopted and deactivated keys', () => {
  const decisions: Phase1FinalDecisions = {
    currentTags: {
      moveToCategory: [{ key: 'open source', label: 'oss' }],
      deprecate: [
        { key: 'llm', label: 'LLM' },
        { key: 'hugging face', label: 'Hugging Face' },
      ],
    },
    newTagCandidates: {
      adoptAsPrimaryTags: [
        { key: 'federated learning', label: 'Federated learning' },
        { key: 'cvpr', label: 'Cvpr' },
      ],
      reject: [{ key: 'transformer', label: 'Transformer' }],
      hold: [{ key: 'cot', label: 'Cot' }],
    },
  }

  const plan = buildPhase1TagDecisionPlan(decisions)

  assert.deepEqual(plan.adoptedPrimaryTags[0], {
    sourceKey: 'federated learning',
    normalizedKey: 'federated-learning',
    displayName: 'Federated learning',
    keywords: ['federated learning', 'Federated learning'],
  })
  assert.deepEqual(plan.adoptedPrimaryTags[1].normalizedKey, 'cvpr')
  assert.deepEqual(plan.deactivateComparableKeys.sort(), ['huggingface', 'llm', 'opensource'])
  assert.deepEqual(plan.rejectedCandidateKeys, ['transformer'])
  assert.deepEqual(plan.holdCandidateKeys, ['cot'])
})
