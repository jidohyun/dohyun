# Daemon Architecture (optional)

The Elixir `dohyun_daemon` is an **opt-in** subproject that eliminates the
race condition that can happen when two TS CLI invocations mutate
`.dohyun/runtime/queue.json` at the same time.

The TS CLI works without it. When the daemon is running, the CLI delegates
state mutations through a Unix socket; when it is absent, the CLI writes the
state files directly as before.

## Process layout

```
┌──────────────┐      ┌───────────────────────────────────────┐
│   TS CLI     │      │           dohyun_daemon (BEAM)         │
│ (node + tsc) │      │                                        │
│              │──┐   │  ┌──────────────┐   ┌───────────────┐ │
│ dohyun …     │  │   │  │ SocketServer │──▶│  StateServer  │ │
└──────────────┘  │   │  │ (accept loop)│   │ (GenServer)   │ │
                  │   │  └──────────────┘   └──────┬────────┘ │
                  │   │                             │          │
                  │   │                             ▼          │
                  ▼   │                    .dohyun/runtime/    │
 .dohyun/daemon.sock  │                    queue.json          │
                      └───────────────────────────────────────┘
```

* **SocketServer** binds `.dohyun/daemon.sock`, accepts connections and
  dispatches each line-delimited JSON envelope (see
  [daemon-wire-format.md](daemon-wire-format.md)).
* **StateServer** is a single GenServer that owns every read and write to
  `queue.json`. Concurrent callers funnel through its mailbox, so writes
  are serialized for free; persistence is tmp-file + rename for crash
  safety.

## Startup flow

1. `dohyun daemon start` (or `mix run --no-halt` directly) starts the OTP
   Application. `daemon start` runs `mix` with `detached: true` + `unref()` so
   the BEAM vm survives after the parent shell exits; logs go to
   `.dohyun/logs/daemon.log`.
2. `Application.start/2` spins up a supervision tree with `StateServer` and
   `SocketServer`.
3. `Lock.acquire/1` writes the OS pid to `.dohyun/daemon.pid`, bailing out if
   an alive daemon already owns the lock (`{:error, {:already_locked, pid}}`).
4. `StateServer.init/1` reads `queue.json` into memory. On an unsupported
   schema version it refuses to start, preventing silent corruption.
5. `SocketServer.init/1` binds the Unix socket and launches the accept loop.

`dohyun daemon stop` sends SIGTERM to the pid, waits up to 8 s, then sends
SIGKILL as a last resort. Because BEAM exits non-gracefully on SIGTERM, the
stale socket/pid files are cleaned up by the TS CLI after the process is
confirmed gone.

## Fallback strategy

CLI calls follow this order:

1. Try `connect(.dohyun/daemon.sock)` with a short timeout (≤200 ms).
2. On failure, fall through to the existing file-based writer.

This means **absence of the daemon is never an error**; the feature is purely
additive. See the relevant client code in `src/runtime/daemon-client.ts`.

## Auto-spawn (zero-config lifecycle)

Write-path CLI calls (`enqueueTask`, `dequeueTask`, `completeTask`, …) add a
third step:

3. Fire-and-forget `autoSpawnBackground(cwd)` — spawn a detached daemon
   process but **do not wait for it**. The current call still completes via
   the direct-file writer so the user sees zero added latency. The *next*
   CLI call gets a warm socket.

Suppressors:

- `DOHYUN_NO_DAEMON=1` — skips the spawn step entirely (useful in CI).
- Daemon already running (pid/socket both alive) — no-op.
- No runtime available on this host (no bundle + no mix) — silent no-op.

## Idle shutdown

The StateServer starts a `Process.send_after(self(), :check_idle, 30_000)`
loop on boot. Each `handle_call` bumps `state.last_activity` to the current
monotonic time. When `:check_idle` fires and
`monotonic_ms() - last_activity >= idle_ms`, the server calls `:init.stop()`
which unwinds the supervision tree (SocketServer.terminate cleans up the
socket file) and the BEAM exits. The TS CLI's `autoSpawnBackground` will
re-spawn on the next write, so idle shutdown is invisible to users.

Tunable via `DOHYUN_DAEMON_IDLE_MS` (default: 600000 = 10 minutes). Set to
`0` to disable idle shutdown.

## When to run the daemon

* You run `dohyun` commands from multiple terminals against the same repo.
* You want a stable wire (`status --json` over a socket) for dashboards.
* You want observability hooks (future: telemetry, LiveDashboard).

## When not to bother

* Single-session development.
* Shipping the binary to contributors who cannot install Erlang/OTP — the
  npm package does not include the daemon.

## References

* [daemon-wire-format.md](daemon-wire-format.md) — socket envelope contract.
* [`.dohyun/memory/handoff-elixir.md`](../.dohyun/memory/handoff-elixir.md) —
  original motivation, options A–F, decision log.
