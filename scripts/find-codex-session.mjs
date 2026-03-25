#!/usr/bin/env node
/**
 * Find recent Codex sessions for the current repository by inspecting ~/.codex.
 *
 * Usage:
 *   node scripts/find-codex-session.mjs
 *   node scripts/find-codex-session.mjs --cwd G:\devwork\ai-summary
 *   node scripts/find-codex-session.mjs --limit 10
 *   node scripts/find-codex-session.mjs --json
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const args = process.argv.slice(2)

function readArgValue(name, defaultValue = null) {
  const index = args.indexOf(name)
  if (index === -1) return defaultValue
  return args[index + 1] ?? defaultValue
}

const outputJson = args.includes('--json')
const limit = Math.max(1, Number.parseInt(readArgValue('--limit', '5'), 10) || 5)
const targetCwd = path.resolve(readArgValue('--cwd', process.cwd()))
const codexHome = path.join(os.homedir(), '.codex')
const historyPath = path.join(codexHome, 'history.jsonl')
const sessionsRoot = path.join(codexHome, 'sessions')

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK)
    return true
  } catch {
    return false
  }
}

function readJsonLines(filePath) {
  if (!fileExists(filePath)) {
    return []
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
}

function walkFiles(dirPath) {
  if (!fileExists(dirPath)) {
    return []
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath))
      continue
    }
    if (entry.isFile() && fullPath.endsWith('.jsonl')) {
      files.push(fullPath)
    }
  }
  return files
}

function truncateText(text, maxLength = 120) {
  if (!text) return ''
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}…`
}

function formatTimestamp(ts) {
  if (!ts) return null
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function parseSessionFile(filePath) {
  const lines = readJsonLines(filePath)
  const meta = lines.find((line) => line.type === 'session_meta')?.payload ?? null
  if (!meta) {
    return null
  }

  const cwd = meta.cwd ? path.resolve(meta.cwd) : null
  const assistantMessages = lines.filter(
    (line) =>
      line.type === 'event_msg' &&
      line.payload?.type === 'agent_message' &&
      typeof line.payload?.message === 'string',
  )
  const taskComplete = lines
    .filter((line) => line.type === 'event_msg' && line.payload?.type === 'task_complete')
    .at(-1)?.payload

  return {
    sessionId: meta.id,
    timestamp: meta.timestamp,
    cwd,
    branch: meta.git?.branch ?? null,
    commitHash: meta.git?.commit_hash ?? null,
    repositoryUrl: meta.git?.repository_url ?? null,
    filePath,
    lastAssistantMessage: assistantMessages.at(-1)?.payload?.message ?? taskComplete?.last_agent_message ?? null,
  }
}

function buildHistoryMap() {
  const map = new Map()
  for (const row of readJsonLines(historyPath)) {
    if (!row.session_id) continue
    const current = map.get(row.session_id)
    if (!current || row.ts > current.lastUserTs) {
      map.set(row.session_id, {
        lastUserTs: row.ts,
        lastUserText: row.text ?? '',
      })
    }
  }
  return map
}

function main() {
  if (!fileExists(sessionsRoot)) {
    throw new Error(`Codex sessions directory not found: ${sessionsRoot}`)
  }

  const historyMap = buildHistoryMap()
  const sessionFiles = walkFiles(sessionsRoot)
  const sessions = sessionFiles
    .map(parseSessionFile)
    .filter(Boolean)
    .filter((session) => session.cwd === targetCwd)
    .map((session) => {
      const history = historyMap.get(session.sessionId)
      return {
        ...session,
        lastUserTs: history?.lastUserTs ?? null,
        lastUserAt: history?.lastUserTs ? formatTimestamp(history.lastUserTs * 1000) : null,
        lastUserText: history?.lastUserText ?? null,
      }
    })
    .sort((a, b) => {
      const aTs = a.lastUserTs ?? 0
      const bTs = b.lastUserTs ?? 0
      if (aTs !== bTs) return bTs - aTs
      return String(b.timestamp).localeCompare(String(a.timestamp))
    })

  const result = sessions.slice(0, limit)

  if (outputJson) {
    console.log(
      JSON.stringify(
        {
          targetCwd,
          codexHome,
          count: result.length,
          sessions: result,
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`target_cwd: ${targetCwd}`)
  console.log(`codex_home: ${codexHome}`)
  console.log(`matched_sessions: ${sessions.length}`)

  if (result.length === 0) {
    console.log('\nNo matching sessions found.')
    return
  }

  for (const [index, session] of result.entries()) {
    console.log(`\n[${index + 1}] ${session.sessionId}`)
    console.log(`session_started: ${session.timestamp ?? 'unknown'}`)
    console.log(`last_user_at: ${session.lastUserAt ?? 'unknown'}`)
    console.log(`branch: ${session.branch ?? 'unknown'}`)
    console.log(`commit: ${session.commitHash ?? 'unknown'}`)
    console.log(`session_file: ${session.filePath}`)
    console.log(`last_user_text: ${truncateText(session.lastUserText) || 'none'}`)
    console.log(`last_assistant_message: ${truncateText(session.lastAssistantMessage) || 'none'}`)
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
