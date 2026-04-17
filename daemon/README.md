# dohyun_daemon (optional)

Long-running Elixir GenServer that serializes writes to `.dohyun/runtime/*.json`.
**Opt-in**: the TS CLI works without it. When present, CLI delegates state mutations
via Unix socket to avoid race conditions between concurrent sessions.

## Requirements

- Elixir `~> 1.16` (developed on 1.19)
- OTP 26+

## Build & run

```bash
cd daemon
mix deps.get
mix compile
mix run --no-halt   # start daemon (attaches to .dohyun/ in parent dir)
```

## Test

```bash
mix test
```

## Wire format

See `../docs/daemon-wire-format.md` (created in T3).
