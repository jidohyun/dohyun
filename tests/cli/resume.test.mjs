import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cliPath = resolve(here, '..', '..', 'dist', 'src', 'cli', 'index.js')

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-resume-'))
  execFileSync('git', ['init', '-q'], { cwd: dir })
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir })
  writeFileSync(join(dir, 'a.txt'), 'a\n')
  execFileSync('git', ['add', '.'], { cwd: dir })
  execFileSync('git', ['commit', '-q', '-m', 'feat[green]: init', '--no-gpg-sign'], { cwd: dir })
  return dir
}

test('dohyun resume: dirty working tree → Next action mentions commit/stash', () => {
  const dir = makeRepo()
  try {
    writeFileSync(join(dir, 'b.txt'), 'b\n')  // untracked
    const out = execFileSync('node', [cliPath, 'resume'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DOHYUN_NO_DAEMON: '1' },
    })
    assert.match(out, /=== dohyun resume ===/)
    assert.match(out, /Working tree:/)
    assert.match(out, /b\.txt/)
    assert.match(out, /Next action:/)
    assert.match(out, /commit|stash/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
