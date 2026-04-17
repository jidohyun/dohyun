# Daemon Wire Format v1

Line-delimited JSON over a Unix domain socket at `.dohyun/daemon.sock`.
Each request and response ends with a `\n`. One connection may send multiple
requests; replies are returned in order.

This contract is **stable across 0.x minor releases**. Field additions are
allowed; removing or renaming a field is a major bump.

## Envelope — Request

```
{
  "cmd":  "<string>",    // required — command name, e.g. "status"
  "args": { ... },       // optional — command-specific payload (object)
  "id":   "<string>"     // optional — echoed in reply when provided
}
```

Examples:

```json
{"cmd":"status"}
{"cmd":"enqueue","args":{"task":{...}},"id":"cli-42"}
```

## Envelope — Response

Success:

```
{
  "ok":   true,
  "data": { ... },       // command-specific result (object)
  "id":   "<string>"     // echoed from request if present
}
```

Error:

```
{
  "ok":    false,
  "error": "<string>",   // stable machine-readable code
  "id":    "<string>"    // echoed from request if present
}
```

## Error codes

| code           | meaning                                                           |
|----------------|-------------------------------------------------------------------|
| `parse`        | request line was not valid JSON or missing required `cmd` field   |
| `unknown_cmd`  | `cmd` is not implemented by this daemon version                   |
| `invalid_task` | payload failed task-shape validation (e.g. enqueue with bad task) |

Unknown errors from the daemon itself bubble up as `error: "internal"` — the
client should retry through the file-based fallback when it sees this.

## Commands

### `status`

Returns a snapshot the CLI can render instead of reading state files directly.

Request: `{"cmd":"status"}`

Response `data`:

```
{
  "queue": {
    "version": 1,
    "tasks":   [ ... ]
  }
}
```

Additional fields (e.g. `session`, `activeTask`) will be added in later releases.

### `enqueue` *(introduced with T6)*

Request: `{"cmd":"enqueue","args":{"task":{...}}}`  
Response `data`: `{"task": {...}}` — the task as stored (server may normalize).  
Errors: `invalid_task`.

## Connection lifecycle

* The client must connect with `AF_UNIX` / `SOCK_STREAM`.
* A malformed JSON line does **not** close the connection — the daemon replies
  with `{"ok": false, "error": "parse"}` and keeps reading.
* The daemon may close the connection on its side at shutdown; clients must
  reconnect or fall back to direct file writes.

## Version negotiation

There is no handshake in v1. The daemon version is readable via the eventual
`{"cmd":"version"}` command; until then, clients assume v1. A client that
receives `unknown_cmd` for `status` should fall back to file mode.
