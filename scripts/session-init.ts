import { NodeRuntime } from '../src/runtime/node-runtime.js'

export async function runSessionInit(cwd: string): Promise<void> {
  const runtime = new NodeRuntime(cwd)
  const session = await runtime.startSession()
  console.log(`Session started: ${session.sessionId}`)
}
