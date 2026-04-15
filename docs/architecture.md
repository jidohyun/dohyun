# Architecture

## Runtime Separation: Policy vs Implementation

The harness separates **policy** (what to do) from **implementation** (how to do it).

| Layer | Example | Where |
|-------|---------|-------|
| Policy | "If there's unfinished work, continue" | `src/runtime/continuation.ts` |
| Implementation | "Read files from disk" | `src/runtime/node-runtime.ts` |
| Contract | Interface between policy and implementation | `src/runtime/contracts.ts` |
| Validation | Runtime schema enforcement | `src/runtime/schemas.ts` |

## Current Runtime: Node (file-based)

```
CLI command
  → scripts/*.ts (command handler)
    → src/state/read.ts + write.ts (validated I/O)
      → src/utils/json.ts + fs.ts (atomic file operations)
        → .dohyun/*.json (state files on disk)
```

## RuntimeAdapter Interface

`src/runtime/contracts.ts` defines `RuntimeAdapter`:
- Session lifecycle (start, end, get)
- Mode management (set, get)
- Task queue (enqueue, dequeue, peek, getQueue)
- Current task (set, get)
- Continuation check (hasUnfinishedWork)

Current implementation: `NodeRuntime` in `node-runtime.ts`.

## Future: Elixir Runtime Migration

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
1. Elixir reads `.dohyun/` state files (JSON compat)
2. Elixir manages queue, Node CLI calls via HTTP/port
3. Elixir owns runtime, Node is thin CLI shell

### Why this is feasible
- `RuntimeAdapter` interface defines the boundary
- State file schemas are language-independent JSON
- Hooks are thin — no business logic to port
- Queue format is explicit and structured (zod-validated)

## Key Design Decisions

- **Zod schemas mirror TypeScript interfaces**: compile-time type check via `z.infer<>`
- **Atomic writes**: tmp file + rename prevents corruption
- **Append-only log**: `.dohyun/logs/log.md` for audit trail
- **Hot cache**: `.dohyun/memory/hot.md` for session continuity (~500 words)
