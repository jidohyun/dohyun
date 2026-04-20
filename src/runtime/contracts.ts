/**
 * Runtime Contracts
 *
 * These types define the state/queue/runtime contracts shared between
 * the current Node implementation and any future runtime (e.g. Elixir).
 *
 * IMPORTANT: These types ARE the contract.
 * Any runtime adapter must read/write files conforming to these shapes.
 * Changing these types is a breaking change across runtimes.
 */

// ─── State Contracts ───────────────────────────────────────────────

export type SessionStatus = 'idle' | 'active' | 'paused' | 'error'

export interface SessionState {
  version: number
  sessionId: string | null
  startedAt: string | null
  lastActiveAt: string | null
  status: SessionStatus
  currentMode: string | null
  workingDirectory: string | null
}

export type ModeName = 'plan' | 'execute' | 'verify' | 'debug' | 'tidy'

export interface ModeHistoryEntry {
  mode: ModeName
  enteredAt: string
  exitedAt: string | null
}

export interface ModesState {
  version: number
  activeMode: ModeName | null
  availableModes: ModeName[]
  modeHistory: ModeHistoryEntry[]
}

export interface LastRunState {
  version: number
  command: string | null
  startedAt: string | null
  finishedAt: string | null
  exitStatus: 'success' | 'failure' | 'cancelled' | null
  summary: string | null
}

// ─── Task & Queue Contracts ────────────────────────────────────────

export type TaskStatus = 'pending' | 'in_progress' | 'review-pending' | 'completed' | 'failed' | 'cancelled'
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'
export type TaskType = 'feature' | 'tidy' | 'chore' | 'fix'

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  type: TaskType
  dod: string[]
  dodChecked: string[]
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  /**
   * ISO timestamp when the task exited review-pending via `dohyun review
   * approve`. Null for tasks that never went through review (tidy/chore,
   * or completed before this field existed). Optional for hysterical-raisin
   * reasons — older queue.json files may not have it.
   */
  reviewedAt?: string | null
  metadata: Record<string, unknown>
}

export interface CurrentTaskState {
  version: number
  task: Task | null
}

export interface QueueState {
  version: number
  tasks: Task[]
}

// ─── Runtime Adapter Contract ──────────────────────────────────────

/**
 * RuntimeAdapter defines the interface any runtime must implement.
 *
 * Current implementation: NodeRuntime (file-based polling)
 * Future implementation:  ElixirRuntime (GenServer + ETS)
 */
export interface RuntimeAdapter {
  // Session lifecycle
  startSession(cwd: string): Promise<SessionState>
  endSession(): Promise<void>
  getSession(): Promise<SessionState | null>

  // Mode management
  setMode(mode: ModeName): Promise<ModesState>
  getMode(): Promise<ModesState | null>

  // Task queue
  enqueue(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>
  dequeue(): Promise<Task | null>
  peek(): Promise<Task | null>
  getQueue(): Promise<QueueState>

  // Current task
  setCurrentTask(task: Task | null): Promise<void>
  getCurrentTask(): Promise<Task | null>

  // Continuation check (policy: are there unfinished tasks?)
  hasUnfinishedWork(): Promise<boolean>
}
