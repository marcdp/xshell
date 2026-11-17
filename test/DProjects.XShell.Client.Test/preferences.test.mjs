import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";

import contract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/preferences.json" with { type: "json" };
import commonSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import serviceSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/service.schema.json" with { type: "json" };
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Preferences from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/preferences.js";

const originalDescriptors = new Map();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function setGlobal(name, value) {
    // Preserve globals so each test receives an isolated browser-like environment.
    if (!originalDescriptors.has(name)) originalDescriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {configurable:true, writable:true, value});
}

afterEach(() => {
    // Restore every patched browser primitive after a test completes.
    for (const [name, descriptor] of originalDescriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
    }
    originalDescriptors.clear();
});

function copy(value) {
    // Match IndexedDB's structured-clone boundary, including DataCloneError failures.
    return value === undefined ? undefined : structuredClone(value);
}

function createIndexedDB() {
    const stores = new Map();
    let version = 0;
    let blockNextOpen = false;
    let failNextOpen = false;
    const opens = [];

    function schemaStore(definition) {
        // Expose the upgrade-time subset used by the service.
        return {
            indexNames: {contains(name) { return definition.indexes.has(name); }},
            createIndex(name, keyPath, options = {}) { definition.indexes.set(name, {keyPath, unique:options.unique === true}); }
        };
    }

    function createTransaction(name, mode) {
        // Serialize read-write transactions and roll back their record map on abort.
        const definition = stores.get(name);
        if (!definition) throw new DOMException(`Missing object store ${name}.`, "NotFoundError");
        let before = null;
        let pending = 0;
        let completionQueued = false;
        let finished = false;
        let aborted = false;
        let active = mode !== "readwrite";
        let ownsWriteLock = false;
        const deferred = [];
        const releaseWriteLock = () => {
            if (!ownsWriteLock) return;
            ownsWriteLock = false;
            const next = definition.writeQueue.shift();
            if (next) queueMicrotask(next);
            else definition.writeActive = false;
        };
        const start = () => {
            if (finished || aborted) return releaseWriteLock();
            active = true;
            ownsWriteLock = true;
            before = new Map([...definition.records].map(([key, value]) => [key, copy(value)]));
            for (const operation of deferred.splice(0)) queueMicrotask(operation);
        };
        if (mode === "readwrite") {
            if (definition.writeActive) definition.writeQueue.push(start);
            else {
                definition.writeActive = true;
                start();
            }
        }

        const transaction = {
            error: null,
            oncomplete: null,
            onabort: null,
            onerror: null,
            abort() {
                // Restore all writes made by this transaction before reporting its failure.
                if (finished || aborted) throw new DOMException("Transaction is inactive.", "InvalidStateError");
                aborted = true;
                transaction.error ||= new DOMException("Transaction aborted.", "AbortError");
                if (before) definition.records = new Map([...before].map(([key, value]) => [key, copy(value)]));
                queueMicrotask(() => {
                    if (finished) return;
                    finished = true;
                    releaseWriteLock();
                    transaction.onabort?.();
                });
            },
            objectStore() {
                // Queue requests and auto-commit only after handlers stop adding work.
                const operation = callback => {
                    if (finished || aborted) throw new DOMException("Transaction is inactive.", "InvalidStateError");
                    pending++;
                    const request = {result:undefined, error:null, onsuccess:null, onerror:null};
                    const run = () => {
                        if (aborted) return;
                        try {
                            request.result = callback();
                            request.onsuccess?.();
                        } catch (error) {
                            request.error = error;
                            transaction.error = error;
                            request.onerror?.();
                            transaction.onerror?.();
                            if (!aborted) transaction.abort();
                            return;
                        } finally {
                            pending--;
                        }
                        if (!completionQueued && pending === 0) {
                            completionQueued = true;
                            queueMicrotask(() => {
                                completionQueued = false;
                                if (finished || aborted || pending !== 0) return;
                                finished = true;
                                releaseWriteLock();
                                transaction.oncomplete?.();
                            });
                        }
                    };
                    if (active) queueMicrotask(run);
                    else deferred.push(run);
                    return request;
                };
                const keyFor = value => value[definition.keyPath];
                const checkUniqueIndexes = (value, key) => {
                    for (const index of definition.indexes.values()) {
                        if (!index.unique || value[index.keyPath] === undefined) continue;
                        if ([...definition.records].some(([existingKey, record]) => existingKey !== key && record[index.keyPath] === value[index.keyPath])) {
                            throw new DOMException("Index value already exists.", "ConstraintError");
                        }
                    }
                };
                return {
                    ...schemaStore(definition),
                    put(value) {
                        return operation(() => {
                            if (definition.failNextPut) {
                                definition.failNextPut = false;
                                throw new Error("Injected put failure.");
                            }
                            const stored = copy(value);
                            const key = keyFor(stored);
                            checkUniqueIndexes(stored, key);
                            definition.records.set(key, stored);
                            return key;
                        });
                    },
                    delete(key) { return operation(() => { definition.records.delete(key); }); },
                    index(indexName) {
                        const index = definition.indexes.get(indexName);
                        if (!index) throw new DOMException("Index not found.", "NotFoundError");
                        const ordered = () => [...definition.records.values()].sort((left, right) => {
                            const a = left[index.keyPath];
                            const b = right[index.keyPath];
                            return a < b ? -1 : a > b ? 1 : 0;
                        });
                        return {
                            get(value) { return operation(() => copy(ordered().find(record => record[index.keyPath] === value))); },
                            getAll(range) { return operation(() => ordered().filter(record => !range || range.includes(record[index.keyPath])).map(copy)); }
                        };
                    }
                };
            }
        };
        return transaction;
    }

    const indexedDB = {
        open(name, requestedVersion) {
            // Record open parameters and deliver upgrade, blocked, error, or success events asynchronously.
            opens.push({name, version:requestedVersion});
            const request = {result:null, transaction:null, error:null, onupgradeneeded:null, onsuccess:null, onerror:null, onblocked:null};
            queueMicrotask(() => {
                if (blockNextOpen) {
                    blockNextOpen = false;
                    request.onblocked?.();
                    return;
                }
                if (failNextOpen) {
                    failNextOpen = false;
                    request.error = new Error("Injected open failure.");
                    request.onerror?.();
                    return;
                }
                const database = {
                    onversionchange: null,
                    objectStoreNames: {contains(storeName) { return stores.has(storeName); }},
                    createObjectStore(storeName, {keyPath}) {
                        if (!stores.has(storeName)) stores.set(storeName, {keyPath, records:new Map(), indexes:new Map(), writeActive:false, writeQueue:[], failNextPut:false});
                        return schemaStore(stores.get(storeName));
                    },
                    transaction(storeName, mode) { return createTransaction(storeName, mode); },
                    close() {}
                };
                request.result = database;
                if (requestedVersion > version) {
                    version = requestedVersion;
                    request.transaction = {objectStore(storeName) { return schemaStore(stores.get(storeName)); }};
                    request.onupgradeneeded?.();
                    request.transaction = null;
                }
                request.onsuccess?.();
            });
            return request;
        }
    };

    return {
        indexedDB,
        opens,
        records(name = "preferences") { return [...(stores.get(name)?.records.values() || [])].map(copy); },
        hasStore(name) { return stores.has(name); },
        index(name, indexName) { return stores.get(name)?.indexes.get(indexName); },
        failPut(name = "preferences") { stores.get(name).failNextPut = true; },
        blockOpen() { blockNextOpen = true; },
        failOpen() { failNextOpen = true; }
    };
}

function installEnvironment(database) {
    // Install IndexedDB and the minimal key-range behavior used for prefix scans.
    setGlobal("indexedDB", database.indexedDB);
    setGlobal("IDBKeyRange", {
        bound(lower, upper, lowerOpen = false, upperOpen = false) {
            return {includes(value) { return (lowerOpen ? value > lower : value >= lower) && (upperOpen ? value < upper : value <= upper); }};
        },
        lowerBound(lower, open = false) { return {includes(value) { return open ? value > lower : value >= lower; }}; }
    });
}

function installClock(initial) {
    // Provide deterministic UTC timestamps while retaining normal Date parsing.
    const NativeDate = globalThis.Date;
    let now = initial;
    class FakeDate extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    setGlobal("Date", FakeDate);
    return {advance(milliseconds) { now += milliseconds; }};
}

test("Preferences contract validates and the framework manifest registers the service", () => {
    // Validate the service contract through the same schemas used by runtime contract loading.
    const result = new JsonValidator().validate(contract, serviceSchema, {"./contract.schema.json":commonSchema});
    assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
    const manifest = readFileSync(new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/manifest.jsonc", import.meta.url), "utf8");
    assert.match(manifest, /"preferences"\s*:\s*\{\s*"contract"\s*:\s*"preferences",\s*"implementation"\s*:\s*"\/services\/preferences\.js"/u);
    assert.deepEqual(Preferences.optionsSchema, {type:"object", properties:{}, additionalProperties:false});
});

test("Preferences lazily creates the version-one database, store, and unique name index", async () => {
    // Opening on first use must create schema without eager constructor work.
    const database = createIndexedDB();
    installEnvironment(database);
    const preferences = new Preferences();
    assert.equal(database.opens.length, 0);
    assert.deepEqual(await preferences.list(), []);
    assert.deepEqual(database.opens, [{name:"xshell-preferences", version:1}]);
    assert.equal(database.hasStore("preferences"), true);
    assert.deepEqual(database.index("preferences", "name"), {keyPath:"name", unique:true});
});

test("Preferences creates UUID records with default metadata and updates them without changing identity", async () => {
    // Verify creation defaults followed by an atomic metadata and value update.
    const database = createIndexedDB();
    installEnvironment(database);
    const clock = installClock(Date.parse("2026-11-17T10:00:00.000Z"));
    const preferences = new Preferences();
    await preferences.set("x-editor:fontSize", 14);
    const created = database.records()[0];
    assert.match(created.id, UUID_PATTERN);
    assert.equal(created.label, created.name);
    assert.equal(created.description, "");
    assert.equal(created.createdAt, "2026-11-17T10:00:00.000Z");
    assert.equal(created.modifiedAt, created.createdAt);
    assert.equal(created.revision, 1);

    clock.advance(30 * 60 * 1000);
    await preferences.set("x-editor:fontSize", 16, {label:"Editor Font Size", description:"Font size in pixels"});
    const updated = database.records()[0];
    assert.equal(updated.id, created.id);
    assert.equal(updated.name, created.name);
    assert.equal(updated.createdAt, created.createdAt);
    assert.equal(updated.modifiedAt, "2026-11-17T10:30:00.000Z");
    assert.equal(updated.revision, 2);
    assert.equal(updated.value, 16);
    assert.equal(updated.label, "Editor Font Size");
    assert.equal(updated.description, "Font size in pixels");

    await preferences.set("x-editor:fontSize", 18);
    const preserved = database.records()[0];
    assert.equal(preserved.label, "Editor Font Size");
    assert.equal(preserved.description, "Font size in pixels");
    assert.equal(preserved.revision, 3);
});

test("Preferences get distinguishes stored undefined from a missing record", async () => {
    // A record lookup result, rather than its value, determines whether the default applies.
    const database = createIndexedDB();
    installEnvironment(database);
    const preferences = new Preferences();
    await preferences.set("defined", 0);
    await preferences.set("undefined", undefined);
    assert.equal(await preferences.get("defined", 42), 0);
    assert.equal(await preferences.get("undefined", 42), undefined);
    assert.equal(await preferences.get("missing", 42), 42);
});

test("Preferences list uses prefix ranges and returns deterministic name order", async () => {
    // Insert out of order so enumeration order must come from the name index.
    const database = createIndexedDB();
    installEnvironment(database);
    const preferences = new Preferences();
    await preferences.set("x-theme:mode", "dark");
    await preferences.set("x-editor:tabSize", 4);
    await preferences.set("x-editor:fontSize", 14);
    assert.deepEqual((await preferences.list()).map(item => item.name), ["x-editor:fontSize", "x-editor:tabSize", "x-theme:mode"]);
    assert.deepEqual((await preferences.list("x-editor:")).map(item => item.name), ["x-editor:fontSize", "x-editor:tabSize"]);
    assert.deepEqual((await preferences.list("")).map(item => item.name), ["x-editor:fontSize", "x-editor:tabSize", "x-theme:mode"]);
});

test("Preferences deletion is safe for existing and missing names", async () => {
    // Both deletion paths must commit successfully and leave unrelated records intact.
    const database = createIndexedDB();
    installEnvironment(database);
    const preferences = new Preferences();
    await preferences.set("one", 1);
    await preferences.set("two", 2);
    await preferences.delete("one");
    await preferences.delete("missing");
    assert.deepEqual((await preferences.list()).map(item => item.name), ["two"]);
});

test("Preferences persists records across service instances", async () => {
    // Separate service singletons share the same origin-scoped IndexedDB database.
    const database = createIndexedDB();
    installEnvironment(database);
    await new Preferences().set("shared", {enabled:true});
    assert.deepEqual(await new Preferences().get("shared"), {enabled:true});
});

test("Preferences round-trips structured-clone values without JSON serialization", async () => {
    // Exercise representative native types that would be lost or changed by JSON serialization.
    const database = createIndexedDB();
    installEnvironment(database);
    const preferences = new Preferences();
    const value = {
        date: new Date("2026-11-17T12:00:00.000Z"),
        map: new Map([["answer", 42]]),
        set: new Set(["a", "b"]),
        buffer: Uint8Array.from([1, 2, 3]).buffer,
        typed: new Uint16Array([4, 5])
    };
    await preferences.set("native", value);
    const restored = await preferences.get("native");
    assert.ok(restored.date instanceof Date);
    assert.ok(restored.map instanceof Map);
    assert.ok(restored.set instanceof Set);
    assert.ok(restored.buffer instanceof ArrayBuffer);
    assert.ok(restored.typed instanceof Uint16Array);
    assert.deepEqual(restored, value);
});

test("Preferences rejects unsupported values and preserves the previous record", async () => {
    // A structured-clone failure must abort the transaction rather than corrupt the old value.
    const database = createIndexedDB();
    installEnvironment(database);
    const preferences = new Preferences();
    await preferences.set("stable", {version:1});
    const before = database.records()[0];
    await assert.rejects(preferences.set("stable", () => {}), error => error?.name === "DataCloneError");
    assert.deepEqual(database.records()[0], before);
    assert.deepEqual(await preferences.get("stable"), {version:1});
});

test("Preferences serializes concurrent updates and rejects transaction failures without partial writes", async () => {
    // IndexedDB's write lock keeps every revision increment, even when callers update concurrently.
    const database = createIndexedDB();
    installEnvironment(database);
    const preferences = new Preferences();
    await preferences.set("counter", 0);
    await Promise.all(Array.from({length:10}, (_unused, index) => preferences.set("counter", index + 1)));
    assert.equal(database.records()[0].revision, 11);

    const beforeFailure = database.records()[0];
    database.failPut();
    await assert.rejects(preferences.set("counter", 99), /Injected put failure/u);
    assert.deepEqual(database.records()[0], beforeFailure);
});

test("Preferences reports blocked and failed opens and permits a later retry", async () => {
    // Failed lazy open promises are cleared so a transient browser condition is recoverable.
    const database = createIndexedDB();
    installEnvironment(database);
    database.blockOpen();
    const preferences = new Preferences();
    await assert.rejects(preferences.list(), /blocked by another tab/u);
    database.failOpen();
    await assert.rejects(preferences.list(), /Injected open failure/u);
    assert.deepEqual(await preferences.list(), []);
    assert.equal(database.opens.length, 3);
});

test("Preferences validates keys, prefixes, and editable metadata", async () => {
    // Public input checks reject ambiguous keys and service-managed metadata before storage changes.
    const database = createIndexedDB();
    installEnvironment(database);
    const preferences = new Preferences();
    await assert.rejects(preferences.set(" ", 1), /non-empty string/u);
    await assert.rejects(preferences.set("key", 1, {id:"caller"}), /unknown property/u);
    await assert.rejects(preferences.set("key", 1, {label:1}), /label must be a string/u);
    await assert.rejects(preferences.list(null), /prefix must be a string/u);
    assert.deepEqual(database.opens, []);
});

// FileSystemHandle objects are browser-provided, origin-bound platform objects and are not fabricated here. Browser integration coverage should
// persist a handle returned by showOpenFilePicker(), reload the Page, retrieve it through get(), and verify its identity and permission workflow.
