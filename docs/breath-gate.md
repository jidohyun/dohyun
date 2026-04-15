# Breath Gate

Enforces Kent Beck's Features ↔ Options rhythm. After `BREATH_LIMIT = 2`
consecutive `feature` tasks are sealed (completed or review-pending),
`dohyun task start` refuses the third feature until a `tidy` task
completes.

## How the counter moves

| Completed task type | `featuresSinceTidy` |
|---------------------|---------------------|
| `feature` | +1 |
| `chore` | unchanged |
| `tidy` | reset to 0 |

`review-pending` counts as sealed — review latency doesn't hide an inhale.

## Inspecting the counter

```
node -e "import('./dist/src/runtime/breath.js').then(m=>m.getBreathState(process.cwd())).then(console.log)"
```

Or look at a Stop hook message in the log — every approve-phase
checkpoint appends `breath: N feature(s) since last tidy`.

## When you hit the gate

```
breath gate: 2 feature(s) since last tidy. tidy 태스크를 먼저 추가하세요
  (add a tidy task before starting another feature).
Hint: `dohyun tidy suggest` for candidates, or append a
      ### T...: <name> (tidy) task to your plan.
```

Two paths:

1. **Run `dohyun tidy suggest`** — scans the last 20 commits, keeps
   `feat*` subjects, prints any touched file over 400 LOC as a tidy
   candidate.
2. **Append a tidy task** to your active plan file and re-run
   `dohyun plan load`. Watch out: `plan load` currently resets the
   pending queue. If you only want to add one task, edit
   `.dohyun/runtime/queue.json` directly (schema in
   `src/runtime/schemas.ts`).

## Troubleshooting

### I just completed a tidy, but the gate still fires

The counter walks completed tasks in reverse chronological order by
`updatedAt`. If the tidy was edited after a later feature, the sort
can misplace it. Run `dohyun queue` — the last `[x] [tidy]` row should
sit after every feature you consider cleared.

### chore bypasses the gate but my PR still mixes behavior

`chore` is deliberately neutral — the gate doesn't count it, but it
also doesn't stop it. If your chore task is actually a behavior change
in disguise, change its type. The breath gate can't catch mislabeling.

### Bypass

`DOHYUN_SKIP_BREATH=1 dohyun task start` skips the gate. A WARN entry
lands in `.dohyun/logs/log.md` with the counter value at bypass time.

## Why this exists

Kent Beck, *Augmented Coding & Design*: AI inhales complexity eagerly
and rarely exhales it. Two consecutive inhales without an exhale is
the onset of the inhibiting loop
(`more features → more complexity → slower features`).
The gate is an outside rule, not a prompt — rules-as-text fail under
cognitive load; file-system gates don't.
