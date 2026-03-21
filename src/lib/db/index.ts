import { neon } from '@neondatabase/serverless'

type SqlClient = ReturnType<typeof neon>

let pooledClient: SqlClient | null = null
let unpooledClient: SqlClient | null = null
const columnPresenceCache = new Map<string, Promise<boolean>>()

function readEnv(name: 'DATABASE_URL' | 'DATABASE_URL_UNPOOLED'): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

function requireEnv(name: 'DATABASE_URL' | 'DATABASE_URL_UNPOOLED'): string {
  const value = readEnv(name)
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

export function isDatabaseConfigured(): boolean {
  return readEnv('DATABASE_URL') !== null
}

export function isMigrationDatabaseConfigured(): boolean {
  return readEnv('DATABASE_URL_UNPOOLED') !== null
}

export function getSql(): SqlClient {
  if (pooledClient) return pooledClient
  pooledClient = neon(requireEnv('DATABASE_URL'))
  return pooledClient
}

export function getMigrationClient(): SqlClient {
  if (unpooledClient) return unpooledClient
  unpooledClient = neon(requireEnv('DATABASE_URL_UNPOOLED'))
  return unpooledClient
}

export async function hasDatabaseColumn(tableName: string, columnName: string): Promise<boolean> {
  const cacheKey = `${tableName}:${columnName}`
  const cached = columnPresenceCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const lookup = (async () => {
    const sql = getSql()
    const rows = (await sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${tableName}
          AND column_name = ${columnName}
      ) AS column_exists
    `) as Array<{ column_exists: boolean }>

    return rows[0]?.column_exists ?? false
  })()

  columnPresenceCache.set(cacheKey, lookup)
  return lookup
}
