/**
 * Zod Schemas — Runtime validation for state file contracts.
 *
 * These schemas mirror the TypeScript interfaces in contracts.ts.
 * Every state file read passes through schema.parse() to guarantee
 * structural integrity at runtime.
 *
 * If a schema and interface diverge, the build will catch it via z.infer<>.
 */

import { z } from 'zod'
import type {
  SessionState,
  ModesState,
  LastRunState,
  CurrentTaskState,
  QueueState,
  Task,
} from './contracts.js'

// ─── Primitives ────────────────────────────────────────────────────

const sessionStatus = z.enum(['idle', 'active', 'paused', 'error'])
const modeName = z.enum(['plan', 'execute', 'verify', 'debug', 'tidy'])
const taskStatus = z.enum(['pending', 'in_progress', 'review-pending', 'completed', 'failed', 'cancelled'])
const taskPriority = z.enum(['low', 'normal', 'high', 'critical'])
const taskType = z.enum(['feature', 'tidy', 'chore', 'fix'])
const exitStatus = z.enum(['success', 'failure', 'cancelled'])

// ─── State Schemas ─────────────────────────────────────────────────

export const SessionSchema = z.object({
  version: z.number(),
  sessionId: z.string().nullable(),
  startedAt: z.string().nullable(),
  lastActiveAt: z.string().nullable(),
  status: sessionStatus,
  currentMode: z.string().nullable(),
  workingDirectory: z.string().nullable(),
})

export const ModeHistoryEntrySchema = z.object({
  mode: modeName,
  enteredAt: z.string(),
  exitedAt: z.string().nullable(),
})

export const ModesSchema = z.object({
  version: z.number(),
  activeMode: modeName.nullable(),
  availableModes: z.array(modeName),
  modeHistory: z.array(ModeHistoryEntrySchema),
})

export const LastRunSchema = z.object({
  version: z.number(),
  command: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  exitStatus: exitStatus.nullable(),
  summary: z.string().nullable(),
})

// ─── Task & Queue Schemas ──────────────────────────────────────────

/**
 * Evidence entry — the per-DoD record that P1-b (diff snapshot + auto-commit)
 * and P1-c (LLM judge) attach to a task. `dodIndex` points back into the
 * task's dod[] array. commitSha/diffPath are populated by the auto-commit
 * flow; judgeResult is populated once P1-c lands.
 */
export const EvidenceEntrySchema = z.object({
  dodIndex: z.number().int().min(0),
  commitSha: z.string().optional(),
  diffPath: z.string().optional(),
  judgeResult: z.unknown().optional(),
})

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatus,
  priority: taskPriority,
  type: taskType,
  dod: z.array(z.string()),
  dodChecked: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  // Optional for older queue.json files written before review gate existed.
  reviewedAt: z.string().nullable().optional(),
  // v2 (P1-b) — per-DoD evidence records. Optional so v1 tasks still parse.
  evidence: z.array(EvidenceEntrySchema).optional(),
  metadata: z.record(z.unknown()),
})

export const CurrentTaskSchema = z.object({
  version: z.number(),
  task: TaskSchema.nullable(),
})

export const QueueSchema = z.object({
  version: z.number(),
  tasks: z.array(TaskSchema),
})

const approvalDecision = z.enum(['approved', 'rejected'])

export const pendingApprovalSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  dodText: z.string(),
  requestedAt: z.string(),
  context: z.string().optional(),
  decision: approvalDecision.optional(),
  decidedAt: z.string().optional(),
  decidedBy: z.string().optional(),
})

/**
 * Collection schema — enforces that ids are globally unique across
 * all pending-approval records. A duplicate id would let an AI silently
 * shadow a real human decision.
 */
export const pendingApprovalsSchema = z.array(pendingApprovalSchema).superRefine((arr, ctx) => {
  const seen = new Set<string>()
  for (let i = 0; i < arr.length; i++) {
    const id = arr[i].id
    if (seen.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [i, 'id'],
        message: `duplicate pending-approval id: ${id}`,
      })
    }
    seen.add(id)
  }
})

// ─── Type Guards (compile-time check: schema matches interface) ────

type AssertEqual<T, U> = T extends U ? (U extends T ? true : never) : never

const _sessionCheck: AssertEqual<z.infer<typeof SessionSchema>, SessionState> = true
const _modesCheck: AssertEqual<z.infer<typeof ModesSchema>, ModesState> = true
const _lastRunCheck: AssertEqual<z.infer<typeof LastRunSchema>, LastRunState> = true
const _currentTaskCheck: AssertEqual<z.infer<typeof CurrentTaskSchema>, CurrentTaskState> = true
const _queueCheck: AssertEqual<z.infer<typeof QueueSchema>, QueueState> = true
const _taskCheck: AssertEqual<z.infer<typeof TaskSchema>, Task> = true

// Prevent unused variable warnings
void _sessionCheck
void _modesCheck
void _lastRunCheck
void _currentTaskCheck
void _queueCheck
void _taskCheck
