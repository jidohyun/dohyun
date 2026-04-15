# Review Gate

Completing a `feature` task routes through `review-pending` rather
than jumping to `completed`. A review request file is written to
`.dohyun/reviews/<task-id>.md` with DoD + last-commit `git --stat`.

## Flow

```
dohyun task complete            # feature → review-pending, writes request
dohyun review run <id>          # print the request
# (human or independent agent reads and decides)
dohyun review approve <id>      # review-pending → completed
dohyun review reject <id> --reopen "<DoD text>"
                                 # review-pending → in_progress with that DoD unchecked
```

`--reopen` is repeatable:

```
dohyun review reject <id> --reopen "a" --reopen "b"
```

## Who reviews

Two options:

1. **Another human** — open `.dohyun/reviews/<id>.md` in an editor,
   read, decide.
2. **A separate AI session** — load `prompts/reviewer.md` as the
   system prompt in a new tab / shell / MCP client. The reviewer
   spec explicitly ignores the author's claims, commit messages,
   and evidence notes; it judges only DoD ↔ diff alignment.

## Stop hook interaction

While any task is `review-pending`, the Stop hook blocks termination
with:

```
[dohyun checkpoint] Review required
  - dohyun review run <id>
```

This is intentional — a session with unreviewed features should not
silently end.

## Skipping the gate

- `tidy` and `chore` tasks never enter `review-pending`. They complete
  as soon as their DoD is checked.
- `metadata.skipReview = true` on a `chore` task is redundant (already
  skipped).
- `metadata.skipReview = true` on a `feature` task is **ignored**.
  Behavioral changes always go through review.

There is no env-var escape hatch. If review feels wrong for a specific
case, change the task type in the plan — don't bypass.

## Troubleshooting

### "Task not found: <id>"

The id must match a task in `.dohyun/runtime/queue.json`. Run
`dohyun queue` and copy the id from the matching row.

### "Task is not review-pending (current: completed)"

The task was approved already. No-op.

### I rejected and now the task is `in_progress` on another machine

The rejection updates `.dohyun/runtime/current-task.json` on the
machine that ran `review reject`. If you're working across machines,
sync state files or re-run `dohyun task start` — the task will already
show in the pending list because its status is `in_progress`.

### The review request file has an empty diff

`git show --stat HEAD` is used. If you haven't committed yet, commit
first and re-run `dohyun task complete`. The request regenerates on
every complete.

## Why this exists

Augmented Coding's fourth rule — "maintain human judgment" — requires
a reviewer who doesn't share the author's cognitive context. The gate
turns that requirement into an unskippable step for behavioral changes.
tidy and chore skip because their correctness is testable on the green
bar alone; features are where drift compounds.
