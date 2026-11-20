# Commands

The application-wide `commands` service discovers available Commands, resolves executable implementations, and dispatches each execution through
the [Tasks](80-tasks.md) service.

## Discovery

`commands.list(options = {})` synchronously returns frozen lightweight descriptors sorted by Command ID. It scans the effective
`config.xshell.files` and `config.modules[id].files` inventories that bootstrap also uses to register Command resolver entries; it does not load
JavaScript, issue network requests, or maintain a separate catalog. A descriptor contains `id`, `moduleId`, `label`, `description`, `tags`, `category`,
`icon`, `path`, and `size`. Tags are exposed as an independent frozen array, and missing tags become an empty array. Missing descriptive metadata
remains an empty string. Category uses authored resource metadata when available and
otherwise falls back to the owning module ID.

```js
const available = commands.list({ moduleId: "x-filesystem", query: "encrypt" });
const command = commands.getInfo("filesystem.entry.encrypt.aes");
```

The optional `moduleId` and `category` filters are exact. `query` is a case-insensitive substring search across ID, label, and description.
`commands.getInfo(id)` returns the same descriptor shape for an exact ID, or `null` when the Command is unknown. IDs follow bootstrap's existing
rule: the path below the owning `/commands/` directory with only the final `.js` removed, so nested paths retain `/` and dotted filenames retain
their dots.

The Diagnostics console's Commands Page presents these descriptors with ID, label, owner, category, tags, description, size, and source filters. Enter
or double-click on a Command row opens the existing invocation Page in stack mode. The listing uses the discovery API and therefore does not load
Command implementations; the invocation Page resolves the selected implementation only after activation. Discovery describes what can be
resolved, while execution remains the separate operation below.

## Execution

```js
const task = await commands.run({
    id: "filesystem.entry.encrypt.aes",
    args: {
        src: "opfs:",
        path: "/documents/test.txt",
        password: "secret"
    },
    background: false
});
```

`commands.run(options)` is asynchronous because Command resolution uses the Loader. It resolves to the live Task handle returned by `tasks.run()`;
it does not wait for Command execution to finish. Call `task.wait()` to wait for a terminal status or `task.getResult()` to wait for and retrieve a
successful result.

`options.id` is the required Command identifier. `options.args` is a named argument object and defaults to `{}`. `options.background` is forwarded
to Tasks and defaults to `true`, matching `tasks.run()`.

Before creating a Task, the service loads `command:<id>`, reads the Command's static `contract.execute`, applies contract defaults to omitted
arguments, preserves explicitly supplied values, validates required arguments, types, enums, named types, and JSON Schema constraints, and orders
the values according to the declared parameter list. Load and argument-validation failures therefore do not create Tasks.

Command definitions can also declare optional [usage examples](../20-components/10-manifest.md#usage-examples) in `contract.examples`.
They may declare lowercase kebab-case classification identifiers in `contract.tags`; generated inventory metadata copies those values to
`file.resource.tags` without loading the Command. Tags do not alter discovery filters, argument validation, Task handling, or execution.

The Task handler creates a fresh Command instance with `{ task: taskContext }` and calls `execute(...args)`. Tasks remains the owner of scheduling,
status, progress, output, cooperative cancellation, errors, and results. A Command exception or rejected promise propagates through the handler and
places the Task in `error`; the Commands service does not implement a separate lifecycle.

The generic invocation Page resolves the Command itself only to present its label, description, parameters, return metadata, and generated
`x-schema` editor. After UI validation it calls `commands.run()` and observes the returned Task. Foreground Tasks are canceled when that Page
unloads; background Tasks continue. Ordinary Service-method invocation remains a separate shared-instance path.

Like other registered services, `commands` is available through `services.resolve("commands")` and controller injection as
`controller({ commands })`. Controller `postRender()` scheduling is a distinct injected function and does not conflict with this service.
