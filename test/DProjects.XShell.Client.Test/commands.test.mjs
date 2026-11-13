import assert from "node:assert/strict";
import test from "node:test";

import commandsContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/commands.json" with {type: "json"};
import contractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with {type: "json"};
import Commands from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/commands.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";

function createCommands(Command, tasks = new Tasks({bus: null})) {
    const loads = [];
    const commands = new Commands({
        loader: { async load(id) { loads.push(id); return Command; } },
        tasks,
        jsonValidator: new JsonValidator()
    });
    return {commands, loads, tasks};
}

test("commands contract declares the asynchronous Task-backed run API and validates structurally", () => {
    const result = new JsonValidator().validate(commandsContract, contractSchema);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(Object.keys(commandsContract.methods), ["run"]);
    assert.equal(commandsContract.methods.run.parameters[0].ref, "commandRunOptions");
    assert.equal(commandsContract.methods.run.returns.ref, "task");
    assert.equal(commandsContract.types.commandRunOptions.schema.properties.background.default, true);
});

test("commands loads by id, applies defaults and preserves declared positional order", async () => {
    const calls = [];
    const contexts = [];
    class Command {
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
        constructor(context) { contexts.push(context); this.context = context; }
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
    class SyncCommand {
        static contract = {execute: {parameters: []}};
        execute() { return 7; }
    }
    class AsyncCommand {
        static contract = {execute: {parameters: []}};
        async execute() { return "async"; }
    }
    class FailingCommand {
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
    class Command {
        static contract = {execute: {parameters: [{name: "value", type: "integer", required: true}]}};
        constructor({task}) { this.task = task; contexts.push(task); }
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
