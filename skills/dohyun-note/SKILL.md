---
name: dohyun-note
description: Append a timestamped note to the dohyun notepad
trigger: /dohyun-note
argument-hint: "<note text>"
allowed-tools: Bash
---

# dohyun-note

Quickly capture a thought or decision to `.dohyun/memory/notepad.md`.

## Action

```bash
dohyun note "your note text here"
```

## When to use

- Capturing a decision made mid-session
- Recording a question to revisit later
- Noting something the developer mentioned
- Logging a surprise or unexpected finding

Notes are timestamped and append-only. This is lightweight — use it freely.
