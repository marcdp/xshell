import assert from "node:assert/strict";
import test from "node:test";

import layoutDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-main.js";
import tasksPageDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/tasks.js";
import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";

test("Tasks Page projects and counts only background Tasks", () => {
    const allTasks = [
        { id: "foreground-running", title: "FR", description: "", background: false, status: "running", progress: null, error: null },
        { id: "background-running", title: "BR", description: "", background: true, status: "running", progress: null, error: null },
        { id: "foreground-finished", title: "FF", description: "", background: false, status: "finished", progress: null, error: null },
        { id: "background-finished", title: "BF", description: "", background: true, status: "finished", progress: null, error: null }
    ];
    const state = structuredClone(tasksPageDefinition.state);
    let invalidations = 0;
    const controller = tasksPageDefinition.controller({
        state,
        page: { invalidate() { invalidations++; } },
        tasks: { list: () => allTasks }
    });

    controller.refresh();

    assert.deepEqual(state.tasks.map(task => task.id), ["background-running", "background-finished"]);
    assert.equal(state.running, 1);
    assert.equal(state.completed, 1);
    assert.equal(invalidations, 1);
});

test("main layout badge counts only pending and running background Tasks", () => {
    const allTasks = [
        { background: false, status: "pending" },
        { background: false, status: "running" },
        { background: true, status: "finished" }
    ];
    const state = { runningTasks: 0 };
    let expansions = 0;
    const controller = layoutDefinition.controller({
        state,
        tasks: { list: () => allTasks },
        host: { shadowRoot: { querySelector: () => ({ expand() { expansions++; } }) } }
    });

    controller.refreshTasks();
    assert.equal(state.runningTasks, 0);
    assert.equal(expansions, 0);

    allTasks.push({ background: true, status: "pending" });
    controller.refreshTasks();
    assert.equal(state.runningTasks, 1);
    assert.equal(expansions, 1);

    allTasks.push({ background: true, status: "running" });
    controller.refreshTasks();
    assert.equal(state.runningTasks, 2);
    assert.equal(expansions, 1);
});

test("Tasks created without a background option remain globally visible", async () => {
    const tasks = new Tasks({ bus: null });
    const task = tasks.run({ title: "Compatible", handler() {} });
    const state = structuredClone(tasksPageDefinition.state);
    const controller = tasksPageDefinition.controller({ state, page: { invalidate() {} }, tasks });

    controller.refresh();
    assert.deepEqual(state.tasks.map(item => item.id), [task.id]);
    await task.wait();
});
