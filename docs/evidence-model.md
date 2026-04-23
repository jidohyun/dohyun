# Evidence Model — Out-of-band Human Approval for `@verify:manual`

> Status: introduced in 0.16, replaces the notepad path, full cutover in 0.19.
> Related plan: `.dohyun/plans/plan-2026-04-23-p1a-manual-oob-approval.md`
> Research: `docs/research/2026-04-23-manual-cheat-evidence.md`

## (a) Why out-of-band

Every other `@verify:*` kind is deterministic — tests, greps, file-exists, tsc
exit codes. The runtime executes them and reads the result.

`@verify:manual` was always the exception. The original design relied on the
developer writing a `[evidence] …` line in `.dohyun/memory/notepad.md`, and
the verifier would accept any such line within the last five minutes.

Under `CLAUDECODE=1` this collapses: the AI can write to the notepad and
then call `dohyun dod check` in the same turn. `dohyun analyze-cheat`
scanning the project's own history found **five real cases** in April 2026,
two with `Δ=0s` between the `[evidence]` note and the DoD check — the AI
was signing its own approval.

The out-of-band queue fixes the shape of the problem rather than adding
more detection rules. Under `CLAUDECODE=1`, `@verify:manual` creates a
pending-approval record that the AI cannot resolve. A human picks it up
from the shell, with a different account context, via `dohyun approve`.

## (b) `@verify:manual` lifecycle

```
AI turn                                           human turn
──────────────────────────────────────────        ─────────────────────────────
dohyun dod check "…@verify:manual…"
  │
  ├─ CLAUDECODE=1?
  │    yes → verifyManualViaApprovalQueue
  │           ├─ listPending.find((taskId, dodText))
  │           │    found, approved  → ok: true
  │           │    found, rejected  → ok: false ("human rejected: …")
  │           │    found, pending   → ok: false ("pending human approval (id…)")
  │           │    not found        → createPending → ok: false (same reason)
  │           │
  │           └─ DoD stays unchecked, ralph loop re-injects on next Stop.
  │                                                  │
  │                                                  ▼
  │                                                  dohyun approve list
  │                                                  dohyun approve <id>
  │                                                    or
  │                                                  dohyun approve reject <id> --reason "…"
  │                                                  writeDecision() updates file.
  │    no  → verifyManualViaNotepad (legacy)         │
  │           console.warn('deprecated; removed in 0.19')
  │                                                  │
  ▼                                                  ▼
  next turn:                                         next AI turn:
  verify re-reads the record; approved → ok.         DoD check passes, commit flow continues.
```

The composite key `(taskId, dodText)` prevents duplicate records for the
same check. A repeat call while the human still has not decided reuses
the existing id instead of flooding the queue.

## (c) CLI usage

Everything a human needs runs from the shell:

```bash
dohyun approve list
  # Pending approvals: 2
  #   01ARZ…  [4m]  task=9e36bda5
  #     dod: CLAUDECODE unset일 때: 기존 notepad 경로 유지 …
  #   01ARZ…  [12m] task=9e36bda5
  #     dod: …

dohyun approve <id>
  # Approved: 01ARZ…

dohyun approve reject <id> --reason "no diff backs this claim"
  # Rejected: 01ARZ…
```

`dohyun doctor` surfaces unresolved count alongside the other harness
health checks so the queue does not silently grow.

`dohyun` Stop hook blocks session termination whenever any pending
approval is unresolved — ahead of review-pending, DoD-in-progress,
and every other signal — because the human is the only actor that can
clear the gate.

## (d) 0.19 deprecation timeline

| Version | Notepad path | Queue path |
|---------|--------------|------------|
| 0.15 and earlier | only path available | n/a |
| **0.16 (this release)** | active when `CLAUDECODE` is unset; stderr deprecation warning each call | active when `CLAUDECODE=1` |
| 0.17 | same | same |
| 0.18 | same (final grace window) | same |
| 0.19 | removed; `@verify:manual` requires the queue on every session | sole path |

A plan written against the 0.15 semantics will continue to work under
0.16–0.18 without modification.

## (e) Human-only principle

The out-of-band queue holds only when the file channel stays human-only.
`detectAiBypass` in `src/runtime/guard.ts` blocks Edit/Write events that
target `.dohyun/pending-approvals/**` and the pre-write-guard hook logs
an `ai-bypass-attempt`. The Claude Code hook transport currently logs
the block without interrupting the tool call, so the model of this
directory is "audit trail, not hard wall" — enforcement is still
structural (only `dohyun approve` knows the `writeDecision` schema, and
only the CLI path runs under the human's shell context).

If forgery is ever observed in the wild, the next hardening step is to
sign decisions with a key that lives outside the repository (planned
under P1-b and P1-c in the roadmap, once the judge layer lands).
