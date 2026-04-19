# dohyun — e2e tests

## Skip conditions

`daemon-cycle.test.mjs` and `daemon-prebuilt.test.mjs` include scenarios that
spawn the Elixir sidecar (`daemon/`). Those scenarios are wrapped in
`describe('...', { skip: !elixirAvailable() }, ...)` and are skipped when
`mix` and `elixir` binaries are not resolvable on `PATH`. CI containers
without Erlang/OTP installed see the off-path tests run as usual and the
daemon-on scenarios reported as `skipped` — no failure is raised.

To force-skip the daemon path even with Elixir present (e.g. to isolate a
regression), set `DOHYUN_NO_DAEMON=1` in the test environment.

## Running a single file

```
npm run build && node --test tests/e2e/daemon-cycle.test.mjs
```
