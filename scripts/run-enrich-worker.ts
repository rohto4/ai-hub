#!/usr/bin/env npx tsx
/**
 * enrich-worker を CLI から直接実行するスクリプト
 * Usage:
 *   npx tsx scripts/run-enrich-worker.ts --limit 20
 *   npx tsx scripts/run-enrich-worker.ts --source-key hackernews-ai --limit 20 --summary-batch-size 20
 *   npx tsx scripts/run-enrich-worker.ts --limit 100 --summary-batch-size 20 --max-summary-batches 10
 */
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

import { runDailyEnrich } from '@/lib/jobs/enrich-worker'

const DEFAULT_SUMMARY_BATCH_SIZE = 20

const limitArg = process.argv.indexOf('--limit')
const sourceKeyArg = process.argv.indexOf('--source-key')
const summaryBatchSizeArg = process.argv.indexOf('--summary-batch-size')
const maxSummaryBatchesArg = process.argv.indexOf('--max-summary-batches')

const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : 50
const sourceKey = sourceKeyArg !== -1 ? process.argv[sourceKeyArg + 1] : null
const summaryBatchSize =
  summaryBatchSizeArg !== -1 ? parseInt(process.argv[summaryBatchSizeArg + 1], 10) : DEFAULT_SUMMARY_BATCH_SIZE
const maxSummaryBatches =
  maxSummaryBatchesArg !== -1 ? parseInt(process.argv[maxSummaryBatchesArg + 1], 10) : undefined

runDailyEnrich({ limit, sourceKey, summaryBatchSize, maxSummaryBatches })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
