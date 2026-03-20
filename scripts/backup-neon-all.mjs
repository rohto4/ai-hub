import { mkdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { readdirSync } from 'node:fs'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  return process.argv[index + 1] ?? fallback
}

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function resolveBinary(name) {
  const envPath = process.env.PG_BIN_DIR
  if (envPath) {
    return path.join(envPath, process.platform === 'win32' ? `${name}.exe` : name)
  }

  const probe =
    process.platform === 'win32'
      ? spawnSync('where.exe', [name], { encoding: 'utf8' })
      : spawnSync('which', [name], { encoding: 'utf8' })

  if (probe.status === 0) {
    const first = probe.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
    if (first) return first
  }

  if (process.platform === 'win32') {
    const root = 'C:\\Program Files\\PostgreSQL'
    if (existsSync(root)) {
      const versions = readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map((entry) => Number(entry.name))
        .sort((a, b) => b - a)

      for (const version of versions) {
        const candidate = path.join(root, String(version), 'bin', `${name}.exe`)
        if (existsSync(candidate)) return candidate
      }
    }
  }

  return name
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    env: process.env,
  })

  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr}` : ''
    throw new Error(`Command failed: ${command} ${args.join(' ')}${stderr}`)
  }

  return result.stdout ?? ''
}

const databaseUrl = requireEnv('DATABASE_URL_UNPOOLED')
const outputDir = path.resolve(getArg('--output-dir', path.join('backups', new Date().toISOString().replace(/[:.]/g, '-'))))
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

mkdirSync(outputDir, { recursive: true })

const psql = resolveBinary('psql')
const pgDump = resolveBinary('pg_dump')
const pgDumpAll = resolveBinary('pg_dumpall')

const dbListOutput = run(
  psql,
  ['-d', databaseUrl, '-t', '-A', '-c', 'select datname from pg_database where datistemplate = false order by datname;'],
  { capture: true },
)

const databaseNames = dbListOutput
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)

if (databaseNames.length === 0) {
  throw new Error('No non-template databases were found')
}

const rootUrl = new URL(databaseUrl)
const globalsFile = path.join(outputDir, `${timestamp}-globals.sql`)
run(pgDumpAll, ['--globals-only', '-d', databaseUrl, '-f', globalsFile])

for (const dbName of databaseNames) {
  const dbUrl = new URL(rootUrl)
  dbUrl.pathname = `/${dbName}`
  const dumpFile = path.join(outputDir, `${timestamp}-${sanitize(dbName)}.dump`)
  run(pgDump, ['-Fc', '-v', '-d', dbUrl.toString(), '-f', dumpFile])
}

console.log(
  JSON.stringify(
    {
      outputDir,
      globalsFile: path.basename(globalsFile),
      databases: databaseNames,
    },
    null,
    2,
  ),
)
