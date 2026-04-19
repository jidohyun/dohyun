import { paths } from '../state/paths.js'
import { DaemonClient, type DaemonClientOptions } from './daemon-client.js'

/**
 * 단일 진입점. 호출부는 socketPath를 알 필요가 없다.
 */
export function createDefaultDaemonClient(
  cwd?: string,
  opts?: DaemonClientOptions
): DaemonClient {
  return new DaemonClient(paths.daemonSock(cwd), opts)
}
