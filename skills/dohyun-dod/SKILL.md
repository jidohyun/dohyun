---
name: dohyun-dod
description: Show or check off DoD items of the current dohyun task
trigger: /dohyun-dod
argument-hint: "[check \"<item text>\"]"
allowed-tools: Bash
---

# dohyun-dod

View or update the Definition of Done (DoD) of the current task.

## Actions

### Show DoD (default)

```bash
dohyun dod
```

Displays checked/unchecked DoD items for the current in-progress task.

### Check off a DoD item

When an item has been verified (built, tested, confirmed working):

```bash
dohyun dod check "<exact item text>"
```

Replace `<exact item text>` with the literal DoD item string from `dohyun dod`.

## When to check off

Only check an item when:
- The code implementing it exists
- Tests or manual verification confirms it works
- You (or the developer) have seen the actual behavior

Never check off speculatively. DoD is a verification contract.

## After checking all items

The Stop hook will detect full DoD completion and block with a "seek approval" message. Ask the developer to verify results, then:

```bash
dohyun task complete
```
