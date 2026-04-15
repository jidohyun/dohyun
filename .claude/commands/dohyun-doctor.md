---
description: Run dohyun health check + hook installation verification
allowed-tools: Bash
---

Run `dohyun doctor` to verify:
- All state files are present and valid
- `.claude/settings.json` is installed with SessionStart, PreToolUse, Stop hooks registered

If any issue is reported, fix it before continuing.
