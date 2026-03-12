import { neon } from '@neondatabase/serverless'

type SqlClient = ReturnType<typeof neon>

let pooledClient: SqlClient | null = null
let unpooledClient: SqlClient | null = null

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
