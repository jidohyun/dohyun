# @jidohyun/dohyun-daemon-darwin-arm64

Pre-built dohyun daemon release for macOS arm64 (Apple Silicon).

This package is an **optional dependency** of
[`@jidohyun/dohyun`](https://www.npmjs.com/package/@jidohyun/dohyun). Install
the main package and npm will select the matching platform bundle
automatically:

```bash
npm install @jidohyun/dohyun
dohyun daemon start
```

Do not install this package directly unless you know exactly which platform
bundle you need.

## What's inside

A self-contained Elixir/OTP `mix release` with ERTS embedded. `dohyun
daemon start` locates `release/bin/dohyun_daemon` here and runs
`bin/dohyun_daemon daemon` in detached mode.

## Repository

Source and issue tracker: <https://github.com/jidohyun/dohyun>
