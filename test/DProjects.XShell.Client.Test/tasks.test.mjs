import assert from "node:assert/strict";
import test from "node:test";

import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";

test("tasks run reports description, progress, ordered output and result", async () => {
    const events = [];
    const tasks = new Tasks({ bus: { emit(name, detail) { events.push({ name, detail }); } } });
    const task = tasks.run({
        title: "Example",
        description: "Starting",
        handler(context) {
            context.setDescription("Working");
            context.setProgress(2, 4);
            context.write("one");
            context.err("two");
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
    assert.deepEqual((await task.getOutput()).entries.map(({ channel, text }) => ({ channel, text })), [
        { channel: "stdout", text: "one" },
        { channel: "stderr", text: "two" }
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

test("tasks distinguish thrown failures from stderr output", async () => {
    const tasks = new Tasks({ bus: null });
    const stderrTask = tasks.run({ title: "Stderr", handler(context) { context.err("warning"); return "ok"; } });
    const failedTask = tasks.run({ title: "Failure", handler() { throw new Error("broken"); } });

    await Promise.all([stderrTask.wait(), failedTask.wait()]);

    assert.equal(stderrTask.status, "finished");
    assert.equal(await stderrTask.getResult(), "ok");
    assert.equal(failedTask.status, "error");
    assert.equal(failedTask.error.message, "broken");
    await assert.rejects(failedTask.getResult(), /broken/);
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
