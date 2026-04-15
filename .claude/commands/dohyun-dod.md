---
description: Show current task's DoD, or check off a DoD item
argument-hint: "[check \"<item text>\"]"
allowed-tools: Bash
---

$ARGUMENTS

If no arguments: run `dohyun dod` to show the DoD status.

If `check "<item>"`: run `dohyun dod check "<item>"` to mark that DoD item as complete.

Only check items after verifying the implementation actually works (build passes, test passes, or manual verification confirmed).
