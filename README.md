# @jidohyun/dohyun

[![npm](https://img.shields.io/npm/v/@jidohyun/dohyun)](https://www.npmjs.com/package/@jidohyun/dohyun)

Personal AI workflow harness — plan, execute, verify, persist.

## What is this?

A small workflow runtime for personal AI-assisted development. It provides:

- **Structured planning** before implementation
- **Role-based execution** with consistent prompts
- **Separated verification** (implementor ≠ reviewer)
- **Session persistence** via file-based state

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

## Future: Elixir Runtime Migration

This harness is designed for eventual migration to an Elixir backend:

### What stays in Node
- CLI interface (`src/cli/`)
- Skill definitions (`skills/`)
- Prompts and templates

### What moves to Elixir
- Queue management → GenServer with persistent queue
- Session state → ETS or Agent process
- Continuation logic → GenServer with periodic checks
- Background tasks → Task.Supervisor

### Migration path
1. **Phase 1**: Elixir reads `.dohyun/` state files (JSON compat)
2. **Phase 2**: Elixir manages queue, Node CLI calls via HTTP/port
3. **Phase 3**: Elixir owns runtime, Node is thin CLI shell

### Why this is easy
- `RuntimeAdapter` interface in `contracts.ts` defines the boundary
- State file schemas are language-independent JSON
- Policy (what to do) is separated from mechanism (how to do it)
- Hooks are thin — no business logic to port
- Queue format is explicit and structured

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
