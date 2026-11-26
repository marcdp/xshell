# Commands

The application-wide `commands` service discovers available Commands, resolves executable implementations, and dispatches each execution through
the [Tasks](80-tasks.md) service.

Use [Queries](95-queries.md) to retrieve data directly through a declared return contract.

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

The optional `moduleId` and `category` filters are exact. `query` is a case-insensitive substring search across ID, label, description, and tags.
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
`file.resource.tags` without loading the Command. Tags participate in the `query` discovery filter but do not alter argument validation, Task
handling, or execution.

The Task handler constructs a fresh Command instance with `{ task: taskContext }` and calls `execute(...args)`. During construction, the Command
creates and owns one independent Services scope directly from the application root. Scope creation therefore happens only after Task execution
starts; loading and validation failures, or cancellation before the handler starts, create no scope. Command scopes never inherit the initiating
Page or Component scope, and concurrent Command instances use different scopes.

Definition-based Command controllers keep their existing `context`, `task`, `definition`, `module`, and `moduleConfig` injections. Ordinary service
names resolve through the Command-owned scope, and `controller({ services })` returns that scope. Application singletons remain shared, scoped
services are reused only within one Command, and transient services are constructed on every resolution.

```js
export default {
    contract: {
        label: "Example",
        execute: { parameters: [] }
    },

    controller({ services, task, preferences }) {
        return {
            async execute() {
                const session = services.resolve("editorSession");
                task.info("Executing command");

                // This Command's scope owns session.
                return { success: true };
            }
        };
    }
};
```

The handler awaits execution and then awaits `command.dispose()` before the Task reaches a terminal status. `Command.dispose()` disposes the scope
owned by that Command. Successful return values are preserved. Execution failures still trigger cleanup; disposal failures fail an otherwise
successful Task; and simultaneous execution and disposal failures are retained in an `AggregateError`. High-level `commands.run()` handles this
lifecycle automatically. Framework code that directly constructs a Command must likewise dispose every successfully constructed instance.

Tasks remains the owner of scheduling, status, progress, output, cooperative cancellation, errors, and results. Cancellation aborts the existing
Task signal but does not dispose a running Command's scope immediately. Cooperative and non-cooperative Commands retain their scope until execution
settles, after which cleanup completes before the Task becomes `canceled`. Foreground cancellation therefore does not tie Command resources to the
initiating Page lifetime, while background Commands remain equally independent. Command scopes can resolve the transient `events` and `timer`
services for function callbacks, and scope disposal cleans them up. Command scopes do not provide Page/Component controller dispatch, so string
callbacks are rejected clearly rather than bound implicitly.

The generic invocation Page resolves the Command itself to present its label, description, parameters, return metadata, and generated `x-schema`
editor. Its existing Task handler constructs and executes the Command directly, then awaits `Command.dispose()` before settling. Foreground Tasks
are canceled when that Page unloads; background Tasks continue. Ordinary Service-method invocation remains a separate shared-instance path.

Like other registered services, `commands` is available through `services.resolve("commands")` and controller injection as
`controller({ commands })`. Controller `postRender()` scheduling is a distinct injected function and does not conflict with this service.
