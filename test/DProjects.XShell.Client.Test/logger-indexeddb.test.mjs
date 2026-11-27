import assert from "node:assert/strict";
import test from "node:test";
import {setImmediate as waitTurn} from "node:timers/promises";

import LoggerIndexedDB from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-logger/providers/logger-indexeddb.js";

function installIndexedDB(t, value) {
    // Node can omit this browser global entirely.
    const previous = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
    Object.defineProperty(globalThis, "indexedDB", {configurable: true, value});
    t.after(() => {
        if (previous) Object.defineProperty(globalThis, "indexedDB", previous);
        else delete globalThis.indexedDB;
    });
}

test("IndexedDB logger validates its options before opening storage", t => {
    const open = t.mock.fn();
    installIndexedDB(t, {open});
    for (const options of [null, 42, [], new Date()]) {
        assert.throws(() => new LoggerIndexedDB({}, options), /options must be an object/);
    }
    for (const [name, values] of [
        ["databaseName", ["", "   ", 9, null]],
        ["maxEntries", [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, "100", null]],
        ["retentionDays", [0, -1, Infinity, NaN, "7", null]],
        ["unexpected", [true]]
    ]) {
        for (const value of values) assert.throws(() => new LoggerIndexedDB({}, {[name]: value}), new RegExp(name));
    }
    const provider = new LoggerIndexedDB({}, {databaseName: "logs", maxEntries: 1, retentionDays: 0.5});
    assert.equal(typeof provider.log, "function");
    assert.equal(open.mock.callCount(), 0);
});

test("Unavailable IndexedDB warns once through native console and never accesses the XShell logger", async t => {
    const warning = t.mock.method(console, "warn", () => {});
    installIndexedDB(t, undefined);
    const dependencies = {get logger() { assert.fail("Provider tried to log recursively"); }};
    const provider = new LoggerIndexedDB(dependencies, {databaseName: "test"});
    for (let index = 0; index < 1200; index++) assert.equal(provider.log("debug", "private input"), undefined);
    await waitTurn();
    provider.log("error", "more private input");
    await waitTurn();
    assert.deepEqual(warning.mock.calls.map(call => call.arguments), [["IndexedDB logger could not persist a batch."]]);
});

test("IndexedDB logger shares a pending open and recovers after blocked and failed requests", async t => {
    const warning = t.mock.method(console, "warn", () => {});
    const requests = [];
    const open = t.mock.fn(() => {
        const request = {};
        requests.push(request);
        return request;
    });
    installIndexedDB(t, {open});
    const provider = new LoggerIndexedDB({}, {databaseName: "chosen name"});

    // A blocked request may still finish later, so further logs must not pile up more native opens.
    provider.log("debug", "first");
    await waitTurn();
    provider.log("debug", "while opening");
    await waitTurn();
    assert.equal(requests.length, 1);
    requests[0].onblocked();
    await waitTurn();
    provider.log("warn", "while blocked");
    await waitTurn();
    assert.equal(requests.length, 1);
    const close = t.mock.fn();
    requests[0].result = {close};
    requests[0].onsuccess();
    assert.equal(close.mock.callCount(), 1);

    // Failed opens release the writer and the next call can open again.
    provider.log("info", "after blocked");
    await waitTurn();
    const request = requests[1];
    request.error = new Error("private storage details");
    request.onerror();
    await waitTurn();
    provider.log("info", "after failure");
    await waitTurn();
    assert.deepEqual(open.mock.calls.map(call => call.arguments), Array(3).fill(["chosen name", 1]));
    assert.deepEqual(warning.mock.calls.map(call => call.arguments), [["IndexedDB logger could not persist a batch."]]);
    requests[2].onerror();
    await waitTurn();
});
