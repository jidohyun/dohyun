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
} from './contracts.js'

// ─── Primitives ────────────────────────────────────────────────────

const sessionStatus = z.enum(['idle', 'active', 'paused', 'error'])
const modeName = z.enum(['plan', 'execute', 'verify', 'debug', 'tidy'])
const taskStatus = z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled'])
const taskPriority = z.enum(['low', 'normal', 'high', 'critical'])
const taskType = z.enum(['feature', 'tidy'])
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

// ─── Type Guards (compile-time check: schema matches interface) ────

type AssertEqual<T, U> = T extends U ? (U extends T ? true : never) : never

const _sessionCheck: AssertEqual<z.infer<typeof SessionSchema>, SessionState> = true
const _modesCheck: AssertEqual<z.infer<typeof ModesSchema>, ModesState> = true
const _lastRunCheck: AssertEqual<z.infer<typeof LastRunSchema>, LastRunState> = true
const _currentTaskCheck: AssertEqual<z.infer<typeof CurrentTaskSchema>, CurrentTaskState> = true
const _queueCheck: AssertEqual<z.infer<typeof QueueSchema>, QueueState> = true

// Prevent unused variable warnings
void _sessionCheck
void _modesCheck
void _lastRunCheck
void _currentTaskCheck
void _queueCheck
