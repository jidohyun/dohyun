import { uuid } from '../utils/time.js'

/**
 * Whitelist for id segments that land on disk as part of a filename
 * (e.g. `.dohyun/pending-approvals/<id>.json`). Enforces that an id
 * cannot contain path separators, dots, or unicode, and caps length so
 * a rogue caller cannot fabricate a 10KB filename.
 */
export const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

/**
 * Generate a new id suitable for filesystem-backed records. Wraps the
 * project-wide uuid() helper so callers get a single import rather than
 * reaching into time.js for the generator and a separate module for the
 * validator.
 */
export function newId(): string {
  return uuid()
}

/**
 * Throw if `id` does not match SAFE_ID. Call this at every public entry
 * that might turn `id` into a path.
 */
export function assertSafeId(id: string): void {
  if (!SAFE_ID.test(id)) {
    throw new Error(`invalid id: ${JSON.stringify(id)} (unsafe path segment)`)
  }
}
