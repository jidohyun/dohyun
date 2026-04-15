import type {
  RuntimeAdapter,
  SessionState,
  ModesState,
  ModeName,
  Task,
  QueueState,
} from './contracts.js'
import { readSession, readCurrentTask } from '../state/read.js'
import { writeSession, writeCurrentTask } from '../state/write.js'
import { setMode, getMode } from './mode-manager.js'
import { enqueueTask, dequeueTask, peekTask, getQueue } from './queue.js'
import { hasUnfinishedWork } from './continuation.js'
import { now, uuid } from '../utils/time.js'

/**
 * NodeRuntime — file-based implementation of RuntimeAdapter.
 *
 * All state lives in .dohyun/ as JSON files.
 * Future ElixirRuntime would replace file I/O with
 * GenServer calls or ETS lookups but expose the same interface.
 */
export class NodeRuntime implements RuntimeAdapter {
  private cwd: string

  constructor(cwd?: string) {
    this.cwd = cwd ?? process.cwd()
  }

  async startSession(): Promise<SessionState> {
    const session: SessionState = {
      version: 1,
      sessionId: uuid(),
      startedAt: now(),
      lastActiveAt: now(),
      status: 'active',
      currentMode: null,
      workingDirectory: this.cwd,
    }
    await writeSession(session, this.cwd)
    return session
  }

  async endSession(): Promise<void> {
    const session = await readSession(this.cwd)
    if (!session) return
    await writeSession({
      ...session,
      status: 'idle',
      lastActiveAt: now(),
    }, this.cwd)
  }

  async getSession(): Promise<SessionState | null> {
    return readSession(this.cwd)
  }

  async setMode(mode: ModeName): Promise<ModesState> {
    return setMode(mode, this.cwd)
  }

  async getMode(): Promise<ModesState | null> {
    return getMode(this.cwd)
  }

  async enqueue(input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    return enqueueTask(input.title, {
      description: input.description ?? undefined,
      priority: input.priority,
      status: input.status,
      type: input.type,
      dod: input.dod,
      metadata: input.metadata,
    }, this.cwd)
  }

  async dequeue(): Promise<Task | null> {
    return dequeueTask(this.cwd)
  }

  async peek(): Promise<Task | null> {
    return peekTask(this.cwd)
  }

  async getQueue(): Promise<QueueState> {
    return getQueue(this.cwd)
  }

  async setCurrentTask(task: Task | null): Promise<void> {
    await writeCurrentTask({ version: 1, task }, this.cwd)
  }

  async getCurrentTask(): Promise<Task | null> {
    const state = await readCurrentTask(this.cwd)
    return state?.task ?? null
  }

  async hasUnfinishedWork(): Promise<boolean> {
    return hasUnfinishedWork(this.cwd)
  }
}
