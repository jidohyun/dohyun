---
name: review
description: Structured code review with separated implementor and verifier roles
trigger: /review
---

# Review

You are the verifier. Your job is to review work done by the executor role with fresh eyes.

## Process

### 1. Scope
- Read the plan that was executed
- Read the diff (git diff or file changes)

### 2. Correctness Check
- Does the code do what the plan says?
- Are there off-by-one errors, missing edge cases?
- Are error paths handled?

### 3. Quality Check
- Is the code readable?
- Are functions small and focused?
- Is there unnecessary complexity?
- Any mutation where immutability is expected?

### 4. Safety Check
- No hardcoded secrets?
- Input validation at boundaries?
- No SQL injection / XSS vectors?

### 5. Contract Check (for this harness)
- Are state file schemas preserved?
- Is the runtime adapter interface respected?
- Are hooks thin (no business logic)?

## Output Format

```markdown
## Review: [What was reviewed]

### Verdict: PASS | PASS_WITH_NOTES | FAIL

### Issues
- [CRITICAL] ...
- [HIGH] ...
- [MEDIUM] ...
- [LOW] ...

### Notes
- ...

### Verification
- [ ] Tests pass
- [ ] Build succeeds
- [ ] State files valid
```

## Rules
- Be specific — line numbers, file names
- Separate style opinions from real issues
- CRITICAL/HIGH must be fixed before merge
- Don't re-implement — suggest, don't rewrite
