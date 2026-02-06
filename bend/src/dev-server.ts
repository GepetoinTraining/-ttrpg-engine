/**
 * Local Development Server
 *
 * Runs the tRPC API locally for development.
 * Usage: bun run src/dev-server.ts
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { appRouter } from './api/router'
import { createContext } from './api/trpc'
import { getCampaignMembership as getMembership } from './db/queries/campaigns'
import { initDatabase } from './db/client'
import { runMigrations } from './db/migrations'
import { isSeedImported, importWithLogging, formatImportResult } from './db/seeds'

// Load .env.local first if it exists (overrides .env)
const envLocalPath = resolve(import.meta.dir, '../.env.local')
if (existsSync(envLocalPath)) {
  const envLocal = readFileSync(envLocalPath, 'utf-8')
  for (const line of envLocal.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=')
      if (key && value !== undefined) {
        process.env[key] = value
      }
    }
  }
  console.log('[DEV] Loaded .env.local')
}

const PORT = parseInt(process.env.PORT || '3001')

/**
 * Initialize database schema using migrations
 */
async function initSchema() {
  const dbUrl = process.env.TURSO_DATABASE_URL || ''

  if (dbUrl.startsWith('file:')) {
    console.log('[DEV] Using local database:', dbUrl)
  }

  const result = await runMigrations()

  if (result.success) {
    console.log(`[DEV] Schema ready: ${result.tablesCreated.length} tables`)
  } else {
    console.error('[DEV] Migration errors:', result.errors)
    return
  }

  // Auto-seed world data on first run
  const CORE_SEED_ID = 'seed-core-realms-001'
  try {
    const alreadySeeded = await isSeedImported(CORE_SEED_ID)
    if (!alreadySeeded) {
      console.log('[DEV] First run detected — seeding world data...')
      const manifestPath = resolve(import.meta.dir, 'db/seeds/00_system/manifest.json')
      const seedResult = await importWithLogging(manifestPath, {
        onConflict: 'skip',
        batchSize: 50,
        validateFirst: true,
      })
      console.log('[DEV]', formatImportResult(seedResult))
    } else {
      console.log('[DEV] World data already seeded')
    }
  } catch (e) {
    // Seeding failure is non-fatal — server still starts
    console.warn('[DEV] Auto-seed failed (non-fatal):', e instanceof Error ? e.message : e)
  }
}

async function main() {
  // Initialize database
  await initDatabase()

  // Initialize schema
  await initSchema()

  console.log('[DEV] Database initialized')

  const server = createHTTPServer({
    router: appRouter,
    createContext: async ({ req }) => {
      // Extract topology auth from headers
      const certificateHash = req.headers['x-topology-cert'] as string | undefined
      const challengeId = req.headers['x-topology-challenge'] as string | undefined
      const trajectory = req.headers['x-topology-trajectory'] as string | undefined

      if (certificateHash) {
        console.log('[DEV] Topology auth:', certificateHash.slice(0, 16) + '...')
      }

      // Extract campaign ID from header
      const campaignId = req.headers['x-campaign-id'] as string | undefined

      return createContext({
        certificateHash,
        challengeId,
        trajectory,
        getMembership,
        campaignId,
        requestId: crypto.randomUUID(),
        ip: req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
      })
    },
    middleware: (req, res, next) => {
      const start = Date.now()

      // Debug logging
      console.log(`[REQ] ${req.method} ${req.url}`)

      // CORS
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-campaign-id, x-topology-cert, x-topology-challenge, x-topology-trajectory')

      if (req.method === 'OPTIONS') {
        console.log(`[RES] OPTIONS ${req.url} -> 200 (CORS preflight)`)
        res.writeHead(200)
        res.end()
        return
      }

      // Health check endpoint
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }))
        return
      }

      // Collect request body for logging
      let body = ''
      req.on('data', (chunk) => {
        body += chunk.toString()
      })

      req.on('end', () => {
        if (body) {
          try {
            const parsed = JSON.parse(body)
            console.log('[REQ BODY]', JSON.stringify(parsed, null, 2))
          } catch {
            console.log('[REQ BODY]', body.slice(0, 500))
          }
        }
      })

      // Wrap response to log status
      const originalEnd = res.end.bind(res)
      res.end = function(chunk?: any, encoding?: any, callback?: any) {
        const duration = Date.now() - start
        console.log(`[RES] ${req.method} ${req.url} -> ${res.statusCode} (${duration}ms)`)
        if (chunk && res.statusCode >= 400) {
          try {
            const data = typeof chunk === 'string' ? chunk : chunk.toString()
            console.log('[RES ERROR]', data.slice(0, 1000))
          } catch {}
        }
        return originalEnd(chunk, encoding, callback)
      }

      next()
    },
  })

  server.listen(PORT)
  console.log(`[DEV] tRPC server listening on http://localhost:${PORT}`)
}

main().catch(console.error)
