# Verify Gate

Deterministic DoD verification. Tag a DoD item with `@verify:kind(arg)`
and `dohyun dod check` will only accept the checkbox if the verifier
passes.

## Tags

| Tag | Passes when |
|-----|-------------|
| `@verify:file-exists(path)` | `path` exists under cwd |
| `@verify:grep(pattern)` | any file contains the literal `pattern` (skips `node_modules`, `dist`, `.git`, `.dohyun`, `_build`, `.code-review-graph`, `coverage`, `.next`, `.turbo`) |
| `@verify:test(arg)` | `npm run test` exits 0 |
| `@verify:build` | `npm run build` exits 0 |
| `@verify:manual` | `.dohyun/memory/notepad.md` has a recent `[evidence]` note (default 5 min) |

## Writing DoD items

```markdown
### T1: Feature X (feature)
- [ ] path exists @verify:file-exists(src/runtime/foo.ts)
- [ ] tests pass @verify:test
- [ ] human signoff @verify:manual
```

Items without a tag keep the original behaviour — unchecked vs checked.

## Providing manual evidence

```
dohyun note "[evidence] T3 verified by running ... and observing ..."
dohyun dod check "human signoff @verify:manual"
```

## Troubleshooting

### "pattern not found" but I can see it

`grep` looks at the current disk contents, not git history.
Confirm the file is saved and not ignored by the walker.

### "npm run test exited 1" but `npm test` works locally

The verifier spawns `npm run test --silent` from the cwd.
If your shell has aliases or `.nvmrc` quirks, run `npm run test --silent`
directly to reproduce.

### Bypass — human only

`DOHYUN_SKIP_VERIFY=1 dohyun dod check "..."` bypasses the gate **only
for human callers**. Claude Code (any process with `CLAUDECODE=1`)
attempting the same bypass is refused:

- CLI exits non-zero with a three-option remediation message
- `.dohyun/logs/log.md` records an `ai-bypass-attempt` WARN
- The Stop hook reads that WARN on the next turn and prepends the
  remediation banner to the checkpoint reason, so the next prompt
  sees why the last one was refused

Humans always get a `verify bypassed` WARN log entry — the audit
trail remains non-negotiable for both paths.

### False positive on `manual`

Evidence notes are matched by the line pattern
`## [<ISO-8601>] [evidence]`. If your notepad uses a different
timestamp format, update the note line manually or use
`dohyun note "[evidence] ..."` which writes the correct format.

## Why this exists

Kent Beck, *Augmented Coding*: the third warning sign of a lost AI is
"cheating" — disabling, deleting, or silently skipping tests to claim
success. A checkbox alone lets the author (human or agent) self-certify.
The verify gate moves the signal from prose to code.
