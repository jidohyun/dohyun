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

1. `mix run --no-halt` starts the OTP Application.
2. `Application.start/2` spins up a supervision tree with `StateServer` and
   `SocketServer`.
3. `StateServer.init/1` reads `queue.json` into memory. On an unsupported
   schema version it refuses to start, preventing silent corruption.
4. `SocketServer.init/1` binds the Unix socket and launches the accept loop.

## Fallback strategy

CLI calls follow this order:

1. Try `connect(.dohyun/daemon.sock)` with a short timeout (≤200 ms).
2. On failure, fall through to the existing file-based writer.

This means **absence of the daemon is never an error**; the feature is purely
additive. Introducing the daemon in production does not require a migration —
users who never start it see zero change. See the relevant client code in
`src/runtime/daemon-client.ts` (introduced in T5).

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
