# Tasks

The `tasks` service owns one registry of asynchronous Tasks. `tasks.run(options)` returns a stable, observable Task handle immediately and starts
`options.handler(context)` asynchronously. The handler context provides cooperative cancellation through `signal`, progress and description
reporting, and ordered level-based execution output through `log(text)`, `info(text)`, `warn(text)`, and `error(text)`.

The Tasks service owns both sides of execution: `taskContext` is the producer-side interface used by the handler (and injected into Commands as
`task`), while the stable `Task` handle returned by `run()`, `get()`, and `list()` is the consumer-side interface for observation and control.
Both concepts, along with `taskOutput`, are declared by the single `tasks` service contract.

`log` records general execution output, `info` records informational messages, `warn` records non-fatal warnings, and `error` records error-level
output. Output severity is independent of the Task lifecycle: calling `taskContext.error(...)` (or the injected `task.error(...)` in a Command)
does not fail the Task. A Task enters the `error` status only when its handler throws or rejects.

`options.background` selects ownership and global visibility when the Task is created:

- `true` (the service default) creates a background Task. It appears in the global Tasks dropdown and Page and may continue independently of the
  UI that started it.
- `false` creates a foreground Task. Its owning UI controls its lifetime, and the global Tasks dropdown and Page do not display it.

Both kinds use the same Task class, registry, execution context, status model, cancellation behavior, and result/output APIs. The read-only
`task.background` property reports the selected mode. `tasks.list()` returns both foreground and background Tasks; UI consumers apply visibility
filtering themselves. `get()`, `clear()`, and `remove()` likewise operate across both kinds.

The [Commands](90-commands.md) service uses `tasks.run()` for Command execution. The generic Command invocation Page calls that service with
`background: false` by default and continues to display the returned Task's status, progress, output, error, and result locally. Closing or
unloading that Page requests cancellation of a pending or running foreground Task. Selecting **Advanced / Run in background** creates a background
Task instead, so it is also globally visible and survives Page unload. Explicit Cancel still requests cancellation in either mode.
