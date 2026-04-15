# Changelog

All notable changes to `@jidohyun/dohyun` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Multi-project harness sharing
- Plan file versioning and diff
- Queue priority scheduling
- Metrics / time tracking

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

[Unreleased]: https://github.com/jidohyun/dohyun/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/jidohyun/dohyun/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/jidohyun/dohyun/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/jidohyun/dohyun/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jidohyun/dohyun/releases/tag/v0.1.0
