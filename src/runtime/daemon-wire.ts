import { createConnection, type Socket } from 'node:net'

export interface DaemonEnvelope {
  cmd: string
  args?: Record<string, unknown>
  id?: string
}

export interface DaemonReply {
  ok: boolean
  data?: unknown
  error?: string
}

export function connectWithTimeout(path: string, timeoutMs: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(path)
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error('connect_timeout'))
    }, timeoutMs)

    socket.once('connect', () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.once('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

export function exchangeLine(
  socket: Socket,
  envelope: DaemonEnvelope,
  timeoutMs: number
): Promise<DaemonReply> {
  return new Promise((resolve, reject) => {
    let buf = ''
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('response_timeout'))
    }, timeoutMs)

    const onData = (chunk: Buffer) => {
      buf += chunk.toString('utf8')
      const idx = buf.indexOf('\n')
      if (idx < 0) return
      const line = buf.slice(0, idx)
      cleanup()
      try {
        resolve(JSON.parse(line) as DaemonReply)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('parse'))
      }
    }
    const onError = (err: Error) => {
      cleanup()
      reject(err)
    }
    const cleanup = () => {
      clearTimeout(timer)
      socket.removeListener('data', onData)
      socket.removeListener('error', onError)
    }

    socket.on('data', onData)
    socket.on('error', onError)
    socket.write(JSON.stringify(envelope) + '\n')
  })
}
