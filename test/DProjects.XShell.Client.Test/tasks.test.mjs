import assert from "node:assert/strict";
import test from "node:test";

import tasksContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/tasks.json" with { type: "json" };
import contractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";

test("tasks contract owns the complete Task vocabulary and validates structurally", () => {
    const result = new JsonValidator().validate(tasksContract, contractSchema);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(Object.keys(tasksContract.types), [
        "taskId", "taskStatus", "taskOptions", "taskContext", "taskOutput", "taskOutputPage", "task", "taskList"
    ]);

    const context = tasksContract.types.taskContext.schema;
    const output = tasksContract.types.taskOutput.schema;
    const task = tasksContract.types.task.schema;

    assert.deepEqual(context.required, ["signal", "setDescription", "setProgress", "log", "info", "warn", "error"]);
    assert.deepEqual(Object.keys(context.properties), ["data", "signal", "setDescription", "setProgress", "log", "info", "warn", "error"]);
    assert.deepEqual(output.properties.level.enum, ["log", "info", "warn", "error"]);
    assert.deepEqual(output.required, ["timestamp", "level", "text"]);
    assert.deepEqual(tasksContract.types.taskOutputPage.schema.required, ["entries", "nextCursor"]);
    assert.equal(task.required.includes("addEventListener"), true);
    assert.equal(task.required.includes("removeEventListener"), true);
    assert.equal(tasksContract.methods.run.returns.ref, "task");
    assert.equal(tasksContract.methods.get.returns.ref, "task");
    assert.equal(tasksContract.methods.list.returns.ref, "taskList");
    assert.doesNotMatch(JSON.stringify(tasksContract), /"stdout"|"stderr"|"channel"/);
});

test("tasks run reports description, progress, ordered level output and result", async () => {
    const events = [];
    const tasks = new Tasks({ bus: { emit(name, detail) { events.push({ name, detail }); } } });
    const task = tasks.run({
        title: "Example",
        description: "Starting",
        handler(context) {
            assert.deepEqual(Object.keys(context), ["data", "signal", "setDescription", "setProgress", "log", "info", "warn", "error"]);
            context.setDescription("Working");
            context.setProgress(2, 4);
            context.log("one");
            context.info("two");
            context.warn("three");
            context.error("four");
            return 42;
        }
    });

    assert.equal(task.status, "pending");
    assert.equal(task.background, true);
    await task.wait();

    assert.equal(task.status, "finished");
    assert.equal(task.description, "Working");
    assert.deepEqual(task.progress, { value: 2, max: 4 });
    assert.equal(await task.getResult(), 42);
    assert.deepEqual((await task.getOutput()).entries.map(({ level, text }) => ({ level, text })), [
        { level: "log", text: "one" },
        { level: "info", text: "two" },
        { level: "warn", text: "three" },
        { level: "error", text: "four" }
    ]);
    assert.equal(tasks.get(task.id), task);
    assert.deepEqual(tasks.list(), [task]);
    assert.equal(events[0].name, "xshell:tasks:added");

    tasks.clear();
    assert.deepEqual(tasks.list(), []);
});

test("tasks support explicit foreground execution and reject invalid background values", async () => {
    const tasks = new Tasks({ bus: null });
    const task = tasks.run({ title: "Foreground", background: false, handler() {} });

    assert.equal(task.background, false);
    assert.deepEqual(tasks.list(), [task]);
    await task.wait();

    assert.throws(
        () => tasks.run({ title: "Invalid", background: "yes", handler() {} }),
        /Task background must be a boolean/
    );
});

test("tasks distinguish thrown failures from error-level output", async () => {
    const tasks = new Tasks({ bus: null });
    const outputTask = tasks.run({ title: "Output", handler(context) { context.error("warning"); return "ok"; } });
    const failedTask = tasks.run({ title: "Failure", handler() { throw new Error("broken"); } });

    await Promise.all([outputTask.wait(), failedTask.wait()]);

    assert.equal(outputTask.status, "finished");
    assert.equal(await outputTask.getResult(), "ok");
    assert.deepEqual((await outputTask.getOutput()).entries.map(({ level, text }) => ({ level, text })), [
        { level: "error", text: "warning" }
    ]);
    assert.equal(failedTask.status, "error");
    assert.equal(failedTask.error.message, "broken");
    await assert.rejects(failedTask.getResult(), /broken/);
});

test("tasks paginate output in chronological order", async () => {
    const tasks = new Tasks({ bus: null });
    const task = tasks.run({
        title: "Pagination",
        handler(context) {
            context.log("one");
            context.info("two");
            context.warn("three");
        }
    });

    await task.wait();
    const first = await task.getOutput({ limit: 2 });
    const second = await task.getOutput({ cursor: first.nextCursor, limit: 2 });

    assert.deepEqual(first.entries.map(({ level, text }) => ({ level, text })), [
        { level: "log", text: "one" },
        { level: "info", text: "two" }
    ]);
    assert.equal(first.nextCursor, "2");
    assert.deepEqual(second.entries.map(({ level, text }) => ({ level, text })), [
        { level: "warn", text: "three" }
    ]);
    assert.equal(second.nextCursor, "3");
});

test("tasks cancel through AbortSignal without producing a successful result", async () => {
    const tasks = new Tasks({ bus: null });
    let started;
    const running = new Promise(resolve => { started = resolve; });
    const task = tasks.run({
        title: "Cancelable",
        async handler(context) {
            started();
            await new Promise((resolve, reject) => {
                context.signal.addEventListener("abort", () => reject(context.signal.reason), { once: true });
            });
            return "unreachable";
        }
    });

    await running;
    await task.cancel();
    await task.wait();

    assert.equal(task.status, "canceled");
    assert.equal(task.error, null);
    await assert.rejects(task.getResult(), error => error?.name === "AbortError");
    assert.doesNotThrow(() => tasks.remove(task.id + "-missing"));
    tasks.remove(task.id);
    assert.equal(tasks.get(task.id), undefined);
});
