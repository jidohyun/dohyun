---
description: List dohyun plans or load a plan into the queue
argument-hint: "[load <path>]"
allowed-tools: Bash
---

$ARGUMENTS

If no arguments: run `dohyun plan` to list available plans.
If `load <path>`: run `dohyun plan load <path>` to parse the plan file and enqueue its tasks with DoD into the queue.
