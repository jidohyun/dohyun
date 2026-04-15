---
name: dohyun-status
description: Show dohyun session, mode, active task, and queue summary
trigger: /dohyun-status
allowed-tools: Bash
---

# dohyun-status

Show the current dohyun session state.

## Action

```bash
dohyun status
```

## Output includes

- Session ID and status
- Active mode (plan/execute/verify/debug/tidy)
- Current in-progress task
- Queue summary (pending / in-progress / completed counts)
- List of active tasks (up to 5)

Use this at the start of a session to understand where you are.
