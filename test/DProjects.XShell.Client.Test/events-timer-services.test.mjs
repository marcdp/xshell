import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import contractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with {type: "json"};
import eventsContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/events.json" with {type: "json"};
import servicesContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/services.json" with {type: "json"};
import timerContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/timer.json" with {type: "json"};
import Events from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/scoped/events.js";
import Timer from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/scoped/timer.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";

function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function createServices() {
    const root = new Services({config: {xshell: {services: {}}}, bus: null});
    root.register("services", root);
    root.register("events", null, {lifetime: "transient", implementationItem: {class: Events}});
    root.register("timer", null, {lifetime: "transient", implementationItem: {class: Timer}});
    return root;
}

class CountingTarget extends EventTarget {
    added = [];
    removed = [];
    addEventListener(name, listener, options) {
        this.added.push({name, listener});
        super.addEventListener(name, listener, options);
    }
    removeEventListener(name, listener, options) {
        this.removed.push({name, listener});
        super.removeEventListener(name, listener, options);
    }
}

test("framework registration and helper contracts declare transient Services", () => {
    const manifest = readFileSync(new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/manifest.jsonc", import.meta.url), "utf8");
    assert.match(manifest, /"events"\s*:\s*\{[\s\S]*?"implementation"\s*:\s*"\/scoped\/events\.js"[\s\S]*?"lifetime"\s*:\s*"transient"/);
    assert.match(manifest, /"timer"\s*:\s*\{[\s\S]*?"implementation"\s*:\s*"\/scoped\/timer\.js"[\s\S]*?"lifetime"\s*:\s*"transient"/);

    const validator = new JsonValidator();
    assert.equal(validator.validate(eventsContract, contractSchema).valid, true);
    assert.equal(validator.validate(servicesContract, contractSchema).valid, true);
    assert.equal(validator.validate(timerContract, contractSchema).valid, true);
    assert.equal(validator.validate({}, Events.optionsSchema).valid, true);
    assert.equal(validator.validate({}, Timer.optionsSchema).valid, true);
    assert.deepEqual(Object.keys(eventsContract.methods), ["on", "dispose"]);
    assert.deepEqual(Object.keys(timerContract.methods), ["setTimeout", "setInterval", "dispose"]);
});

test("scope context is explicit, isolated, released, and unavailable to singleton construction", async () => {
    const root = createServices();
    class ContextSingleton {
        static optionsSchema = {type: "object", additionalProperties: false};
        constructor({scopeContext}) { this.scopeContext = scopeContext; }
    }
    root.register("contextSingleton", null, {implementationItem: {class: ContextSingleton}});
    const firstHandler = () => {};
    const secondHandler = () => {};
    const firstContext = {id: "first", invokeController: firstHandler};
    const secondContext = {id: "second", invokeController: secondHandler};
    const first = root.beginScope({context: firstContext});
    const second = root.beginScope({context: secondContext});
    const withoutContext = root.beginScope();

    assert.strictEqual(first._context, firstContext);
    assert.strictEqual(second._context, secondContext);
    assert.equal(withoutContext._context, null);
    assert.equal(first.resolve("contextSingleton").scopeContext, null);
    assert.strictEqual(first.resolve("events")._handler, firstHandler);
    assert.strictEqual(second.resolve("events")._handler, secondHandler);

    await first.dispose();
    assert.equal(first._context, null);
    assert.strictEqual(second._context, secondContext);
    await second.dispose();
    await withoutContext.dispose();
});

test("Events resolutions are independent and scope disposal removes function and controller listeners once", async () => {
    const root = createServices();
    const target = new CountingTarget();
    const calls = [];
    const controller = {
        value: "owner",
        refresh() { calls.push(["controller", this]); }
    };
    const scope = root.beginScope({context: {invokeController(command, ...args) { return controller[command](...args); }}});
    const first = scope.resolve("events");
    const second = scope.resolve("events");

    assert.notStrictEqual(first, second);
    first.on(target, ["first", "second"], () => calls.push(["function"]));
    second.on(target, "refresh", "refresh");
    target.dispatchEvent(new Event("first"));
    target.dispatchEvent(new Event("second"));
    target.dispatchEvent(new Event("refresh"));
    assert.deepEqual(calls.slice(0, 2), [["function"], ["function"]]);
    assert.deepEqual(calls[2], ["controller", controller]);

    await scope.dispose();
    assert.equal(target.removed.length, 3);
    target.dispatchEvent(new Event("first"));
    target.dispatchEvent(new Event("refresh"));
    assert.equal(calls.length, 3);
    await scope.dispose();
    assert.equal(target.removed.length, 3);
    assert.equal(first._handler, null);
    assert.equal(second._handler, null);
});

test("Events without owner context support functions and reject string listeners clearly", async () => {
    const root = createServices();
    const scope = root.beginScope();
    const target = new EventTarget();
    const events = scope.resolve("events");
    let calls = 0;

    events.on(target, "run", () => calls++);
    target.dispatchEvent(new Event("run"));
    assert.equal(calls, 1);
    assert.throws(() => events.on(target, "missing", "refresh"), /require a Services scope controller context/);
    await scope.dispose();
});

test("Timer resolutions preserve function and controller callbacks and cancel owned work on disposal", async () => {
    const root = createServices();
    const controller = {
        calls: 0,
        tick() { assert.strictEqual(this, controller); this.calls++; }
    };
    const scope = root.beginScope({context: {invokeController(command, ...args) { return controller[command](...args); }}});
    const first = scope.resolve("timer");
    const second = scope.resolve("timer");
    let functionCalls = 0;
    let canceledCalls = 0;

    assert.notStrictEqual(first, second);
    first.setTimeout(() => functionCalls++, 0);
    second.setInterval("tick", 5);
    first.setTimeout(() => canceledCalls++, 100);
    await delay(20);
    assert.equal(functionCalls, 1);
    assert.ok(controller.calls > 0);

    await scope.dispose();
    const callsAfterDispose = controller.calls;
    await delay(20);
    assert.equal(controller.calls, callsAfterDispose);
    assert.equal(canceledCalls, 0);
    assert.equal(first._handler, null);
    assert.equal(second._handler, null);
    await scope.dispose();
});

test("Timer without owner context supports functions and rejects command strings clearly", async () => {
    const root = createServices();
    const scope = root.beginScope();
    const timer = scope.resolve("timer");
    let calls = 0;

    timer.setTimeout(() => calls++, 0);
    await delay(5);
    assert.equal(calls, 1);
    assert.throws(() => timer.setTimeout("refresh", 0), /require a Services scope controller context/);
    assert.throws(() => timer.setInterval("refresh", 0), /require a Services scope controller context/);
    await scope.dispose();
});

test("direct Events and Timer construction remains compatible with callback handlers", async () => {
    const commands = [];
    const events = new Events(command => commands.push(command));
    const timer = new Timer(command => commands.push(command));
    const target = new EventTarget();

    events.on(target, "run", "eventCommand");
    timer.setTimeout("timerCommand", 0);
    target.dispatchEvent(new Event("run"));
    await delay(5);
    assert.deepEqual(commands, ["eventCommand", "timerCommand"]);
    events.dispose();
    timer.dispose();
});
