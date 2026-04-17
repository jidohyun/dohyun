import type { DaemonEnvelope, DaemonReply } from './daemon-wire.js'
import { connectWithTimeout, exchangeLine } from './daemon-wire.js'

export type { DaemonEnvelope, DaemonReply } from './daemon-wire.js'

export interface DaemonClientOptions {
  connectTimeoutMs?: number
  responseTimeoutMs?: number
}

const DEFAULT_CONNECT_TIMEOUT_MS = 200
const DEFAULT_RESPONSE_TIMEOUT_MS = 1000

/**
 * node:net 클라이언트로 Elixir dohyun-daemon의 Unix socket에 말을 건다.
 *
 * tryDelegate: 위임 실패하면 null + usedFallback=true. 호출부는 파일 직접
 *              쓰기 경로로 fallback한다. 에러는 swallowed.
 * sendCmd:    daemon이 있다는 가정하에 raw reply를 반환.
 */
export class DaemonClient {
  public usedFallback = false
  private readonly connectTimeoutMs: number
  private readonly responseTimeoutMs: number

  constructor(
    private readonly socketPath: string,
    opts: DaemonClientOptions = {}
  ) {
    this.connectTimeoutMs = opts.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS
    this.responseTimeoutMs = opts.responseTimeoutMs ?? DEFAULT_RESPONSE_TIMEOUT_MS
  }

  async sendCmd(cmd: string, args?: Record<string, unknown>): Promise<DaemonReply> {
    const envelope: DaemonEnvelope = args === undefined ? { cmd } : { cmd, args }
    const socket = await connectWithTimeout(this.socketPath, this.connectTimeoutMs)
    try {
      return await exchangeLine(socket, envelope, this.responseTimeoutMs)
    } finally {
      socket.destroy()
    }
  }

  async tryDelegate(envelope: DaemonEnvelope): Promise<unknown | null> {
    try {
      const reply = await this.sendCmd(envelope.cmd, envelope.args)
      if (reply.ok) {
        this.usedFallback = false
        return reply.data ?? null
      }
    } catch {
      // swallow
    }
    this.usedFallback = true
    return null
  }
}
