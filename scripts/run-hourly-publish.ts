#!/usr/bin/env npx tsx
/**
 * hourly-publish を CLI から直接実行するスクリプト
 * Usage: npx tsx scripts/run-hourly-publish.ts
 */
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

import { runHourlyPublish } from '@/lib/jobs/hourly-publish'

runHourlyPublish()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
