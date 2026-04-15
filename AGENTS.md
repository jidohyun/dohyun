# AGENTS.md — dohyun harness

Personal AI workflow harness. Not a platform. Not a framework.
Built on Kent Beck's **Augmented Coding** (not Vibe Coding): Tidy Code That Works.

## Quick Reference

| Topic | Location |
|-------|----------|
| Working Protocol (TDD · Tidy First · Git rule · 3 signs) | [CLAUDE.md § TDD & Tidy First](CLAUDE.md#tdd--tidy-first--working-protocol) |
| Workflow (Interview→Plan→Execute→Verify) | [docs/workflow.md](docs/workflow.md) |
| Conventions (state contracts, hooks, immutability, git commits) | [docs/conventions.md](docs/conventions.md) |
| Architecture (runtime separation, Elixir migration) | [docs/architecture.md](docs/architecture.md) |
| Runtime contracts | [src/runtime/contracts.ts](src/runtime/contracts.ts) |
| Zod schemas | [src/runtime/schemas.ts](src/runtime/schemas.ts) |

## Skills

| Skill | Trigger | Purpose |
|-------|---------|---------|
| Deep Interview | `/interview` | Requirements extraction |
| Plan | `/plan` | Phased implementation plan |
| Ralph | `/ralph` | Persistent execution loop |
| Review | `/review` | Independent code review |

## Roles

| Role | File | Purpose |
|------|------|---------|
| Architect | `prompts/architect.md` | System design |
| Executor | `prompts/executor.md` | Plan implementation |
| Debugger | `prompts/debugger.md` | Systematic bug investigation |
| Verifier | `prompts/verifier.md` | Independent review |

## State Files

All under `.dohyun/`, validated by zod schemas at read time.

| Path | Purpose |
|------|---------|
| `state/session.json` | Session lifecycle |
| `state/modes.json` | Active mode |
| `runtime/current-task.json` | Current work item |
| `runtime/queue.json` | Task queue |
| `memory/hot.md` | Session hot cache (~500 words) |
| `memory/notepad.md` | Quick notes |
| `logs/log.md` | Append-only activity log |

## Core Principles

### Harness (이 레포 운영 원칙)

1. **State-first** — read state before work, update during, check before stopping
2. **Small diffs** — one logical change per step, verify after each
3. **Thin hooks** — input → runtime call → output, no business logic
4. **Immutable updates** — spread operators, never mutate
5. **Schema-validated** — all state reads go through zod parse
6. **Log everything** — append-only log.md for audit trail

### Augmented Coding (코딩 규율 — Kent Beck)

1. **TDD cycle** — Red → Green → Refactor. 한 번에 한 테스트. 통과시킬 최소 코드만
2. **Tidy First** — 구조 변경과 행위 변경을 같은 커밋에 섞지 않는다. 둘 다 필요하면 구조 먼저
3. **Features ↔ Options breathing** — 기능 추가(들숨) 뒤에는 구조 정제(날숨). 들숨만 반복하면 inhibiting loop
4. **Don't eat the seed corn** — 지금 편하자고 구조를 망가뜨리면 미래의 옵션을 잃는다
5. **3 Warning Signs로 즉시 개입** — Loops / Unrequested features / Cheating 중 하나라도 보이면 중단
6. **Need to Know** — AI에게 전체 목표 대신 다음 스텝에 필요한 최소 컨텍스트만 준다
7. **Human Judgment** — AI 생성물은 주기적으로 검토, 아키텍처 결정은 사람이 내린다

출처: [Augmented Coding: Beyond the Vibes](https://tidyfirst.substack.com/p/augmented-coding-beyond-the-vibes), [Augmented Coding & Design](https://tidyfirst.substack.com/p/augmented-coding-and-design) (Kent Beck, 2025).
상세 프로토콜은 [CLAUDE.md § TDD & Tidy First](CLAUDE.md#tdd--tidy-first--working-protocol) 참조.
