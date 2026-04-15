import type { ModeName, ModesState, TaskType } from './contracts.js'
import { readJson, writeJson } from '../utils/json.js'
import { paths } from '../state/paths.js'
import { now } from '../utils/time.js'

async function loadModes(cwd?: string): Promise<ModesState> {
  return await readJson<ModesState>(paths.modes(cwd))
    ?? {
      version: 1,
      activeMode: null,
      availableModes: ['plan', 'execute', 'verify', 'debug', 'tidy'],
      modeHistory: [],
    }
}

export async function setMode(mode: ModeName, cwd?: string): Promise<ModesState> {
  const state = await loadModes(cwd)

  const closedHistory = state.activeMode
    ? state.modeHistory.map(entry =>
        entry.mode === state.activeMode && entry.exitedAt === null
          ? { ...entry, exitedAt: now() }
          : entry
      )
    : state.modeHistory

  const updated: ModesState = {
    ...state,
    activeMode: mode,
    modeHistory: [
      ...closedHistory,
      { mode, enteredAt: now(), exitedAt: null },
    ],
  }

  await writeJson(paths.modes(cwd), updated)
  return updated
}

export async function clearMode(cwd?: string): Promise<ModesState> {
  const state = await loadModes(cwd)

  const closedHistory = state.modeHistory.map(entry =>
    entry.exitedAt === null ? { ...entry, exitedAt: now() } : entry
  )

  const updated: ModesState = {
    ...state,
    activeMode: null,
    modeHistory: closedHistory,
  }

  await writeJson(paths.modes(cwd), updated)
  return updated
}

export async function getMode(cwd?: string): Promise<ModesState> {
  return loadModes(cwd)
}

// ─── Augmented Coding: Breathe In / Breathe Out ───────────────────

export interface TidySuggestion {
  suggest: boolean
  reason: string | null
}

/**
 * Policy: Should we suggest switching to tidy mode?
 *
 * After a feature task completes, suggest a tidy pass.
 * This is Kent Beck's "breathe in (feature) → breathe out (tidy)" rhythm.
 *
 * Returns a suggestion, not an enforcement. The developer decides.
 */
export function suggestTidy(
  completedTaskType: TaskType,
  currentMode: string | null
): TidySuggestion {
  if (completedTaskType === 'feature' && currentMode !== 'tidy') {
    return {
      suggest: true,
      reason: 'Feature complete. Consider a tidy pass — refactor, reduce coupling, improve naming.',
    }
  }

  return { suggest: false, reason: null }
}
