import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')

const mod = await import(resolve(repoRoot, 'dist', 'scripts', 'daemon.js'))
const { locateDaemonExecution } = mod

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-daemon-res-'))
  return dir
}

// ── 1. pre-built release 디렉토리 있음 → release 경로 우선

test('locateDaemonExecution: prebuilt package present → release path wins', () => {
  const dir = sandbox()
  try {
    // Simulate node_modules/@jidohyun/dohyun-daemon-darwin-arm64/release/bin/dohyun_daemon
    const platformDir = join(
      dir, 'node_modules', '@jidohyun', 'dohyun-daemon-darwin-arm64',
      'release', 'bin'
    )
    mkdirSync(platformDir, { recursive: true })
    const bin = join(platformDir, 'dohyun_daemon')
    writeFileSync(bin, '#!/bin/sh\n:\n')
    chmodSync(bin, 0o755)

    const resolution = locateDaemonExecution({
      searchFrom: dir,
      platform: 'darwin',
      arch: 'arm64',
    })

    assert.ok(resolution)
    assert.equal(resolution.kind, 'release')
    assert.equal(resolution.binary, bin)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 2. prebuilt 없고 DOHYUN_DAEMON_REPO + mix.exs 있으면 mix 경로

test('locateDaemonExecution: no release, repo + mix.exs → mix path', () => {
  const dir = sandbox()
  try {
    const repoDir = join(dir, 'daemon')
    mkdirSync(repoDir, { recursive: true })
    writeFileSync(join(repoDir, 'mix.exs'), 'defmodule Foo do end\n')

    const resolution = locateDaemonExecution({
      searchFrom: dir,
      platform: 'darwin',
      arch: 'arm64',
      daemonRepoOverride: repoDir,
    })

    assert.ok(resolution)
    assert.equal(resolution.kind, 'mix')
    assert.equal(resolution.repo, repoDir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 3. 둘 다 없음 → null  (auto-discovery 차단해야 함. 실제 런타임은
//     .../daemon/mix.exs fallback을 갖지만, 테스트에서는 명시적으로 꺼둬야
//     격리된 결과를 확인 가능)

test('locateDaemonExecution: neither release nor mix (auto-discovery off) → null', () => {
  const dir = sandbox()
  try {
    const resolution = locateDaemonExecution({
      searchFrom: dir,
      platform: 'darwin',
      arch: 'arm64',
      disableAutoDiscovery: true,
    })
    assert.equal(resolution, null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 4. release가 있어도 다른 플랫폼 dir이면 현재 플랫폼과 매치 안됨
//     (release 결과 false → mix fallback 경로로 넘어감을 확인)

test('locateDaemonExecution: linux bundle on darwin host → release is not picked', () => {
  const dir = sandbox()
  try {
    const linuxBin = join(
      dir, 'node_modules', '@jidohyun', 'dohyun-daemon-linux-x64',
      'release', 'bin', 'dohyun_daemon'
    )
    mkdirSync(join(linuxBin, '..'), { recursive: true })
    writeFileSync(linuxBin, '#!/bin/sh\n:\n')
    chmodSync(linuxBin, 0o755)

    // Feed an explicit (fake) mix repo so we can distinguish release vs mix.
    const repoDir = join(dir, 'repo-stub')
    mkdirSync(repoDir, { recursive: true })
    writeFileSync(join(repoDir, 'mix.exs'), 'defmodule Foo do end\n')

    const resolution = locateDaemonExecution({
      searchFrom: dir,
      platform: 'darwin',
      arch: 'arm64',
      daemonRepoOverride: repoDir,
    })

    assert.ok(resolution, 'should fall through to mix')
    assert.equal(resolution.kind, 'mix', 'release should be skipped for mismatched platform')
    assert.equal(resolution.repo, repoDir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
