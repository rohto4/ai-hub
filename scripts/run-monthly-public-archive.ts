#!/usr/bin/env npx tsx
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

import { runMonthlyPublicArchive } from '@/lib/jobs/monthly-public-archive'
import { DEFAULT_PUBLIC_RETENTION_MONTHS } from '@/lib/source-retention'

const limitArg = process.argv.indexOf('--limit')
const ageMonthsArg = process.argv.indexOf('--age-months')

const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : 5000
const ageMonths =
  ageMonthsArg !== -1 ? parseInt(process.argv[ageMonthsArg + 1], 10) : DEFAULT_PUBLIC_RETENTION_MONTHS

runMonthlyPublicArchive({ limit, ageMonths })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
