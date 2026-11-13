# Commands

The application-wide `commands` service resolves executable Commands and dispatches each execution through the [Tasks](80-tasks.md) service. It
provides one public method:

```js
const task = await commands.run({
    id: "encrypt-aes",
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

The Task handler creates a fresh Command instance with `{ task: taskContext }` and calls `execute(...args)`. Tasks remains the owner of scheduling,
status, progress, output, cooperative cancellation, errors, and results. A Command exception or rejected promise propagates through the handler and
places the Task in `error`; the Commands service does not implement a separate lifecycle.

The generic invocation Page resolves the Command itself only to present its label, description, parameters, return metadata, and generated
`x-schema` editor. After UI validation it calls `commands.run()` and observes the returned Task. Foreground Tasks are canceled when that Page
unloads; background Tasks continue. Ordinary Service-method invocation remains a separate shared-instance path.

Like other registered services, `commands` is available through `services.resolve("commands")` and controller injection as
`controller({ commands })`. Controller `postRender()` scheduling is a distinct injected function and does not conflict with this service.
