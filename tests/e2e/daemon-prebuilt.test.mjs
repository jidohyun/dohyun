import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, mkdirSync, existsSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')
const cliPath = resolve(repoRoot, 'dist', 'src', 'cli', 'index.js')

function detectPlatform() {
  const os = process.platform === 'darwin' ? 'darwin' : process.platform === 'linux' ? 'linux' : null
  const cpu = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'x64' : null
  if (!os || !cpu) return null
  return `${os}-${cpu}`
}

function bundleDir(platform) {
  return resolve(repoRoot, 'packages', `daemon-${platform}`, 'release', 'bin', 'dohyun_daemon')
}

function runCli(args, cwd) {
  try {
    const out = execFileSync('node', [cliPath, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Clear DOHYUN_DAEMON_REPO so the CLI doesn't fall back to mix — we
      // want to prove the release bundle gets chosen.
      env: { ...process.env, DOHYUN_DAEMON_REPO: '' },
    })
    return { stdout: out, exitCode: 0 }
  } catch (err) {
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', exitCode: err.status ?? 1 }
  }
}

function sandboxWithPrebuilt(platform) {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-prebuilt-e2e-'))
  mkdirSync(join(dir, '.dohyun'), { recursive: true })

  // Fake `npm install` tree: symlink the local bundle into node_modules so
  // findPrebuiltBinary() sees it.
  const scope = join(dir, 'node_modules', '@jidohyun')
  mkdirSync(scope, { recursive: true })
  const linkTarget = resolve(repoRoot, 'packages', `daemon-${platform}`)
  symlinkSync(linkTarget, join(scope, `dohyun-daemon-${platform}`), 'dir')

  return dir
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

const platform = detectPlatform()
const bundleReady = platform && existsSync(bundleDir(platform))

describe('pre-built daemon bundle', { skip: !bundleReady }, () => {
  test('daemon start uses the release binary and binds the socket', async () => {
    const dir = sandboxWithPrebuilt(platform)
    try {
      const start = runCli(['daemon', 'start'], dir)
      assert.equal(start.exitCode, 0, `start should succeed: ${start.stderr}`)
      assert.match(start.stdout, /release/i, 'should mention release mode')

      await sleep(200)

      const status = runCli(['daemon', 'status', '--json'], dir)
      const parsed = JSON.parse(status.stdout)
      assert.equal(parsed.status, 'running')
      assert.ok(parsed.pid && parsed.pid > 0)
    } finally {
      runCli(['daemon', 'stop'], dir)
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
