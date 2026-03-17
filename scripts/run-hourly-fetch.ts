#!/usr/bin/env npx tsx
/**
 * hourly-fetch を CLI から直接実行するスクリプト
 * Usage: npx tsx scripts/run-hourly-fetch.ts [--limit N] [--source-key KEY]
 */
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

import { runHourlyFetch } from '@/lib/jobs/hourly-fetch'

const limitArg = process.argv.indexOf('--limit')
const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : 50
const sourceKeyArg = process.argv.indexOf('--source-key')
const sourceKey = sourceKeyArg !== -1 ? process.argv[sourceKeyArg + 1] : null

runHourlyFetch({ limit, sourceKey })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
