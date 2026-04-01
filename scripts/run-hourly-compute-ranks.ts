#!/usr/bin/env npx tsx
/**
 * hourly-compute-ranks を CLI から直接実行するスクリプト
 * Usage: npx tsx scripts/run-hourly-compute-ranks.ts
 */
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

import { runHourlyComputeRanks } from '@/lib/jobs/hourly-compute-ranks'

runHourlyComputeRanks()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
