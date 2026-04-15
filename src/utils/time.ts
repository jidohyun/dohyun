import { randomUUID } from 'node:crypto'

export function now(): string {
  return new Date().toISOString()
}

export function uuid(): string {
  return randomUUID()
}
