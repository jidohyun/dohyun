# Changelog

All notable changes to `@jidohyun/dohyun` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed — Every queue write is now daemon-aware

All `queue.ts` mutations (`enqueue`, `dequeue`, `complete`, `review_pending`,
`check_dod`, `cancel_all`, `prune_cancelled`, `reorder`) try the Elixir sidecar
first and fall back to direct file writes when it's absent. With the daemon
running, concurrent CLI invocations are fully serialized through a single
GenServer mailbox — no more lost writes from two terminals racing on
`queue.json`. Proven by a 20-way parallel-enqueue E2E against the live daemon.

Wire contract v1 grew seven new cmds; no breaking changes to existing shapes.

### Planned

- Multi-project harness sharing
- Plan file versioning and diff
- Queue priority scheduling
- Metrics / time tracking
- No-op tidy detection (L006)

## [0.10.0] - 2026-04-17

### Added — Optional Elixir daemon + wire contract v1

- **`daemon/` Elixir/OTP sidecar** — `Lock` (PID single-instance enforcement),
  `StateServer` (serialized queue mailbox), `SocketServer` (Unix socket JSON
  line protocol), wired under `DohyunDaemon.Application`. Optional: the npm
  package still runs without BEAM.
- **`src/runtime/daemon-client.ts` + `daemon-wire.ts`** — `node:net`-only
  client with configurable connect (default 200 ms) and response (default
  1 s) timeouts. `tryDelegate()` swallows errors and flips `usedFallback`
  so CLI call sites can transparently drop back to direct file writes.
- **`queue.ts#enqueueTask` delegates to daemon first** — if `daemon.sock`
  answers `ok:true`, the daemon owns the write and `queue.json` is not
  touched by the CLI. On any failure (no socket, timeout, `ok:false`) the
  old direct-write path runs unchanged.
- **Wire format v1** — line-delimited JSON envelope
  `{"cmd": string, "args"?: object, "id"?: string}` → reply
  `{"ok": true, "data": ...}` or `{"ok": false, "error": "..."}`. Contract
  is stable across 0.x; see [docs/daemon-wire-format.md](docs/daemon-wire-format.md).

### Why minor bump

Purely opt-in — no behavior change when the daemon is not running. Existing
state files, CLI output, and hooks are identical.

### Distribution note

`daemon/` is **not shipped in the npm tarball**. Clone this repo to run it.

### Tests

- 7 daemon-client unit tests (no-socket fallback, sendCmd, connect/response
  timeouts, envelope args, ok/error branches).
- 3 queue-with-daemon tests (no daemon → direct write; daemon present →
  daemon handles write; daemon `ok:false` → CLI fallback).
- 3 E2E daemon-cycle tests (always-runs fallback; daemon on; daemon killed
  mid-session). Elixir-dependent block is `describe.skip` when `mix` is not
  on PATH.

## [0.9.0] - 2026-04-16

### Added — Machine-Readable Output

- **`dohyun status --json`** — session, mode, active task (id/title/type/DoD progress), queue counts as a single JSON object. null for absent sections.
- **`dohyun metrics --json`** — completed totals, byType breakdown, avgDodSizeCompleted, featuresPerTidy (nullable), recent7dCompleted, inQueue counts.
- **`docs/json-output.md`** — full contract for both shapes, jq usage examples, stability policy (add = minor, remove/rename = major).

### Rationale

External tooling (statusline, tmux, prompt, dashboards) could not previously read dohyun state without regex-parsing human text.  `--json` unlocks integrations without dictating how they render.

### Tests

- 5 status-json tests (parse, counts, null activeTask, active task progress, legacy text preserved).
- 4 metrics-json tests (parse, byType counts, empty-queue, legacy text preserved).

## [0.8.1] - 2026-04-16

### Added

- **`dohyun doctor --fix`** — self-service auto-repair. Covers two common cases:
  - Missing state files (`.dohyun/runtime/queue.json`, `.dohyun/state/session.json`, etc.) → runs `setup` under the hood to regenerate.
  - Hook event drift in `.claude/settings.json` → re-renders from `settings.template.json` via `--force-settings` (originals backed up to `.bak`).
- Refuses to touch malformed JSON in an existing file — we never overwrite user data without consent. Those issues are listed separately with a `manual-only` hint and keep exit 1.

### Docs

- `docs/onboarding.md` gains a "문제가 생겼을 때" section spelling out what `--fix` does and what it deliberately won't touch.
- README quick-start includes the `--fix` variant.

### Tests

- 4 CLI tests: missing state file regenerated, drift-free sandbox is a no-op, hook event drift auto-repaired with `.bak` trail, `--fix`-less exit-1 preserved.

## [0.8.0] - 2026-04-16

### Added

- **`dohyun plan new <filename>`** — drop a new plan file into `.dohyun/plans/` (or any path with `/` in it) pre-filled from the skeleton template. Prevents the formatting mistakes that made me write each plan by hand and still occasionally fail `plan lint` until the fifth edit. `--force` overwrites; otherwise refuses if the file exists.
- **`templates/plan-skeleton.md`** — the skeleton itself. Ships in the package. Lints clean (error 0, warn 0), so `plan new` + immediate `plan lint` always passes.
- Onboarding guide now leads with `dohyun plan new` instead of a copy-paste markdown block.

### Rationale

Over the course of 8 releases this session, I wrote ~10 plan files by hand. Every fresh plan had to remember the heading format (`### T1: Title (feature)`), the DoD bullet syntax, and the optional `**Files:**` line. `plan new` collapses that into a single command and makes the harness trivially extensible — anyone can edit `templates/plan-skeleton.md` to match their house style.

## [0.7.2] - 2026-04-16

### Added — Dogfood Fixes

- **`dohyun setup` tip for ES module projects** — when the target has `package.json` without `"type":"module"`, setup prints a single info line: `tip: add "type":"module" to package.json for ES module support`. Silent when type=module already present or package.json absent (language-neutral project). Never blocks.
- **`dohyun review approve --last`** — picks the most-recently-updated review-pending task. Removes the copy-paste of the UUID that sat between `task complete` and `review approve` in the normal feature loop. Existing `review approve <id>` signature is unchanged.

### Docs

- **`docs/onboarding.md`** — 5-minute install → setup → plan → task → complete walkthrough for first-time users (includes the type=module hint explanation).

### Origin

- Both features were discovered by doing a **real end-to-end install + first feature** from a fresh tmpdir using `npm install @jidohyun/dohyun` against the registry, not `npm link`. See `.dohyun/skills-learned/manual-2026-04-16T10-29-*.md` for raw notes.

## [0.7.1] - 2026-04-16

### Added

- **First public npm release** — `@jidohyun/dohyun` is now installable via `npm install -g @jidohyun/dohyun` or `npx @jidohyun/dohyun`. A-stage "skip publish" policy is lifted.
- **LICENSE file** — canonical MIT text with jidohyun copyright (package.json already declared MIT but the file was missing).
- **`docs/publish.md`** — redistribution runbook: version bump → CHANGELOG → tag → `npm pack --dry-run` → `npm publish --access public` → fresh-dir verification.

### Package

- 228 files, 95 kB packed, 359 kB unpacked.
- Ships: `dist/`, `skills/`, `.claude/commands/`, `.claude/settings.template.json`, `docs/`, `prompts/`, `templates/`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `LICENSE`.

## [0.7.0] - 2026-04-16

### Added — Quality Net

- **End-to-end hook tests (`tests/e2e/hook-cycle.test.mjs`)** — 5 scenarios spawn each hook binary (`dist/hooks/*.js`) as a subprocess against a real sandboxed `dohyun setup`. Covers user-prompt-submit active-task injection, stop-continue block on unchecked feature, stop-continue non-block on completed tidy (the 0.5.1 regression), pre-compact snapshot creation, and session-start resume reporting. First automated guard against the infinite-loop class of bugs.
- **`dohyunError` / `dohyunWarn` utils (`src/utils/error.ts`)** — standardised `[dohyun:code] message` stderr format with optional `Hint:` line. dohyunError sets `process.exitCode=1`; dohyunWarn does not. Gradual migration: 3 user-facing error paths moved (plan load/lint "not found", task complete "DoD incomplete"), 73 remain untouched.
- **Schema migration hook (`src/runtime/migrate.ts`)** — `migrateQueue(raw)` gatekeeps all queue reads. Unknown types, missing version, newer-than-known versions all throw with helpful messages instead of silently loading corrupt state. Current version 1 is identity. When v2 arrives, add a single branch in migrate.ts; call sites stay unchanged.
- `readQueue` now routes through migrateQueue before zod validation.

### Tests

- 5 E2E scenarios (hook-cycle)
- 4 error-util unit tests (code+message, hint line, no hint, dohyunWarn vs dohyunError)
- 6 schema migration tests (v1 identity, extra field preservation, null/undefined reject, missing version, newer version, readQueue integration)

## [0.6.0] - 2026-04-16

### Added

- **Hot cache TTL (`scripts/hot.ts`)** — `hotRead` now filters out timestamped entries older than 7 days by default. Untimestamped lines (user-authored permanent notes) are always preserved. `dohyun hot show` appends `(N expired entries hidden)` when the filter dropped anything. `ttlMs` override available for tests and callers with different freshness needs.
- **`dohyun metrics` CLI (`scripts/metrics.ts`)** — queue-derived report, no LLM:
  - Totals by task type: feature / tidy / chore / fix
  - In-queue status breakdown
  - Avg DoD size for completed tasks
  - Breath cycle: completed features+fixes per completed tidy (null if no tidies yet)
  - Completed-in-last-7-days count
  - On this repo at cut: 38 completed, breath cycle 2.0, avg DoD 5.0.

### Tests

- 4 hot-TTL unit tests (fresh preserved, stale dropped, untimestamped preserved, ttlMs override, all-stale → null).
- 4 metrics CLI tests with seeded queue fixtures (totals, avg DoD, breath cycle, empty-queue).
- 12 guard-signal unit tests locking the existing `detectLoop` / `detectScopeCreep` / `detectCheat` semantics before any future tuning.

### Notes

- No behaviour change to guard thresholds — tests only. Dry-run against this session's log produced zero false positives across 5 heavily-edited files, so the current defaults look well-calibrated for the "breathe in / breathe out" cadence.

## [0.5.2] - 2026-04-16

### Added — Plan Linter

- **`dohyun plan lint <file>`** — deterministic plan file validator that runs the same parser as `plan load` plus extra rules:
  - **error** — no tasks at all, `### T1:` heading without `(type)`, unknown task type, unknown `@verify:kind`, missing required argument to `@verify:file-exists` or `@verify:grep`.
  - **warn** — task with empty DoD, duplicate task titles.
  - Exit 1 on any error; warnings alone still exit 0.
  - Issues inside backtick-wrapped spans (e.g. documentation examples like `` `@verify:file-exists(...)` ``) are ignored, matching runVerify's actual behaviour.
- Internal: new pure `lintPlan(content)` function in `src/runtime/lint.ts` returns `{ level, line, message }` issues so the CLI wrapper is trivially separable from the rule engine.

### Tests

- 10 lint unit tests (valid plan, missing task type, unknown type, empty DoD, duplicate titles, line-number contract, verify tag happy path, unknown kind, empty file-exists arg, empty grep arg).
- 4 CLI integration tests (valid → exit 0, error → exit 1, warn-only → exit 0, file-missing → exit 1).

## [0.5.1] - 2026-04-16

### Fixed

- **Stop hook infinite loop on tidy/chore tasks** — when a tidy or chore task reached `DoD N/N`, `evaluateCheckpoint` emitted an `approve` (block) action instead of `done`, asking the developer to "verify + run `dohyun task complete`". But `dohyun task complete` skips the review gate for non-feature tasks and instantly clears the current task, leaving the stop hook to keep re-firing the same approve message until the user cancelled the session. Now only `feature` and `fix` tasks require approval; `tidy` and `chore` return `done` and let the session end. Also replaced the hardcoded `"Feature"` label in the approve message with the actual task title.

### Added

- **`fix` task type** — plans can now declare `### T1: Title (fix)`. Behaves identically to `feature` (requires review, counts toward the breath inhale budget, blocks on checkpoint, triggers tidy suggestion on complete). Purely a labelling distinction so bugfix tasks are visible in plan files and logs.
- **`dohyun setup --force-settings`** — re-renders `.claude/settings.json` from the template. If the rendered output matches the existing file, prints `Settings already up to date` and does nothing. If they differ, the current file is backed up to `settings.json.bak` before being overwritten. Closes the loop that `doctor` opened when it detected drift in 0.5.0 but had no matching command to fix it.
- **`dohyun queue reorder <id> --first | --before <id>`** — permutes the pending segment of the queue without touching completed / in-progress / review-pending rows. Refuses if the task or the `--before` target is not pending. Replaces the ad-hoc `jq` queue-mutation that breath-gate misorderings forced twice this release cycle.

### Internal

- Gitignore now explicitly matches `*.bak` and `*.bak[0-9]*` to keep ad-hoc queue backups out of diffs.
- `evaluateCheckpoint` split-tested: 11 unit tests covering feature/fix/tidy/chore × DoD complete/incomplete × no-task.

## [0.5.0] - 2026-04-16

### Added — Hook Layer

- **`hooks/user-prompt-submit.ts`** — fires on `UserPromptSubmit`; echoes the active task title and unchecked DoD items on stderr so the model sees them before acting on each new prompt. Silent when idle.
- **`hooks/pre-compact.ts`** — fires on `PreCompact`; snapshots the active task + hot cache to `.dohyun/memory/pre-compact-<ISO>.md` so compaction never drops working state.
- **`settings.template.json`** now declares all 5 hook events (SessionStart, UserPromptSubmit, PreToolUse, PreCompact, Stop).

### Added — Procedural Memory

- **`dohyun learn add "<text>"`** / **`dohyun learn list`** — manual learning candidate CLI. Saves to `.dohyun/skills-learned/manual-*.md`.
- **Repeated WARN detection** — `detectRepeatedWarnings` in stop hook scans the session log for WARN messages appearing 3+ times and drops `candidate-*.md` files. Deterministic text grouping, no LLM.
- All candidate files include `REVIEW REQUIRED: human must decide whether to promote to .claude/rules/` (ETH Zurich principle).

### Changed

- **`scripts/doctor.ts`** reads `settings.template.json` to derive expected hook events instead of a hardcoded list. Reports drift with a `--force-settings` suggestion.

### Documentation

- `docs/hook-architecture.md` — new; 5-hook summary table, output channel conventions, firing order diagram.
- `docs/workflow.md` — added Procedural Memory section (candidate → human review → `.claude/rules/` promotion flow).
- `CLAUDE.md` — hook overview table and Key Files link.

## [0.4.0] - 2026-04-16

### Fixed

- **`plan load` dedupe** — re-running a plan file against a queue that already had completed or review-pending tasks used to pile an identical pending set on top of the history. Plan load now keeps the completed / review-pending history intact and skips incoming entries whose `(title, dod)` signature is already represented, printing `N skipped (already completed)`. Prior behavior wiped pending/cancelled but left every completed row plus re-enqueued everything, so one cancel + reload produced, e.g., 11 completed + 7 duplicate pending.
- **`queue` renderer surfaces `review-pending`** — feature tasks awaiting approval used to render with the plain `[ ]` pending marker and were excluded from the header count, making it easy to read "0 pending" as "queue clear". The header now adds a `N review-pending` segment when any exist, and those rows render with `[?]`.

### Added — Hot Cache

- `dohyun hot write "<text>"` / `append` / `show` / `clear` — small, developer-maintained crib note that lives at `.dohyun/memory/hot.md` (git-ignored per project).
- `session-start` hook now echoes the hot cache body on **stderr** instead of stdout. Claude Code treats hook stderr as system-reminder context, so the next session reboots with the same working memory. Stdout-based injection never actually re-entered the model's context.
- `docs/workflow.md` gained a Hot Cache section covering when to write, how reload works, and a terseness reminder (the whole file competes for context budget on every launch).

### Refactored

- `scripts/queue.ts` now uses two exported pure helpers (`bucketize`, `iconFor`) plus a `STATUS_ICONS` lookup — no more inline `filter` + nested ternary for the five display buckets. Adding a new task state is a single-line edit.
- `scripts/hot.ts` exposes `hotWrite` / `hotAppend` / `hotRead` / `hotClear` as standalone async helpers; `runHot` is now a thin dispatcher on top.
- `src/runtime/queue.ts` gained a pure `taskSignature(title, dod)` helper used by the plan-load dedupe.

## [0.3.1] - 2026-04-15

### Fixed

- `uuid()` in `src/utils/time.ts` and `id` assignment in `src/memory/project-memory.ts` now import `randomUUID` from `node:crypto` instead of relying on the global `crypto` that only exists on Node 20+. 0.3.0 shipped green on a Node 25 dev machine but broke CI's 18.x matrix (28 failed cases, all with `crypto is not defined`). Affected any command that enqueues a task (plan load, enqueue, memory entry).

## [0.3.0] - 2026-04-15

### Added — three Augmented Coding gates

Kent Beck's three warning signs of a lost AI (Loops / Unrequested features / Cheating) now each have a deterministic gate in the harness.

- **Verify gate** — DoD items accept `@verify:kind(arg)` tags (`test`, `build`, `file-exists`, `grep`, `manual`). `dohyun dod check` refuses the checkbox when the verify fails, writes a WARN to the log, and exits non-zero. `DOHYUN_SKIP_VERIFY=1` bypasses (audited). See [docs/verify-gate.md](docs/verify-gate.md).
- **Breath gate** — tasks carry a `type` (`feature`/`tidy`/`chore`) and `getBreathState()` counts completed-or-in-review features since the last tidy. `dohyun task start` refuses the third consecutive feature. `dohyun tidy suggest` surfaces LOC-heavy files in recent `feat` commits. `DOHYUN_SKIP_BREATH=1` bypasses. See [docs/breath-gate.md](docs/breath-gate.md).
- **Review gate** — completing a feature transitions to `review-pending` instead of `completed` and drops `.dohyun/reviews/<id>.md`. `dohyun review run|approve|reject --reopen "<DoD>"` closes the loop. Stop hook blocks termination while reviews are outstanding. `tidy`/`chore` skip the gate; `feature` ignores any `skipReview` flag. See [docs/review-gate.md](docs/review-gate.md).

### Added — supporting pieces

- `src/runtime/verify.ts`, `src/runtime/breath.ts`, `src/runtime/review.ts`, `src/runtime/escape.ts`.
- `prompts/reviewer.md` — reviewer role spec (ignores author claims, checks DoD↔diff alignment).
- `scripts/tidy.ts`, `scripts/review.ts`.
- Test coverage: 66 tests total (33 new) including 5 pure-function units for `shouldBlockFeatureStart` and 8 CLI integration tests for review.

### Changed

- `TaskStatus` adds `review-pending`; `TaskType` adds `chore`.
- `evaluateCheckpoint` takes a third `BreathState` arg and emits `breath: N feature(s) since last tidy` on approve.
- `ContinuationInfo.reviewPendingIds` lets Stop hook render `Review required` with per-id `dohyun review run` commands.
- `node --test` glob widened to `tests/**/*.test.mjs`.

### Docs

- `CLAUDE.md` grows the **TDD & Tidy First — Working Protocol** section and a **Features ↔ Options breathing** mechanics block with Kent Beck citations.
- `AGENTS.md` gets an Augmented Coding 7-principle core.
- `docs/conventions.md` codifies the **Git Commits (Kent Beck's Rule)** convention.
- `docs/verify-gate.md`, `docs/breath-gate.md`, `docs/review-gate.md` — per-gate troubleshooting.

## [0.2.0] - 2026-04-15

### Added

- `dohyun queue clean` — remove cancelled tasks from the queue.
- `dohyun queue --all` / `-a` — show cancelled tasks (hidden by default).
- `pruneCancelledTasks()` helper in `src/runtime/queue.ts`.
- Smoke tests for queue hide/show, queue clean, and plan-load auto-prune (3 new cases, 10 total).

### Changed

- `dohyun queue` now hides cancelled tasks by default and shows a hint (`N cancelled hidden — use --all...`).
- `dohyun plan load` now auto-prunes cancelled tasks after the existing cancel step, so reloading a plan gives a clean queue instead of appending on top of stale history. Addresses L005 learning from the first live session.

## [0.1.4] - 2026-04-15

### Fixed

- `pre-write-guard` hook now reads `tool_input.file_path` (Claude Code's real payload shape) instead of the old `filePath` key. Previously every write triggered spurious "Loop detected" and "Scope creep" warnings with an empty file path. Discovered while running a real ralph loop in `dohyun-test`.

## [0.1.3] - 2026-04-15

### Changed

- First release published via GitHub Actions (`publish.yml`) using `NPM_TOKEN` secret with `--provenance`.
- No user-facing code changes.

## [0.1.2] - 2026-04-15

### Added

- `--version` / `-v` / `version` commands on the CLI.
- `tests/smoke.test.mjs` — node:test smoke tests covering setup, doctor, status, note, log.
- GitHub Actions CI (`.github/workflows/ci.yml`) for Node 18/20/22.
- GitHub Actions publish workflow (`.github/workflows/publish.yml`) triggered by `v*` tags.
- `npm test` script wired through `prepublishOnly` so releases can't ship with failing tests.

### Fixed

- `dohyun note` now appends to the activity log (`.dohyun/logs/log.md`) so it shows up in `dohyun log`.

## [0.1.1] - 2026-04-15

### Added

- `repository`, `homepage`, and `bugs` fields in `package.json` so the npm page links to the GitHub source.

## [0.1.0] - 2026-04-15

### Added

- Initial npm release as `@jidohyun/dohyun`.
- CLI with commands: `setup`, `doctor`, `status`, `plan`, `queue`, `task`, `dod`, `log`, `note`, `cancel`.
- Runtime core with zod-validated state contracts (`src/runtime/*.ts`).
- Session hooks: `session-start`, `pre-write-guard`, `stop-continue`.
- Skills: `deep-interview`, `plan`, `ralph`, `review`, and per-command skills (`dohyun-status`, `dohyun-queue`, etc.).
- Prompts for Architect, Executor, Debugger, Verifier roles.
- Document templates: PRD, plan, test-spec.
- Docs: `architecture.md`, `conventions.md`, `workflow.md`.

[Unreleased]: https://github.com/jidohyun/dohyun/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/jidohyun/dohyun/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/jidohyun/dohyun/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/jidohyun/dohyun/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/jidohyun/dohyun/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/jidohyun/dohyun/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/jidohyun/dohyun/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/jidohyun/dohyun/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jidohyun/dohyun/releases/tag/v0.1.0
