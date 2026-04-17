#!/usr/bin/env node
// Keep every packages/daemon-<platform>/package.json "version" locked to the
// main package.json version. Run after bumping the root version and before
// publishing.
//
// Usage:  node scripts/sync-daemon-versions.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const mainPkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))
const target = mainPkg.version

const packagesDir = resolve(repoRoot, 'packages')
const subPackages = readdirSync(packagesDir).filter((d) => d.startsWith('daemon-'))

let touched = 0
for (const name of subPackages) {
  const pkgPath = resolve(packagesDir, name, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  if (pkg.version === target) continue
  pkg.version = target
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  touched += 1
  console.log(`  ${name}: → ${target}`)
}

// Also keep main's optionalDependencies version in sync
const optional = mainPkg.optionalDependencies ?? {}
let mainChanged = false
for (const name of subPackages) {
  // subPackages are directory names like "daemon-darwin-arm64"; the npm
  // package names used in optionalDependencies are prefixed with "dohyun-":
  // "@jidohyun/dohyun-daemon-darwin-arm64".
  const key = `@jidohyun/dohyun-${name}`
  if (optional[key] && optional[key] !== target) {
    optional[key] = target
    mainChanged = true
  }
}
if (mainChanged) {
  mainPkg.optionalDependencies = optional
  writeFileSync(resolve(repoRoot, 'package.json'), JSON.stringify(mainPkg, null, 2) + '\n')
  console.log(`  root optionalDependencies: → ${target}`)
  touched += 1
}

console.log(touched === 0 ? 'All in sync.' : `Synced ${touched} file(s) to ${target}.`)
