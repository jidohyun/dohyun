# @jidohyun/dohyun

[![npm](https://img.shields.io/npm/v/@jidohyun/dohyun)](https://www.npmjs.com/package/@jidohyun/dohyun)

Personal AI workflow harness — plan, execute, verify, persist.

## What is this?

A small workflow runtime for personal AI-assisted development. It provides:

- **Structured planning** before implementation
- **Role-based execution** with consistent prompts
- **Separated verification** (implementor ≠ reviewer)
- **Session persistence** via file-based state

## Philosophy: Breathe In / Breathe Out

Built on Kent Beck's Augmented Coding principles:

- **Inhale** (feature): implement functionality, check DoD items one by one
- **Pause** (checkpoint): stop hook blocks termination, developer reviews results
- **Exhale** (tidy): refactor, clean up, reduce coupling
- **Repeat**

Each task has a **Definition of Done (DoD)** — concrete checkboxes. Stop hooks enforce you to not skip or cheat. One feature at a time. Tidy after each feature. State files are the single source of truth.

## Workflow

```
/interview → /plan (DoD 정의) → /ralph (실행+체크포인트) → /review
```

1. **/interview** — Socratic questioning to extract precise requirements
2. **/plan** — Phased implementation plan with DoD per task, saved to `.dohyun/plans/`
3. **`dohyun plan load <file>`** — Load plan into queue
4. **/ralph** — Persistent execution loop, checks DoD off one by one
5. **/review** — Independent code review by a separate verifier role

## Example Session

```bash
# 1. Initialize
dohyun setup
dohyun status                      # idle, no queue

# 2. Load a plan (after using /plan skill in Claude)
dohyun plan                        # list plans in .dohyun/plans/
dohyun plan load my-feature.md

# 3. Start working
dohyun task start                  # dequeue + activate next task
dohyun dod                         # show current DoD

# 4. As you verify each DoD item
dohyun dod check "Function greet(name) returns 'Hello, {name}!'"

# 5. When all DoD checked
dohyun task complete               # finishes current, ready for next

# 6. Along the way
dohyun note "Decided to use zod for validation"
dohyun log --tail 20               # recent activity
dohyun doctor                      # health check
dohyun doctor --fix                # auto-repair missing state / hook drift
```

## Quick Start

```bash
# Install from npm
npm install -g @jidohyun/dohyun

# Initialize harness in any project
cd /path/to/your/project
dohyun setup

# Check health
dohyun doctor

# View status
dohyun status

# Add a note
dohyun note "Starting auth refactor"

# Cancel active tasks
dohyun cancel
```

## Project Structure

```
dohyun/
├── src/
│   ├── cli/          # CLI entry point
│   ├── state/        # State read/write + path resolution
│   ├── memory/       # Notepad + project memory
│   ├── runtime/      # Runtime contracts + Node implementation
│   └── utils/        # File I/O, JSON, time utilities
├── hooks/            # Thin session hooks
├── scripts/          # CLI command implementations
├── skills/           # Skill definitions (SKILL.md)
├── prompts/          # Role prompts (architect, executor, etc.)
├── templates/        # Document templates (PRD, plan, test spec)
└── .dohyun/             # Runtime state directory
    ├── state/        # Session, modes, last run
    ├── runtime/      # Current task, queue
    ├── memory/       # Notepad, project memory, learnings
    ├── plans/        # Saved plans
    └── logs/         # Session logs
```

## Skills

| Skill | Trigger | Purpose |
|-------|---------|---------|
| Deep Interview | `/interview` | Extract requirements via Socratic questioning |
| Plan | `/plan` | Create phased implementation plan |
| Ralph | `/ralph` | Persistent execution loop |
| Review | `/review` | Independent code review |

## Roles

| Role | File | Purpose |
|------|------|---------|
| Architect | `prompts/architect.md` | System design, planning |
| Executor | `prompts/executor.md` | Plan implementation |
| Debugger | `prompts/debugger.md` | Systematic bug investigation |
| Verifier | `prompts/verifier.md` | Independent review |

## State File Contracts

State files under `.dohyun/` have stable schemas. They are the contract between:
- The current Node runtime
- Any future runtime (e.g., Elixir)
- External tools that read harness state

All schemas are defined in `src/runtime/contracts.ts`.

## Elixir daemon (optional)

`daemon/` is an optional Elixir/OTP subproject that serializes writes to
`.dohyun/runtime/queue.json` via a single GenServer mailbox. It eliminates
races when two `dohyun` commands run concurrently in different terminals.

**You do not need it.** The npm package works without BEAM installed, and
`daemon/` itself is **not published to npm** — it lives only in this repo.
Turn it on only if you run sessions in parallel or want a stable socket wire
for external dashboards. To run it, clone this repo.

### Turn it on

```bash
cd daemon
mix deps.get
mix run --no-halt
```

The daemon binds `.dohyun/daemon.sock`. The TS CLI auto-detects the socket
and delegates state mutations through it; if the socket is absent it silently
falls back to direct file writes.

### Turn it off

Stop the daemon process. Nothing else to do — the next CLI call writes state
files directly.

### Docs

- [docs/daemon-architecture.md](docs/daemon-architecture.md) — process
  layout, startup flow, fallback strategy.
- [docs/daemon-wire-format.md](docs/daemon-wire-format.md) — Unix socket
  JSON envelope contract (stable across 0.x).

### Why this is easy to adopt

- `RuntimeAdapter` interface in `contracts.ts` defines the boundary.
- State file schemas are language-independent JSON.
- Policy (what to do) is separated from mechanism (how to do it).
- Hooks are thin — no business logic to port.
- Queue format is explicit and structured.

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Run without building
npm run dohyun -- status
```

## TODO (future, not this version)
- [ ] Plan file versioning and diff
- [ ] Queue priority scheduling
- [ ] Session log aggregation
- [ ] Elixir runtime adapter
- [ ] Multi-project harness sharing
- [ ] Metrics / time tracking
