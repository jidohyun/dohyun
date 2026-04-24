/**
 * Queue schema migration hook.
 *
 * Currently there is only version 1 of the queue schema, so migrateQueue
 * is effectively identity.  The point of this module is to nail the
 * migration contract now, before a v2 is ever needed:
 *
 *   - unknown numeric versions → explicit error ("refuse to corrupt")
 *   - null / undefined / missing version → explicit error
 *   - known version → either pass through or transform to the latest shape
 *
 * When v2 lands, add a branch that transforms v1 → v2 shape and bump
 * QUEUE_VERSION.  The call site in state/read.ts does not need to change.
 */

import type { QueueState } from './contracts.js'

export const QUEUE_VERSION = 2

interface VersionedInput {
  version: number
  tasks: unknown
  [key: string]: unknown
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

export function migrateQueue(raw: unknown): QueueState {
  if (!isObject(raw)) {
    throw new Error('queue data is not an object')
  }

  if (typeof raw.version !== 'number') {
    throw new Error('queue version field missing or not a number')
  }

  const input = raw as VersionedInput

  if (input.version === QUEUE_VERSION) {
    // Identity — schema is already the current shape.  Zod validation
    // downstream (in readJsonValidated) will enforce structure.
    return raw as unknown as QueueState
  }

  if (input.version > QUEUE_VERSION) {
    throw new Error(
      `queue version ${input.version} is newer than this dohyun build supports (max ${QUEUE_VERSION}). ` +
      `This looks unsupported — please upgrade dohyun.`
    )
  }

  if (input.version === 1) {
    // v1 → v2: task.evidence[] is new and optional, so no per-task rewrite
    // is needed. Just bump the envelope version. Tasks pass through as-is
    // and zod validation downstream accepts either shape.
    console.warn('[dohyun] queue.json upgraded v1 → v2 schema')
    return { ...(raw as Record<string, unknown>), version: 2 } as unknown as QueueState
  }

  throw new Error(`queue version ${input.version} is unknown to this build`)
}
