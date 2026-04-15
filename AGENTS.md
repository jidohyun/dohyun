# AGENTS.md — dohyun harness

Personal AI workflow harness. Not a platform. Not a framework.

## Quick Reference

| Topic | Location |
|-------|----------|
| Workflow (Interview→Plan→Execute→Verify) | [docs/workflow.md](docs/workflow.md) |
| Conventions (state contracts, hooks, immutability) | [docs/conventions.md](docs/conventions.md) |
| Architecture (runtime separation, Elixir migration) | [docs/architecture.md](docs/architecture.md) |
| Runtime contracts | [src/runtime/contracts.ts](src/runtime/contracts.ts) |
| Zod schemas | [src/runtime/schemas.ts](src/runtime/schemas.ts) |

## Skills

| Skill | Trigger | Purpose |
|-------|---------|---------|
| Deep Interview | `/interview` | Requirements extraction |
| Plan | `/plan` | Phased implementation plan |
| Ralph | `/ralph` | Persistent execution loop |
| Review | `/review` | Independent code review |

## Roles

| Role | File | Purpose |
|------|------|---------|
| Architect | `prompts/architect.md` | System design |
| Executor | `prompts/executor.md` | Plan implementation |
| Debugger | `prompts/debugger.md` | Systematic bug investigation |
| Verifier | `prompts/verifier.md` | Independent review |

## State Files

All under `.dohyun/`, validated by zod schemas at read time.

| Path | Purpose |
|------|---------|
| `state/session.json` | Session lifecycle |
| `state/modes.json` | Active mode |
| `runtime/current-task.json` | Current work item |
| `runtime/queue.json` | Task queue |
| `memory/hot.md` | Session hot cache (~500 words) |
| `memory/notepad.md` | Quick notes |
| `logs/log.md` | Append-only activity log |

## Core Principles

1. **State-first** — read state before work, update during, check before stopping
2. **Small diffs** — one logical change per step, verify after each
3. **Thin hooks** — input → runtime call → output, no business logic
4. **Immutable updates** — spread operators, never mutate
5. **Schema-validated** — all state reads go through zod parse
6. **Log everything** — append-only log.md for audit trail
