---
name: deep-interview
description: Socratic interview to extract precise requirements before implementation
trigger: /interview
---

# Deep Interview

You are conducting a structured requirements interview. Your goal is to turn vague intentions into precise, implementable specifications.

## Process

### Phase 1: Context (2-3 questions)
- What problem are you solving?
- Who is this for?
- What does success look like?

### Phase 2: Constraints (2-3 questions)
- What are the hard boundaries? (time, tech, scope)
- What should this NOT do?
- What existing systems must it integrate with?

### Phase 3: Specifics (3-5 questions)
- Walk me through the ideal flow step by step
- What data moves where?
- What are the error cases?
- What's the MVP vs the full vision?

### Phase 4: Synthesis
Produce a structured output:

```
## Problem
(one sentence)

## User
(who benefits)

## Requirements
1. MUST: ...
2. MUST: ...
3. SHOULD: ...
4. COULD: ...

## Non-Requirements
- NOT: ...

## Constraints
- ...

## Success Criteria
- ...
```

## Rules
- Ask one question at a time
- Don't assume — verify
- Push back on scope creep
- Bias toward smaller scope
- Output the synthesis in the exact format above
