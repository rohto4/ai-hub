import test from 'node:test'
import assert from 'node:assert/strict'
import type { EnrichQueueJobRow } from '@/lib/db/enrich-queue-dashboard'
import { buildRecommendations } from '@/lib/db/enrich-queue-dashboard'

function createJobs(status: EnrichQueueJobRow['status'] = 'completed'): EnrichQueueJobRow[] {
  return [
    {
      jobName: 'enrich-worker',
      scheduleLabel: '毎時 :05〜:40 の 8 回',
      status,
      startedAt: null,
      finishedAt: null,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      durationSeconds: 0,
      metadata: {},
      liveProcessedCount: 0,
      liveFailedCount: 0,
      liveSkippedCount: 0,
    },
  ]
}

test('buildRecommendations does not trigger recovery-cycle when only paper backlog is large', () => {
  const recommendations = buildRecommendations({
    rawUnprocessed: 1500,
    rawDueNow: 1100,
    rawDueNowNonPaper: 180,
    manualPending: 0,
    publishCandidatesPending: 0,
    paperSharePercent: 82,
    topNonPaperSourceKey: 'techcrunch',
    topNonPaperSourcePending: 90,
    topPaperSourceKey: 'arxiv-ai',
    topPaperSourcePending: 820,
    jobs: createJobs(),
  })

  assert.equal(recommendations.some((item) => item.id === 'recovery-cycle'), false)
  assert.equal(recommendations.some((item) => item.id === 'paper-dominant'), true)
  assert.equal(recommendations.some((item) => item.id === 'arxiv-focus'), true)
})

test('buildRecommendations triggers recovery-cycle when non-paper due backlog is high', () => {
  const recommendations = buildRecommendations({
    rawUnprocessed: 1400,
    rawDueNow: 1200,
    rawDueNowNonPaper: 920,
    manualPending: 0,
    publishCandidatesPending: 0,
    paperSharePercent: 25,
    topNonPaperSourceKey: 'huggingface-blog',
    topNonPaperSourcePending: 410,
    topPaperSourceKey: 'arxiv-ai',
    topPaperSourcePending: 220,
    jobs: createJobs(),
  })

  assert.equal(recommendations.some((item) => item.id === 'recovery-cycle'), true)
  assert.equal(recommendations.some((item) => item.id === 'paper-dominant'), false)
})

test('buildRecommendations suggests health check when enrich-worker is failed', () => {
  const recommendations = buildRecommendations({
    rawUnprocessed: 50,
    rawDueNow: 20,
    rawDueNowNonPaper: 20,
    manualPending: 0,
    publishCandidatesPending: 0,
    paperSharePercent: 10,
    topNonPaperSourceKey: 'product-hunt',
    topNonPaperSourcePending: 10,
    topPaperSourceKey: null,
    topPaperSourcePending: 0,
    jobs: createJobs('failed'),
  })

  assert.equal(recommendations.some((item) => item.id === 'enrich-health'), true)
})
