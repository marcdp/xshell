import assert from "node:assert/strict";
import test from "node:test";

import TasksPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/tasks.js";
import TaskDetailPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/tasks-detail.js";
import ListView from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-listview.js";
import { createPageClassFromJsDefinition } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/page-js.js";
import createStateEngine from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/state-engines/proxy.js";
import Logger from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/logger.js";
import Navigation from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/navigation.js";
import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";
import PageSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/page.schema.json" with { type: "json" };
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };

const listPath = "/_assets/xshell-diagnostics/pages/tasks.js";
const detailPath = "/_assets/xshell-diagnostics/pages/tasks-detail.js";
const detailHref = "page:xshell-diagnostics:/pages/tasks-detail.js";
const flush = () => new Promise(resolve => setImmediate(resolve));

function createBus() {
    return Object.assign(new EventTarget(), {
        emit(name, detail) { this.dispatchEvent(new CustomEvent(name, { detail })); }
    });
}

async function loadPage(definition, src, services) {
    // Use the production Page loader and scoped dependencies without mounting a browser renderer.
    const config = {
        app: { baseUrl: "https://example.test/" },
        xshell: { assets: { basePath: "/_assets" } },
        modules: { "xshell-diagnostics": { defaults: { page: { stateEngine: "proxy", renderEngine: "test" } } } }
    };
    const resources = {
        "schema:page": { ...PageSchema, $defs: { [ContractSchema.$id]: ContractSchema } },
        "state-engine:proxy": function (state, context) { return createStateEngine(state, context); },
        "render-engine:test": class { dependencies = []; slots = []; init() {} }
    };
    const PageClass = await createPageClassFromJsDefinition(src, {
        resourceDefinition: { moduleId: "xshell-diagnostics" },
        services: { logger: new Logger({}), ...services, config, loader: { load: name => resources[name] } }
    }, { ...definition, contract: structuredClone(definition.contract), meta: { ...definition.meta } });
    const page = new PageClass({ src, context: {}, bus: services.bus });
    await page.load();
    return page;
}

function setup(t) {
    globalThis.document = { baseURI: "https://example.test/" };
    globalThis.window = { location: new URL(document.baseURI) };
    t.mock.timers.enable({ apis: ["setInterval"] });
    t.after(() => {
        delete globalThis.document;
        delete globalThis.window;
    });
    const bus = createBus();
    return { bus, tasks: new Tasks({ logger: new Logger({}), bus }) };
}

test("Tasks activates the selected row in the stack and retains its live filtered list on return", async t => {
    const { tasks, bus } = setup(t);
    const hold = Promise.withResolvers();
    const target = tasks.run({ title: "Import orders", handler: () => hold.promise });
    const other = tasks.run({ title: "Export orders", handler() {} });
    await other.wait();
    t.after(() => hold.resolve());

    // Reconcile real Navigation stack entries against lightweight Page hosts.
    const root = { src: listPath, getAttribute: () => null };
    const pages = [root];
    const container = { querySelectorAll: () => pages, appendChild: host => pages.push(host) };
    globalThis.history = { pushState() {} };
    t.after(() => { delete globalThis.history; });
    document.createElement = () => Object.assign(new EventTarget(), {
        setAttribute(name, value) { this[name] = value; },
        getAttribute(name) { return this[name] ?? null; },
        async removePage() { await this.page.unload(); pages.splice(pages.indexOf(this), 1); }
    });
    const navigation = new Navigation({
        logger: new Logger({}),
        areas: { }, menus: { resolvePath: () => null, resolveHref: () => null },
        resolver: { resolve: href => href === detailHref ? { path: detailPath } : null },
        config: { app: { basePath: "", baseUrl: "https://example.test/" }, xshell: {} }
    }, { mode: "path" }, { container });
    await navigation.navigate({ href: root.src, open: "top", page: { host: null } });
    const navigate = t.mock.method(navigation, "navigate");
    const list = await loadPage(TasksPage, root.src, { tasks, bus, navigation });
    t.after(() => list.unload());
    list._state.query_title = "Import";
    assert.deepEqual(list._state.items.map(task => task.id), [target.id]);
    assert.equal(list._state.total, 2);
    assert.match(TasksPage.template, /x-on:activate="activateTask"/);
    assert.doesNotMatch(TasksPage.template, /x-on:select|Execution output/);
    assert.match(TasksPage.template, /x-attr:path="item.id"/);
    await list.onCommand("activateTask", { event: { detail: { path: "unknown" } } });
    assert.equal(navigate.mock.callCount(), 0);

    const row = Object.assign(new EventTarget(), { path: target.id, closest() { return this; } });
    row.addEventListener("activate", event => list.onCommand("activateTask", { event }));
    await ListView.controller({}).dblClick({ event: { target: row } });
    assert.equal(navigate.mock.callCount(), 1);
    assert.deepEqual(navigate.mock.calls[0].arguments, [{ href: detailHref, page: list, open: "stack", params: { id: target.id } }]);
    await navigate.mock.calls[0].result;
    const detailHost = pages[1];
    assert.equal(detailHost.layout, "stack");
    assert.equal(detailHost.src, detailPath + "?id=" + target.id);
    detailHost.page = await loadPage(TaskDetailPage, detailHost.src, { tasks, bus });
    assert.equal(detailHost.page._state.task.id, target.id);

    detailHost.dispatchEvent(new Event("close"));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(pages, [root]);
    assert.equal(target.status, "running");
    assert.equal(list._state.query_title, "Import");
    assert.deepEqual(list._state.items.map(task => task.id), [target.id]);
    hold.resolve();
    await target.wait();
    assert.equal(list._state.items[0].status, "finished");
    await list.onCommand("clear");
    assert.equal(list._state.total, 0);
});

test("Task details reports missing and unknown query IDs", async t => {
    const { bus, tasks } = setup(t);
    const get = t.mock.method(tasks, "get");
    const missing = await loadPage(TaskDetailPage, detailPath, { bus, tasks });
    t.after(() => missing.unload());
    assert.equal(missing._state.notice, "No task ID was provided.");
    assert.equal(get.mock.callCount(), 0);

    const unknown = await loadPage(TaskDetailPage, detailPath + "?id=unknown", { bus, tasks });
    t.after(() => unknown.unload());
    assert.deepEqual(get.mock.calls[0].arguments, ["unknown"]);
    assert.match(unknown._state.notice, /unknown.*unavailable/);
    assert.equal(unknown._state.task, null);
    assert.equal(unknown._state.canCancel, false);
    assert.equal(unknown._state.canRemove, false);
});

test("Task details updates progress, duration, output and failure for the inspected Task", async t => {
    const { bus, tasks } = setup(t);
    const hold = Promise.withResolvers();
    let execution;
    const task = tasks.run({
        title: "Import", description: "Start", background: false,
        handler(context) { execution = context; return hold.promise; }
    });
    t.after(() => hold.resolve());
    const page = await loadPage(TaskDetailPage, detailPath + "?id=" + task.id, { bus, tasks });
    t.after(() => page.unload());
    const state = page._state;
    assert.equal(state.task.progressLabel, "Indeterminate");
    assert.equal(state.task.background, "No");
    assert.equal(state.task.endedAt, undefined);
    assert.equal(state.task.error, null);
    const snapshot = state.task;
    bus.emit("xshell:tasks:updated", { id: "another task" });
    assert.equal(state.task, snapshot);

    const duration = t.mock.getter(task, "duration", () => 1234);
    t.mock.timers.tick(1000);
    assert.equal(state.duration, 1234);
    assert.equal(duration.mock.callCount(), 1);
    execution.setDescription("Reading orders");
    execution.setProgress(2, 5);
    execution.warn("Partial data");
    assert.equal(state.task.description, "Reading orders");
    assert.equal(state.task.progressLabel, "40%");

    t.mock.timers.tick(1000);
    await flush();
    assert.equal(state.output[0].text, "Partial data");
    assert.equal(state.output[0].level, "warn");
    assert.doesNotThrow(() => new Date(state.output[0].timestamp).toISOString());

    hold.reject(new Error("Import failed"));
    await task.wait();
    assert.equal(state.task.status, "error");
    assert.equal(state.task.error.message, "Import failed");
    assert.ok(state.task.endedAt);
    assert.equal(state.canRemove, true);
    assert.equal(state.canCancel, false);
});

test("Task details pages through retained output in order and caps the visible window", async t => {
    const { bus, tasks } = setup(t);
    const task = tasks.run({ title: "Verbose", handler(context) {
        for (let i = 0; i < 5050; i++) context.log(String(i));
    } });
    await task.wait();
    const getOutput = t.mock.method(task, "getOutput");
    const page = await loadPage(TaskDetailPage, detailPath + "?id=" + task.id, { bus, tasks });
    t.after(() => page.unload());
    const state = page._state;
    assert.equal(state.output.length, 100);
    assert.equal(state.output[0].text, "50");
    assert.equal(state.outputSkipped, true);
    assert.equal(state.hasMoreOutput, true);
    for (let i = 0; i < 5; i++) await page.onCommand("readOutput");
    assert.equal(state.output.length, 500);
    assert.equal(state.output[0].text, "150");
    assert.equal(state.output.at(-1).text, "649");
    assert.deepEqual(getOutput.mock.calls.map(call => call.arguments[0].cursor), [undefined, "150", "250", "350", "450", "550"]);
    assert.ok(getOutput.mock.calls.every(call => call.arguments[0].limit === 100));
});

test("Task details coalesces output reads and handles an empty page after a full page", async t => {
    const { bus, tasks } = setup(t);
    const task = tasks.run({ title: "Exact page", handler(context) {
        for (let i = 0; i < 100; i++) context.log("same text");
    } });
    await task.wait();
    const page = await loadPage(TaskDetailPage, detailPath + "?id=" + task.id, { bus, tasks });
    t.after(() => page.unload());
    const state = page._state;
    assert.equal(state.hasMoreOutput, true);
    const getOutput = t.mock.method(task, "getOutput");
    const first = page.onCommand("readOutput");
    const second = page.onCommand("readOutput");
    bus.emit("xshell:tasks:updated", { id: task.id });
    t.mock.timers.tick(1000);
    await Promise.all([first, second]);
    assert.equal(getOutput.mock.callCount(), 1);
    assert.equal(state.hasMoreOutput, false);
    assert.equal(state.output.length, 100);
    assert.equal(new Set(state.output.map(entry => entry.offset)).size, 100);
});

test("Task details ignores pending output after a target change, removal, or unload", async t => {
    const { bus, tasks } = setup(t);
    const previous = tasks.run({ title: "Previous", handler: context => context.log("previous") });
    const next = tasks.run({ title: "Next", handler: context => context.log("next") });
    await Promise.all([previous.wait(), next.wait()]);
    const previousRead = Promise.withResolvers();
    const previousOutput = await previous.getOutput();
    const nextOutput = await next.getOutput();
    t.mock.method(previous, "getOutput", () => previousRead.promise);
    const nextRead = t.mock.method(next, "getOutput");
    const page = await loadPage(TaskDetailPage, detailPath + "?id=" + previous.id, { bus, tasks });
    const state = page._state;
    state.id = next.id;
    assert.equal(state.task.id, next.id);
    assert.equal(nextRead.mock.callCount(), 0);
    previousRead.resolve(previousOutput);
    await flush();
    assert.deepEqual(state.output.map(entry => entry.text), ["next"]);

    const removedRead = Promise.withResolvers();
    nextRead.mock.mockImplementation(() => removedRead.promise);
    const removedRequest = page.onCommand("readOutput");
    tasks.remove(next.id);
    assert.match(state.notice, /unavailable/);
    removedRead.resolve(nextOutput);
    await removedRequest;
    assert.deepEqual(state.output, []);

    const unloadedRead = Promise.withResolvers();
    t.mock.method(previous, "getOutput", () => unloadedRead.promise);
    state.id = previous.id;
    await page.unload();
    unloadedRead.resolve(previousOutput);
    await flush();
    assert.deepEqual(state.output, []);
});

test("Task details cancels cooperatively, removes terminal tasks and disposes scoped listeners and timers", async t => {
    const { bus, tasks } = setup(t);
    const removeListener = t.mock.method(bus, "removeEventListener");
    const clearInterval = t.mock.method(globalThis, "clearInterval");
    let execution;
    const hold = Promise.withResolvers();
    const task = tasks.run({ title: "Cancelable", handler(context) { execution = context; return hold.promise; } });
    t.after(() => hold.resolve());
    const cancel = t.mock.method(task, "cancel");
    const remove = t.mock.method(tasks, "remove");
    const page = await loadPage(TaskDetailPage, detailPath + "?id=" + task.id, { bus, tasks });
    const state = page._state;
    await page.onCommand("removeTask");
    assert.equal(remove.mock.callCount(), 0);
    assert.equal(state.canCancel, true);
    await page.onCommand("cancelTask");
    await page.onCommand("cancelTask");
    assert.equal(cancel.mock.callCount(), 1);
    assert.equal(execution.signal.aborted, true);
    assert.equal(state.task.status, "running");
    hold.resolve();
    await task.wait();
    assert.equal(state.task.status, "canceled");
    await page.onCommand("cancelTask");
    assert.equal(cancel.mock.callCount(), 1);

    await page.onCommand("removeTask");
    assert.deepEqual(remove.mock.calls[0].arguments, [task.id]);
    assert.equal(tasks.get(task.id), undefined);
    assert.match(state.notice, /was removed/);
    await page.unload();
    assert.deepEqual(removeListener.mock.calls.map(call => call.arguments[0]), ["xshell:tasks:updated", "xshell:tasks:removed"]);
    assert.equal(clearInterval.mock.callCount(), 1);
});
