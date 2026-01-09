#!/usr/bin/env bun
/**
 * TTRPG Engine Launcher
 * ======================
 *
 * Unified launcher that starts both backend and frontend.
 *
 * Usage:
 *   bun run start        # Start both servers
 *   bun run start:dev    # Start both in dev mode with hot reload
 */

import { spawn, type Subprocess } from 'bun'
import { resolve } from 'path'

const ROOT = import.meta.dir
const BEND_DIR = resolve(ROOT, 'bend')
const FEND_DIR = resolve(ROOT, 'fend')

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function log(prefix: string, color: string, message: string) {
  const timestamp = new Date().toLocaleTimeString()
  console.log(`${colors.dim}${timestamp}${colors.reset} ${color}[${prefix}]${colors.reset} ${message}`)
}

function logBend(message: string) {
  log('BEND', colors.cyan, message)
}

function logFend(message: string) {
  log('FEND', colors.magenta, message)
}

function logMain(message: string) {
  log('MAIN', colors.green, message)
}

function logError(message: string) {
  log('ERROR', colors.red, message)
}

// Track running processes
const processes: Subprocess[] = []

// Graceful shutdown
function shutdown() {
  logMain('Shutting down...')

  for (const proc of processes) {
    try {
      proc.kill()
    } catch {
      // Process may already be dead
    }
  }

  process.exit(0)
}

// Handle termination signals
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Stream output from a subprocess
async function streamOutput(
  proc: Subprocess,
  logger: (msg: string) => void
) {
  const reader = proc.stdout?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value).trim()
    if (text) {
      for (const line of text.split('\n')) {
        if (line.trim()) logger(line.trim())
      }
    }
  }
}

async function streamErrors(
  proc: Subprocess,
  logger: (msg: string) => void
) {
  const reader = proc.stderr?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value).trim()
    if (text) {
      for (const line of text.split('\n')) {
        if (line.trim()) logger(line.trim())
      }
    }
  }
}

async function startBackend(): Promise<Subprocess> {
  logBend('Starting backend server...')

  const proc = spawn({
    cmd: ['bun', 'run', '--watch', 'src/dev-server.ts'],
    cwd: BEND_DIR,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, FORCE_COLOR: '1' },
  })

  processes.push(proc)

  // Stream output
  streamOutput(proc, logBend)
  streamErrors(proc, logBend)

  return proc
}

async function startFrontend(): Promise<Subprocess> {
  logFend('Starting frontend server...')

  const proc = spawn({
    cmd: ['bun', 'run', 'dev'],
    cwd: FEND_DIR,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, FORCE_COLOR: '1' },
  })

  processes.push(proc)

  // Stream output
  streamOutput(proc, logFend)
  streamErrors(proc, logFend)

  return proc
}

async function waitForServer(url: string, name: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url)
      if (response.ok || response.status === 404) {
        return true
      }
    } catch {
      // Server not ready yet
    }
    await Bun.sleep(500)
  }
  logError(`${name} failed to start within ${maxAttempts * 0.5}s`)
  return false
}

async function main() {
  console.log('')
  console.log(`${colors.green}╔════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.green}║${colors.reset}        ${colors.yellow}TTRPG Engine Launcher${colors.reset}          ${colors.green}║${colors.reset}`)
  console.log(`${colors.green}║${colors.reset}  ${colors.dim}Reality awaits precipitation...${colors.reset}       ${colors.green}║${colors.reset}`)
  console.log(`${colors.green}╚════════════════════════════════════════╝${colors.reset}`)
  console.log('')

  // Start backend first
  const bendProc = await startBackend()

  // Wait a moment for backend to initialize
  await Bun.sleep(1500)

  // Start frontend
  const fendProc = await startFrontend()

  // Wait for servers to be ready
  logMain('Waiting for servers...')

  const [bendReady, fendReady] = await Promise.all([
    waitForServer('http://localhost:3001/health', 'Backend'),
    waitForServer('http://localhost:3003/', 'Frontend'),
  ])

  if (bendReady && fendReady) {
    console.log('')
    logMain('All systems operational!')
    console.log('')
    console.log(`  ${colors.cyan}Backend API:${colors.reset}  http://localhost:3001`)
    console.log(`  ${colors.magenta}Frontend:${colors.reset}     http://localhost:3003`)
    console.log('')
    console.log(`  ${colors.dim}Press Ctrl+C to stop${colors.reset}`)
    console.log('')
  }

  // Wait for processes to exit
  await Promise.all([
    bendProc.exited,
    fendProc.exited,
  ])
}

main().catch((err) => {
  logError(err.message)
  shutdown()
})
