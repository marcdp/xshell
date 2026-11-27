import assert from "node:assert/strict";
import test from "node:test";

import invokeDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/invoke.js";
import Logger from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/logger.js";
import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";

function createInvocation(Command, {background = true} = {}) {
    const tasks = new Tasks({logger: new Logger({}), bus: null});
    const state = structuredClone(invokeDefinition.state);
    Object.assign(state, {type: "command", id: "example", method: "execute", args: {value: 7}, background});
    const page = {closed: false, close() { this.closed = true; }, invalidate() {}};
    const loader = {async load(id) { assert.equal(id, "command:example"); return Command; }};
    const controller = invokeDefinition.controller({state, loader, services: {}, contracts: {}, page, tasks});
    return {controller, page, state, tasks};
}

test("generic invocation awaits Command disposal and preserves foreground/background behavior", async () => {
    const order = [];
    class Command {
        static contract = {label: "Example", execute: {parameters: [{name: "value", type: "integer", required: true}]}};
        constructor(context) { order.push("construct"); this.context = context; }
        async execute(value) { order.push(`execute:${value}`); return value * 2; }
        async dispose() { order.push("dispose"); }
    }

    const background = createInvocation(Command, {background: true});
    await background.controller.load();
    await background.controller.submit();
    const backgroundTask = background.tasks.list()[0];
    assert.equal(background.page.closed, true);
    assert.equal(await backgroundTask.getResult(), 14);
    assert.deepEqual(order, ["construct", "execute:7", "dispose"]);

    order.length = 0;
    const foreground = createInvocation(Command, {background: false});
    await foreground.controller.load();
    await foreground.controller.submit();
    const foregroundTask = foreground.tasks.list()[0];
    assert.equal(foreground.page.closed, false);
    assert.equal(foregroundTask.status, "finished");
    assert.equal(foreground.state.completed, true);
    assert.equal(foreground.state.result, 14);
    assert.deepEqual(order, ["construct", "execute:7", "dispose"]);
});

test("generic invocation disposes after failures and preserves disposal error combinations", async () => {
    const executionError = new Error("execution failed");
    const disposalError = new Error("disposal failed");
    let disposals = 0;
    class CombinedFailure {
        static contract = {label: "Failure", execute: {parameters: []}};
        execute() { throw executionError; }
        async dispose() { disposals++; throw disposalError; }
    }
    const combined = createInvocation(CombinedFailure);
    combined.state.args = {};
    await combined.controller.load();
    await combined.controller.submit();
    const combinedTask = combined.tasks.list()[0];

    await assert.rejects(combinedTask.getResult(), error => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [executionError, disposalError]);
        return true;
    });
    assert.equal(disposals, 1);

    class DisposalFailure {
        static contract = {label: "Disposal failure", execute: {parameters: []}};
        execute() { return true; }
        async dispose() { throw disposalError; }
    }
    const disposalOnly = createInvocation(DisposalFailure);
    disposalOnly.state.args = {};
    await disposalOnly.controller.load();
    await disposalOnly.controller.submit();

    await assert.rejects(disposalOnly.tasks.list()[0].getResult(), error => error === disposalError);
});
