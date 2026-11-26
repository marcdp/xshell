import assert from "node:assert/strict";
import test from "node:test";

import commandsContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/commands.json" with {type: "json"};
import contractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with {type: "json"};
import Commands from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/commands.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";

function createCommands(Command, tasks = new Tasks({bus: null}), config) {
    const loads = [];
    const commands = new Commands({
        loader: { async load(id) { loads.push(id); return Command; } },
        tasks,
        jsonValidator: new JsonValidator(),
        config
    });
    return {commands, loads, tasks};
}

class DisposableCommand {
    async dispose() {}
}

test("commands contract declares discovery and the asynchronous Task-backed run API", () => {
    const result = new JsonValidator().validate(commandsContract, contractSchema);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(Object.keys(commandsContract.methods), ["list", "getInfo", "run"]);
    assert.equal(commandsContract.methods.list.parameters[0].ref, "commandListOptions");
    assert.equal(commandsContract.methods.list.returns.ref, "commandDescriptorList");
    assert.equal(commandsContract.methods.run.parameters[0].ref, "commandRunOptions");
    assert.equal(commandsContract.methods.run.returns.ref, "task");
    assert.equal(commandsContract.types.commandRunOptions.schema.properties.background.default, true);
    assert.match(commandsContract.types.commandListOptions.schema.properties.query.description, /tags/);
});

test("commands discovers framework and module inventories without loading implementations", () => {
    class Command {}
    const frameworkResource = {type: "command", label: "Framework command", description: "Inspect runtime", icon: "x-runtime", category: "runtime"};
    const moduleResource = {type: "command", label: "Encrypt file", description: "Encrypts a file using AES.", icon: "x-lock", tags: ["security", "files"]};
    const config = {
        xshell: {assets: {path: "/_assets/xshell/1.0.0.dev"}, files: [
            {path: "/_assets/xshell/1.0.0.dev/commands/runtime.inspect.js", size: 100, resource: frameworkResource},
            {path: "/_assets/xshell/1.0.0.dev/pages/not-a-command.js", size: 1, resource: {type: "page"}}
        ]},
        modules: {
            empty: {assets: {path: "/_assets/empty/1.0.0.dev"}, files: []},
            filesystem: {assets: {path: "/_assets/filesystem/1.0.0.dev"}, files: [
                {path: "/_assets/filesystem/1.0.0.dev/commands/filesystem.entry.encrypt.aes.js", size: 1234, resource: moduleResource},
                {path: "/_assets/filesystem/1.0.0.dev/commands/nested/cleanup.js", size: 50},
                {path: "/_assets/filesystem/1.0.0.dev/commands/readme.txt", size: 2},
                {path: "/_assets/filesystem/1.0.0.dev/components/x-command.js", size: 3, resource: {type: "command", label: "Wrong path"}}
            ]}
        }
    };
    const {commands, loads} = createCommands(Command, new Tasks({bus: null}), config);
    assert.ok(["_loader", "_tasks", "_jsonValidator", "_config", "_discover", "_validateArgument"].every(name => !(name in commands)));

    const items = commands.list();

    assert.deepEqual(items.map(item => item.id), ["filesystem.entry.encrypt.aes", "nested/cleanup", "runtime.inspect"]);
    assert.deepEqual(items[0], {
        id: "filesystem.entry.encrypt.aes", moduleId: "filesystem", label: "Encrypt file", description: "Encrypts a file using AES.",
        tags: ["security", "files"], category: "filesystem", icon: "x-lock",
        path: "/_assets/filesystem/1.0.0.dev/commands/filesystem.entry.encrypt.aes.js", size: 1234
    });
    assert.deepEqual(items[1], {
        id: "nested/cleanup", moduleId: "filesystem", label: "", description: "", tags: [], category: "filesystem", icon: "",
        path: "/_assets/filesystem/1.0.0.dev/commands/nested/cleanup.js", size: 50
    });
    assert.equal(items[2].moduleId, "xshell");
    assert.equal(items[2].category, "runtime");
    assert.deepEqual(loads, []);
    assert.equal(Object.isFrozen(items), true);
    assert.equal(items.every(Object.isFrozen), true);
    assert.equal(items.every(item => Object.isFrozen(item.tags)), true);
    assert.notStrictEqual(items[0], moduleResource);
    assert.notStrictEqual(items[0].tags, moduleResource.tags);
    assert.throws(() => { items[0].label = "Changed"; }, TypeError);
    assert.throws(() => items[0].tags.push("other"), TypeError);
    assert.equal(moduleResource.label, "Encrypt file");

    assert.deepEqual(commands.list({moduleId: "filesystem"}).map(item => item.id), ["filesystem.entry.encrypt.aes", "nested/cleanup"]);
    assert.deepEqual(commands.list({category: "runtime"}).map(item => item.id), ["runtime.inspect"]);
    assert.deepEqual(commands.list({query: "AES"}).map(item => item.id), ["filesystem.entry.encrypt.aes"]);
    assert.deepEqual(commands.list({query: "SECURITY"}).map(item => item.id), ["filesystem.entry.encrypt.aes"]);
    assert.deepEqual(commands.list({moduleId: "filesystem", category: "filesystem", query: "FILES"}).map(item => item.id), ["filesystem.entry.encrypt.aes"]);
    assert.deepEqual(commands.list({moduleId: "filesystem", category: "runtime", query: "security"}), []);
    assert.deepEqual(commands.getInfo("filesystem.entry.encrypt.aes").tags, ["security", "files"]);
    assert.equal(commands.getInfo("nested/cleanup").path, "/_assets/filesystem/1.0.0.dev/commands/nested/cleanup.js");
    assert.equal(commands.getInfo("missing"), null);
    assert.deepEqual(loads, []);
});

test("commands loads by id, applies defaults and preserves declared positional order", async () => {
    const calls = [];
    const contexts = [];
    class Command extends DisposableCommand {
        static contract = {
            label: "Example",
            description: "Runs an example",
            types: {positive: {type: "integer", schema: {minimum: 1}}},
            execute: {parameters: [
                {name: "enabled", type: "boolean", required: true},
                {name: "count", ref: "positive", default: 2},
                {name: "note", type: "string", default: "fallback"}
            ]}
        };
        constructor(context) { super(); contexts.push(context); this.context = context; }
        execute(...args) { calls.push(args); return args; }
    }
    const {commands, loads, tasks} = createCommands(Command);

    const first = await commands.run({id: "example", args: {note: "", enabled: false}, background: false});
    const second = await commands.run({id: "example", args: {enabled: true, count: 3}});
    await Promise.all([first.wait(), second.wait()]);

    assert.deepEqual(loads, ["command:example", "command:example"]);
    assert.deepEqual(calls, [[false, 2, ""], [true, 3, "fallback"]]);
    assert.equal(first.background, false);
    assert.equal(second.background, true);
    assert.equal(first.title, "Example");
    assert.equal(first.description, "Runs an example");
    assert.equal(contexts.length, 2);
    assert.notEqual(contexts[0], contexts[1]);
    assert.equal(contexts[0].task.signal, first._signal);
    assert.deepEqual(await first.getResult(), [false, 2, ""]);
    assert.equal(tasks.list().length, 2);
});

test("commands rejects missing, unknown, typed, enum, named-type and schema-invalid arguments before Task creation", async () => {
    class Command {
        static contract = {
            types: {code: {type: "string", schema: {pattern: "^[A-Z]+$"}}},
            execute: {parameters: [
                {name: "name", type: "string", required: true, schema: {minLength: 2}},
                {name: "mode", type: "string", enum: ["safe", "fast"]},
                {name: "code", ref: "code"}
            ]}
        };
        execute() {}
    }
    const {commands, tasks} = createCommands(Command);
    const invalid = [
        [{mode: "safe", code: "OK"}, /Missing required argument 'name'/],
        [{name: "Ok", extra: 1}, /Unknown argument 'extra'/],
        [{name: 1}, /Invalid argument 'name'/],
        [{name: "Ok", mode: "other"}, /Invalid argument 'mode'/],
        [{name: "Ok", code: "lower"}, /Invalid argument 'code'/],
        [{name: "X"}, /Invalid argument 'name'/]
    ];

    for (const [args, message] of invalid) {
        await assert.rejects(commands.run({id: "validate", args}), message);
        assert.equal(tasks.list().length, 0);
    }
});

test("commands supports synchronous and asynchronous results and represents execution failures on Tasks", async () => {
    class SyncCommand extends DisposableCommand {
        static contract = {execute: {parameters: []}};
        execute() { return 7; }
    }
    class AsyncCommand extends DisposableCommand {
        static contract = {execute: {parameters: []}};
        async execute() { return "async"; }
    }
    class FailingCommand extends DisposableCommand {
        static contract = {execute: {parameters: []}};
        execute() { throw new Error("execution failed"); }
    }

    for (const [Command, expected] of [[SyncCommand, 7], [AsyncCommand, "async"]]) {
        const {commands} = createCommands(Command);
        const task = await commands.run({id: "result"});
        assert.equal(await task.getResult(), expected);
        assert.equal(task.status, "finished");
    }

    const {commands} = createCommands(FailingCommand);
    const task = await commands.run({id: "failure"});
    await task.wait();
    assert.equal(task.status, "error");
    assert.equal(task.error.message, "execution failed");
    await assert.rejects(task.getResult(), /execution failed/);
});

test("commands preserves cooperative cancellation and concurrent invocation isolation", async () => {
    const releases = [];
    const contexts = [];
    class Command extends DisposableCommand {
        static contract = {execute: {parameters: [{name: "value", type: "integer", required: true}]}};
        constructor({task}) { super(); this.task = task; contexts.push(task); }
        async execute(value) {
            return await new Promise((resolve, reject) => {
                const release = () => resolve(value);
                releases.push(release);
                this.task.signal.addEventListener("abort", () => reject(this.task.signal.reason), {once: true});
            });
        }
    }
    const {commands} = createCommands(Command);
    const [first, second] = await Promise.all([
        commands.run({id: "concurrent", args: {value: 1}, background: false}),
        commands.run({id: "concurrent", args: {value: 2}, background: true})
    ]);
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(contexts.length, 2);
    assert.notEqual(contexts[0], contexts[1]);
    await first.cancel();
    releases[1]();
    await Promise.all([first.wait(), second.wait()]);

    assert.equal(first.status, "canceled");
    assert.equal(second.status, "finished");
    assert.equal(await second.getResult(), 2);
});
