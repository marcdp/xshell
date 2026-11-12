# Tasks

The `tasks` service owns one registry of asynchronous Tasks. `tasks.run(options)` returns a stable, observable Task handle immediately and starts
`options.handler(context)` asynchronously. The handler context provides cooperative cancellation through `signal`, progress and description
reporting, and ordered stdout/stderr output.

`options.background` selects ownership and global visibility when the Task is created:

- `true` (the service default) creates a background Task. It appears in the global Tasks dropdown and Page and may continue independently of the
  UI that started it.
- `false` creates a foreground Task. Its owning UI controls its lifetime, and the global Tasks dropdown and Page do not display it.

Both kinds use the same Task class, registry, execution context, status model, cancellation behavior, and result/output APIs. The read-only
`task.background` property reports the selected mode. `tasks.list()` returns both foreground and background Tasks; UI consumers apply visibility
filtering themselves. `get()`, `clear()`, and `remove()` likewise operate across both kinds.

The generic Command invocation Page runs Commands through `tasks.run()` as foreground Tasks by default. It continues to display the current Task's
status, progress, output, error, and result locally. Closing or unloading that Page requests cancellation of a pending or running foreground Task.
Selecting **Advanced / Run in background** creates a background Task instead, so it is also globally visible and survives Page unload. Explicit
Cancel still requests cancellation in either mode.
