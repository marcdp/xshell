import assert from "node:assert/strict";
import test from "node:test";

import Commands from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/commands.js";
import Events from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/events.js";
import Timer from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/timer.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";

let instanceId = 0;

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function createRuntime(Command, { dispose, loader, tasks = new Tasks({bus: null}) } = {}) {
    const root = new Services({config: {xshell: {services: {}}}, bus: null});
    const disposed = [];
    class Singleton {
        static optionsSchema = {type: "object", additionalProperties: false};
        constructor() { this.id = ++instanceId; }
        dispose() { throw new Error("Invocation scopes must not dispose singletons."); }
    }
    class Scoped {
        static optionsSchema = {type: "object", additionalProperties: false};
        constructor() { this.id = ++instanceId; }
        async dispose() { disposed.push(`scoped:${this.id}`); await dispose?.(this); }
    }
    class Transient {
        static optionsSchema = {type: "object", additionalProperties: false};
        constructor() { this.id = ++instanceId; }
        async dispose() { disposed.push(`transient:${this.id}`); }
    }
    root.register("services", root);
    root.register("singleton", null, {implementationItem: {class: Singleton}});
    root.register("session", null, {lifetime: "scoped", implementationItem: {class: Scoped}});
    root.register("formatter", null, {lifetime: "transient", implementationItem: {class: Transient}});
    root.register("events", null, {lifetime: "transient", implementationItem: {class: Events}});
    root.register("timer", null, {lifetime: "transient", implementationItem: {class: Timer}});
    const commands = new Commands({
        loader: loader ?? {async load() { return Command; }},
        tasks,
        jsonValidator: new JsonValidator(),
        config: {xshell: {}, modules: {}},
        services: root
    });
    return {commands, root, tasks, disposed};
}

test("each concurrent Command invocation owns an independent direct-root lifetime scope", async () => {
    const invocations = [];
    class Command {
        static contract = {label: "Scoped command", execute: {parameters: [{name: "value", type: "integer", required: true}]}};
        constructor({task, services}) {
            const session = services.resolve("session");
            invocations.push({task, services, singleton: services.resolve("singleton"), session, repeated: services.resolve("session"),
                transients: [services.resolve("formatter"), services.resolve("formatter")]});
        }
        execute(value) { return value; }
    }
    const {commands, root, disposed} = createRuntime(Command);

    const [foreground, background] = await Promise.all([
        commands.run({id: "scoped", args: {value: 1}, background: false}),
        commands.run({id: "scoped", args: {value: 2}, background: true})
    ]);
    assert.deepEqual(await Promise.all([foreground.getResult(), background.getResult()]), [1, 2]);

    assert.equal(invocations.length, 2);
    assert.notStrictEqual(invocations[0].services, invocations[1].services);
    assert.ok(invocations.every(invocation => invocation.services._parent === root));
    assert.strictEqual(invocations[0].singleton, invocations[1].singleton);
    assert.strictEqual(invocations[0].session, invocations[0].repeated);
    assert.notStrictEqual(invocations[0].session, invocations[1].session);
    assert.ok(invocations.every(invocation => invocation.transients[0] !== invocation.transients[1]));
    assert.strictEqual(invocations[0].task.signal, foreground._signal);
    assert.equal(foreground.background, false);
    assert.equal(background.background, true);
    assert.equal(root._children.length, 0);
    assert.equal(disposed.filter(item => item.startsWith("scoped:")).length, 2);
    assert.equal(disposed.filter(item => item.startsWith("transient:")).length, 4);
});

test("loading and argument validation finish before Task or scope creation", async () => {
    class Command {
        static contract = {execute: {parameters: [{name: "required", type: "string", required: true}]}};
        execute() {}
    }
    const {commands, root, tasks} = createRuntime(Command);

    await assert.rejects(commands.run({id: "invalid", args: {}}), /Missing required argument/);
    assert.equal(tasks.list().length, 0);
    assert.equal(root._children.length, 0);

    const loadFailure = new Error("load failed");
    const failed = createRuntime(Command, {loader: {async load() { throw loadFailure; }}});
    await assert.rejects(failed.commands.run({id: "missing"}), error => error === loadFailure);
    assert.equal(failed.tasks.list().length, 0);
    assert.equal(failed.root._children.length, 0);
});

test("scope creation occurs inside the Task handler immediately before Command construction", async () => {
    let taskOptions;
    const tasks = {run(options) { taskOptions = options; return {marker: "task"}; }};
    let constructedScope;
    class Command {
        static contract = {execute: {parameters: []}};
        constructor({services}) { constructedScope = services; }
        execute() { return "done"; }
    }
    const {commands, root} = createRuntime(Command, {tasks});

    const task = await commands.run({id: "deferred"});
    assert.deepEqual(task, {marker: "task"});
    assert.equal(root._children.length, 0);

    const result = await taskOptions.handler({signal: new AbortController().signal});
    assert.equal(result, "done");
    assert.equal(constructedScope._parent, root);
    assert.equal(root._children.length, 0);
});

test("canceling a pending Task before its handler starts creates no Command scope", async () => {
    let taskOptions;
    let constructed = false;
    const task = {status: "pending", async cancel() { this.status = "canceled"; }};
    const tasks = {run(options) { taskOptions = options; return task; }};
    class Command {
        static contract = {execute: {parameters: []}};
        constructor() { constructed = true; }
        execute() {}
    }
    const {commands, root} = createRuntime(Command, {tasks});

    assert.strictEqual(await commands.run({id: "pending"}), task);
    await task.cancel();

    assert.equal(task.status, "canceled");
    assert.equal(constructed, false);
    assert.equal(root._children.length, 0);
    assert.equal(typeof taskOptions.handler, "function");
});

test("Task completion waits for invocation scope disposal and preserves the result", async () => {
    const cleanup = deferred();
    const cleanupStarted = deferred();
    class Command {
        static contract = {execute: {parameters: []}};
        constructor({services}) { this.session = services.resolve("session"); }
        execute() { return {value: 42}; }
    }
    const {commands, root} = createRuntime(Command, {dispose: async () => { cleanupStarted.resolve(); await cleanup.promise; }});
    const task = await commands.run({id: "cleanup"});

    await cleanupStarted.promise;
    assert.equal(task.status, "running");
    assert.equal(root._children.length, 1);
    cleanup.resolve();

    assert.deepEqual(await task.getResult(), {value: 42});
    assert.equal(task.status, "finished");
    assert.equal(root._children.length, 0);
});

test("constructor, execution, disposal, and combined failures dispose exactly once", async () => {
    const constructorFailure = new Error("constructor failed");
    class ConstructorFailure {
        static contract = {execute: {parameters: []}};
        constructor({services}) { services.resolve("session"); throw constructorFailure; }
    }
    const constructed = createRuntime(ConstructorFailure);
    const constructorTask = await constructed.commands.run({id: "constructor-failure"});
    await assert.rejects(constructorTask.getResult(), error => error === constructorFailure);
    assert.equal(constructed.root._children.length, 0);
    assert.equal(constructed.disposed.length, 1);

    const executionFailure = new Error("execution failed");
    class ExecutionFailure {
        static contract = {execute: {parameters: []}};
        constructor({services}) { this.session = services.resolve("session"); }
        execute() { throw executionFailure; }
    }
    const executed = createRuntime(ExecutionFailure);
    const executionTask = await executed.commands.run({id: "execution-failure"});
    await assert.rejects(executionTask.getResult(), error => error === executionFailure);
    assert.equal(executed.root._children.length, 0);

    const disposalFailure = new Error("disposal failed");
    const combined = createRuntime(ExecutionFailure, {dispose() { throw disposalFailure; }});
    const combinedTask = await combined.commands.run({id: "combined-failure"});
    await assert.rejects(combinedTask.getResult(), error => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [executionFailure, disposalFailure]);
        return true;
    });
    assert.equal(combined.root._children.length, 0);

    class Successful {
        static contract = {execute: {parameters: []}};
        constructor({services}) { this.session = services.resolve("session"); }
        execute() { return true; }
    }
    const disposalOnly = createRuntime(Successful, {dispose() { throw disposalFailure; }});
    const disposalTask = await disposalOnly.commands.run({id: "disposal-failure"});
    await assert.rejects(disposalTask.getResult(), error => error === disposalFailure);
    assert.equal(disposalTask.status, "error");
});

test("cancellation keeps a non-cooperative Command scope alive until execution settles", async () => {
    const executing = deferred();
    const release = deferred();
    let scope;
    class Command {
        static contract = {execute: {parameters: []}};
        constructor(context) { scope = context.services; this.session = scope.resolve("session"); }
        async execute() { executing.resolve(); return await release.promise; }
    }
    const {commands, root, disposed} = createRuntime(Command);
    const task = await commands.run({id: "non-cooperative"});
    await executing.promise;

    await task.cancel();
    assert.equal(task.status, "running");
    assert.equal(scope._lifecycleState, "active");
    assert.equal(root._children.length, 1);

    release.resolve("ignored");
    await task.wait();
    assert.equal(task.status, "canceled");
    await assert.rejects(task.getResult(), error => error?.name === "AbortError");
    assert.equal(root._children.length, 0);
    assert.equal(disposed.length, 1);
});

test("Command scopes own transient Events and Timer helpers without implicit controller dispatch", async () => {
    const target = new EventTarget();
    let calls = 0;
    let helpers;
    class Command {
        static contract = {execute: {parameters: []}};
        constructor({services}) {
            helpers = {events: services.resolve("events"), timer: services.resolve("timer")};
            helpers.events.on(target, "run", () => calls++);
            helpers.timer.setTimeout(() => calls++, 100);
            assert.throws(() => helpers.events.on(target, "missing", "refresh"), /require a Services scope controller context/);
        }
        execute() { target.dispatchEvent(new Event("run")); return calls; }
    }
    const {commands} = createRuntime(Command);
    const task = await commands.run({id: "helpers"});

    assert.equal(await task.getResult(), 1);
    target.dispatchEvent(new Event("run"));
    assert.equal(calls, 1);
    assert.equal(helpers.events._handler, null);
    assert.equal(helpers.timer._handler, null);
});

test("cancellation during asynchronous disposal waits for uninterrupted cleanup", async () => {
    const cleanupStarted = deferred();
    const releaseCleanup = deferred();
    class Command {
        static contract = {execute: {parameters: []}};
        constructor({services}) { this.session = services.resolve("session"); }
        execute() { return "complete"; }
    }
    const {commands, root} = createRuntime(Command, {dispose: async () => { cleanupStarted.resolve(); await releaseCleanup.promise; }});
    const task = await commands.run({id: "cancel-cleanup"});
    await cleanupStarted.promise;

    await task.cancel();
    assert.equal(task.status, "running");
    assert.equal(root._children.length, 1);
    releaseCleanup.resolve();

    await task.wait();
    assert.equal(task.status, "canceled");
    assert.equal(root._children.length, 0);
});

test("disposal failures during cancellation are handled and reported without changing canceled status", async t => {
    const cleanupFailure = new Error("canceled cleanup failed");
    const executing = deferred();
    const release = deferred();
    class Command {
        static contract = {execute: {parameters: []}};
        constructor({services}) { this.session = services.resolve("session"); }
        async execute() { executing.resolve(); await release.promise; }
    }
    const reported = [];
    t.mock.method(console, "error", (...args) => reported.push(args));
    const {commands, root} = createRuntime(Command, {dispose() { throw cleanupFailure; }});
    const task = await commands.run({id: "canceled-cleanup-failure"});
    await executing.promise;

    await task.cancel();
    release.resolve();
    await task.wait();

    assert.equal(task.status, "canceled");
    assert.equal(root._children.length, 0);
    assert.equal(reported.length, 1);
    assert.match(reported[0][0], /canceled Command 'canceled-cleanup-failure'/);
    assert.strictEqual(reported[0][1], cleanupFailure);
    await assert.rejects(task.getResult(), error => error?.name === "AbortError");
});
