import assert from "node:assert/strict";
import test from "node:test";

import Commands from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/commands.js";
import Events from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/events.js";
import Timer from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/timer.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import LoaderCommandJs from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/command-js.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";

let instanceId = 0;

function assertScopeActive(scope) {
    assert.doesNotThrow(() => scope.has("__test__"));
}

function assertScopeDisposed(scope) {
    assert.throws(() => scope.has("__test__"), /Services scope is disposed/);
}

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

class OwnedCommand {
    constructor({task} = {}) {
        // mirror the production Command ownership contract for orchestration-only tests
        this.task = task;
        this.services = this.constructor.root.beginScope();
    }
    async dispose() {
        // release the scope owned by this fake Command
        await this.services.dispose();
    }
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
    Command.root = root;
    const commands = new Commands({
        loader: loader ?? {async load() { return Command; }},
        tasks,
        jsonValidator: new JsonValidator(),
        config: {xshell: {}, modules: {}}
    });
    return {commands, root, tasks, disposed};
}

test("each concurrent Command invocation owns an independent direct-root lifetime scope", async () => {
    const invocations = [];
    class Placeholder extends OwnedCommand {
        static contract = {execute: {parameters: []}};
        execute() {}
    }
    const {commands, root, disposed} = createRuntime(Placeholder);
    root.register("hooks", {invocations});
    const schema = {type: "object", required: ["contract", "controller"], properties: {contract: {type: "object"}, controller: {type: "object"}}};
    const context = {
        resourceDefinition: {moduleId: "sample"},
        services: {
            loader: {async load(id) { assert.equal(id, "schema:command"); return schema; }},
            config: {modules: {sample: {id: "sample"}}},
            modules: {getModuleById() { return {id: "sample"}; }},
            services: root
        }
    };
    const source = `export default {
        contract: {label: "Scoped command", execute: {parameters: [{name: "value", type: "integer", required: true}]}},
        controller(provider) {
            const session = provider.session;
            provider.hooks.invocations.push({task: provider.task, services: provider.services, rootServices: provider.services.resolve("services"), singleton: provider.singleton, session,
                repeated: provider.session, transients: [provider.formatter, provider.formatter]});
            return {execute(value) { return value; }};
        }
    };`;
    const src = `data:text/javascript,${encodeURIComponent(source)}#${crypto.randomUUID()}`;
    const Command = await new LoaderCommandJs().load(src, context);
    commands._loader = {async load() { return Command; }};

    const [foreground, background] = await Promise.all([
        commands.run({id: "scoped", args: {value: 1}, background: false}),
        commands.run({id: "scoped", args: {value: 2}, background: true})
    ]);

    assert.equal(invocations.length, 2);
    assert.notStrictEqual(invocations[0].services, invocations[1].services);
    assert.ok(invocations.every(invocation => invocation.services !== root && invocation.rootServices === root));
    assert.deepEqual(await Promise.all([foreground.getResult(), background.getResult()]), [1, 2]);
    assert.strictEqual(invocations[0].singleton, invocations[1].singleton);
    assert.strictEqual(invocations[0].session, invocations[0].repeated);
    assert.notStrictEqual(invocations[0].session, invocations[1].session);
    assert.ok(invocations.every(invocation => invocation.transients[0] !== invocation.transients[1]));
    assert.strictEqual(invocations[0].task.signal, foreground._signal);
    assert.equal(foreground.background, false);
    assert.equal(background.background, true);
    invocations.forEach(invocation => assertScopeDisposed(invocation.services));
    assert.equal(disposed.filter(item => item.startsWith("scoped:")).length, 2);
    assert.equal(disposed.filter(item => item.startsWith("transient:")).length, 4);
});

test("loading and argument validation finish before Task or scope creation", async () => {
    class Command extends OwnedCommand {
        static contract = {execute: {parameters: [{name: "required", type: "string", required: true}]}};
        execute() {}
    }
    const {commands, root, tasks} = createRuntime(Command);

    await assert.rejects(commands.run({id: "invalid", args: {}}), /Missing required argument/);
    assert.equal(tasks.list().length, 0);

    const loadFailure = new Error("load failed");
    const failed = createRuntime(Command, {loader: {async load() { throw loadFailure; }}});
    await assert.rejects(failed.commands.run({id: "missing"}), error => error === loadFailure);
    assert.equal(failed.tasks.list().length, 0);
});

test("scope creation occurs inside the Task handler immediately before Command construction", async () => {
    let taskOptions;
    const tasks = {run(options) { taskOptions = options; return {marker: "task"}; }};
    let constructedScope;
    class Command extends OwnedCommand {
        static contract = {execute: {parameters: []}};
        constructor(context) { super(context); constructedScope = this.services; }
        execute() { return "done"; }
    }
    const {commands, root} = createRuntime(Command, {tasks});

    const task = await commands.run({id: "deferred"});
    assert.deepEqual(task, {marker: "task"});

    const result = await taskOptions.handler({signal: new AbortController().signal});
    assert.equal(result, "done");
    assertScopeDisposed(constructedScope);
});

test("canceling a pending Task before its handler starts creates no Command scope", async () => {
    let taskOptions;
    let constructed = false;
    const task = {status: "pending", async cancel() { this.status = "canceled"; }};
    const tasks = {run(options) { taskOptions = options; return task; }};
    class Command extends OwnedCommand {
        static contract = {execute: {parameters: []}};
        constructor(context) { super(context); constructed = true; }
        execute() {}
    }
    const {commands, root} = createRuntime(Command, {tasks});

    assert.strictEqual(await commands.run({id: "pending"}), task);
    await task.cancel();

    assert.equal(task.status, "canceled");
    assert.equal(constructed, false);
    assert.equal(typeof taskOptions.handler, "function");
});

test("Task completion waits for invocation scope disposal and preserves the result", async () => {
    const cleanup = deferred();
    const cleanupStarted = deferred();
    let scope;
    class Command extends OwnedCommand {
        static contract = {execute: {parameters: []}};
        constructor(context) { super(context); scope = this.services; this.session = this.services.resolve("session"); }
        execute() { return {value: 42}; }
    }
    const {commands, root} = createRuntime(Command, {dispose: async () => { cleanupStarted.resolve(); await cleanup.promise; }});
    const task = await commands.run({id: "cleanup"});

    await cleanupStarted.promise;
    assert.equal(task.status, "running");
    assert.throws(() => scope.has("__test__"), /Services scope is disposing/);
    cleanup.resolve();

    assert.deepEqual(await task.getResult(), {value: 42});
    assert.equal(task.status, "finished");
    assertScopeDisposed(scope);
});

test("execution, disposal, and combined failures dispose exactly once", async () => {
    const executionFailure = new Error("execution failed");
    class ExecutionFailure extends OwnedCommand {
        static contract = {execute: {parameters: []}};
        constructor(context) { super(context); this.session = this.services.resolve("session"); }
        execute() { throw executionFailure; }
    }
    const executed = createRuntime(ExecutionFailure);
    const executionTask = await executed.commands.run({id: "execution-failure"});
    await assert.rejects(executionTask.getResult(), error => error === executionFailure);
    assert.equal(executed.disposed.length, 1);

    const disposalFailure = new Error("disposal failed");
    const combined = createRuntime(ExecutionFailure, {dispose() { throw disposalFailure; }});
    const combinedTask = await combined.commands.run({id: "combined-failure"});
    await assert.rejects(combinedTask.getResult(), error => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [executionFailure, disposalFailure]);
        return true;
    });
    assert.equal(combined.disposed.length, 1);

    class Successful extends OwnedCommand {
        static contract = {execute: {parameters: []}};
        constructor(context) { super(context); this.session = this.services.resolve("session"); }
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
    class Command extends OwnedCommand {
        static contract = {execute: {parameters: []}};
        constructor(context) { super(context); scope = this.services; this.session = scope.resolve("session"); }
        async execute() { executing.resolve(); return await release.promise; }
    }
    const {commands, root, disposed} = createRuntime(Command);
    const task = await commands.run({id: "non-cooperative"});
    await executing.promise;

    await task.cancel();
    assert.equal(task.status, "running");
    assertScopeActive(scope);

    release.resolve("ignored");
    await task.wait();
    assert.equal(task.status, "canceled");
    await assert.rejects(task.getResult(), error => error?.name === "AbortError");
    assertScopeDisposed(scope);
    assert.equal(disposed.length, 1);
});

test("Command scopes own transient Events and Timer helpers without implicit controller dispatch", async () => {
    const target = new EventTarget();
    let calls = 0;
    let helpers;
    class Command extends OwnedCommand {
        static contract = {execute: {parameters: []}};
        constructor(context) {
            super(context);
            helpers = {events: this.services.resolve("events"), timer: this.services.resolve("timer")};
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
    assert.throws(() => helpers.events.on(target, "after-dispose", "refresh"), /require a Services scope controller context/);
    assert.throws(() => helpers.timer.setTimeout("refresh", 0), /require a Services scope controller context/);
});

test("cancellation during asynchronous disposal waits for uninterrupted cleanup", async () => {
    const cleanupStarted = deferred();
    const releaseCleanup = deferred();
    let scope;
    class Command extends OwnedCommand {
        static contract = {execute: {parameters: []}};
        constructor(context) { super(context); scope = this.services; this.session = this.services.resolve("session"); }
        execute() { return "complete"; }
    }
    const {commands, root} = createRuntime(Command, {dispose: async () => { cleanupStarted.resolve(); await releaseCleanup.promise; }});
    const task = await commands.run({id: "cancel-cleanup"});
    await cleanupStarted.promise;

    await task.cancel();
    assert.equal(task.status, "running");
    assert.throws(() => scope.has("__test__"), /Services scope is disposing/);
    releaseCleanup.resolve();

    await task.wait();
    assert.equal(task.status, "canceled");
    assertScopeDisposed(scope);
});

test("disposal failures during cancellation are handled and reported without changing canceled status", async t => {
    const cleanupFailure = new Error("canceled cleanup failed");
    const executing = deferred();
    const release = deferred();
    let scope;
    class Command extends OwnedCommand {
        static contract = {execute: {parameters: []}};
        constructor(context) { super(context); scope = this.services; this.session = this.services.resolve("session"); }
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
    assertScopeDisposed(scope);
    assert.equal(reported.length, 1);
    assert.match(reported[0][0], /canceled Command 'canceled-cleanup-failure'/);
    assert.strictEqual(reported[0][1], cleanupFailure);
    await assert.rejects(task.getResult(), error => error?.name === "AbortError");
});
