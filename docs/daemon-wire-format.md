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
{"cmd":"enqueue","args":{"title":"ship it","dod":["all green"]},"id":"cli-42"}
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

| code                 | meaning                                                                     |
|----------------------|-----------------------------------------------------------------------------|
| `parse`              | request line was not valid JSON or missing required `cmd` field             |
| `unknown_cmd`        | `cmd` is not implemented by this daemon version                             |
| `invalid_args`       | required args (e.g. `taskId`, `item`) are missing or wrong type             |
| `invalid_task`       | task payload failed shape validation (e.g. enqueue with empty title)        |
| `task_not_found`     | `reorder` referenced a task id that does not exist                          |
| `task_not_pending`   | `reorder` targeted a task that is not in `pending` status                   |
| `target_not_found`   | `reorder` with `mode:"before"` referenced an unknown anchor id              |
| `target_not_pending` | `reorder` with `mode:"before"` referenced an anchor that is not pending     |
| `invalid_target`     | `reorder` target shape was neither `{mode:"first"}` nor `{mode:"before",id}` |

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

### `enqueue`

Appends a new task to the queue. The daemon generates `id`, `createdAt`, and
`updatedAt`; the client supplies the business fields.

Request `args`:

```
{
  "title":       "<string, required, non-empty>",
  "description": <string | null, optional>,
  "status":      "<string, optional, default 'pending'>",
  "priority":    "<string, optional, default 'normal'>",
  "type":        "<string, optional, default 'feature'>",
  "dod":         [ "<string>", ... ],   // optional, default []
  "metadata":    { ... }                // optional, default {}
}
```

Response `data`: `{"task": <Task>}`  
Errors: `invalid_args` (no title).

### `dequeue`

Flips the first `pending` task to `in_progress` and stamps `startedAt`.

Request: `{"cmd":"dequeue"}`  
Response `data`: `{"task": <Task> | null}` — `null` when nothing is pending.

### `complete`

Marks a task completed, stamping `completedAt`.

Request `args`: `{"taskId": "<string>"}`  
Response `data`: `{"task": <Task> | null}` — `null` for unknown id.  
Errors: `invalid_args`.

### `review_pending`

Transitions a task into `review-pending`.

Request `args`: `{"taskId": "<string>"}`  
Response `data`: `{"task": <Task> | null}`.  
Errors: `invalid_args`.

### `check_dod`

Appends a DoD line to the task's `dodChecked` list. Idempotent — duplicates
are not added.

Request `args`: `{"taskId": "<string>", "item": "<string>"}`  
Response `data`: `{"task": <Task> | null}`.  
Errors: `invalid_args`.

### `cancel_all`

Marks every `pending` or `in_progress` task as `cancelled`.

Request: `{"cmd":"cancel_all"}`  
Response `data`: `{"count": <integer>}` — number of tasks flipped.

### `prune_cancelled`

Removes every `cancelled` task from the queue.

Request: `{"cmd":"prune_cancelled"}`  
Response `data`: `{"count": <integer>}` — number of tasks removed.

### `reorder`

Moves a `pending` task within the pending segment. Non-pending tasks are
untouched.

Request `args`:

```
{
  "taskId": "<string>",
  "target": { "mode": "first" }
            | { "mode": "before", "id": "<anchor task id>" }
}
```

Response `data`: `{}` on success.  
Errors: `invalid_args`, `task_not_found`, `task_not_pending`,
`target_not_found`, `target_not_pending`, `invalid_target`.

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
