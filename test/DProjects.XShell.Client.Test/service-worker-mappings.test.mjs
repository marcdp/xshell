import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const workerPath = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/bootstrap/sw.js", import.meta.url);
const workerSource = readFileSync(workerPath, "utf8");

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createIndexedDB(storage, events) {
    return {
        open() {
            const request = {};
            queueMicrotask(() => {
                const database = {
                    objectStoreNames: { contains() { return true; } },
                    createObjectStore() {},
                    transaction(storeName, mode) {
                        const transaction = { oncomplete: null, onerror: null, error: null };
                        transaction.objectStore = () => ({
                            put(value, key) {
                                queueMicrotask(() => {
                                    storage.set(key, clone(value));
                                    events.push(`persist:${value.rules.length}`);
                                    transaction.oncomplete?.();
                                });
                            },
                            get(key) {
                                const getRequest = {};
                                queueMicrotask(() => {
                                    getRequest.result = clone(storage.get(key));
                                    getRequest.onsuccess?.();
                                });
                                return getRequest;
                            }
                        });
                        return transaction;
                    }
                };
                request.result = database;
                request.onupgradeneeded?.();
                request.onsuccess?.();
            });
            return request;
        }
    };
}

function createNamespacedIndexedDB() {
    // Model IndexedDB's database-name isolation so workers on one origin can be tested together.
    const databases = new Map();
    const opens = [];
    return {
        databases,
        opens,
        indexedDB: {
            open(name, version) {
                opens.push({name, version});
                const request = {};
                queueMicrotask(() => {
                    let definition = databases.get(name);
                    const upgrade = !definition;
                    if (!definition) {
                        definition = {stores:new Set(), records:new Map()};
                        databases.set(name, definition);
                    }
                    const database = {
                        objectStoreNames: {contains(storeName) { return definition.stores.has(storeName); }},
                        createObjectStore(storeName) { definition.stores.add(storeName); },
                        transaction(storeName) {
                            assert.equal(definition.stores.has(storeName), true);
                            const transaction = {oncomplete:null, onerror:null, error:null};
                            transaction.objectStore = () => ({
                                put(value, key) {
                                    queueMicrotask(() => {
                                        definition.records.set(key, clone(value));
                                        transaction.oncomplete?.();
                                    });
                                },
                                get(key) {
                                    const getRequest = {};
                                    queueMicrotask(() => {
                                        getRequest.result = clone(definition.records.get(key));
                                        getRequest.onsuccess?.();
                                    });
                                    return getRequest;
                                }
                            });
                            return transaction;
                        }
                    };
                    request.result = database;
                    if (upgrade) request.onupgradeneeded?.();
                    request.onsuccess?.();
                });
                return request;
            }
        }
    };
}

function createWorker(storage = new Map(), options = {}) {
    const listeners = new Map();
    const events = [];
    const fetches = [];
    const self = {
        location: { origin: "https://example.test", pathname: options.scriptPath || "/app/sw.js" },
        registration: { scope: options.scope || "https://example.test/app/" },
        clients: { async claim() {} },
        async skipWaiting() {},
        addEventListener(type, listener) { listeners.set(type, listener); }
    };
    const context = vm.createContext({
        URL, Headers, Request, Response, queueMicrotask,
        console: { log() {} },
        indexedDB: options.indexedDB || createIndexedDB(storage, events),
        self,
        async fetch(input) {
            const url = input instanceof Request ? input.url : String(input);
            fetches.push(url);
            return new Response("ok", { status: 200, headers: { Location: "physical", "Content-Location": "physical" } });
        }
    });
    new vm.Script(workerSource, { filename: workerPath.pathname }).runInContext(context);

    return {
        events,
        fetches,
        storage,
        async register(rules) {
            let waiting;
            let reply;
            listeners.get("message")({
                data: { type: "registerMappings", payload: { rules } },
                ports: [{ postMessage(message) { reply = clone(message); events.push(`reply:${message.type}`); } }],
                waitUntil(promise) { waiting = promise; }
            });
            await waiting;
            return reply;
        },
        async fetch(url, method = "GET") {
            let responsePromise;
            listeners.get("fetch")({
                request: new Request(url, { method }),
                respondWith(promise) { responsePromise = promise; }
            });
            return responsePromise;
        }
    };
}

function rule(path, dst, extra = {}) {
    return { src: `https://example.test/app${path}`, dst, ...extra };
}

function persistedRules(worker) {
    return worker.storage.get("state")?.rules || [];
}

test("mapping registration is additive, durable before acknowledgement, and idempotent by src and dst", async () => {
    const worker = createWorker();
    const a = rule("/_assets/orders/1.4.0.aaa", "https://cdn.test/orders/1.4.0/");
    const b = rule("/_assets/orders/1.5.0.bbb", "https://cdn.test/orders/1.5.0/");

    assert.deepEqual(await worker.register([a]), { type: "registered" });
    assert.deepEqual(worker.events, ["persist:1", "reply:registered"]);
    assert.deepEqual(await worker.register([b]), { type: "registered" });
    assert.deepEqual(persistedRules(worker).map(item => item.src), [a.src, b.src]);

    assert.deepEqual(await worker.register([{ ...a, src: a.src + "/", name: "different diagnostics" }]), { type: "registered" });
    assert.equal(persistedRules(worker).length, 2);
    assert.equal(persistedRules(worker)[0].name, undefined);
});

test("an immutable conflict rejects the complete batch without changing persisted mappings", async () => {
    const worker = createWorker();
    const a = rule("/_assets/orders/1.4.0.aaa", "https://cdn.test/orders/1.4.0/");
    const b = rule("/_assets/reports/2.0.0.bbb", "https://cdn.test/reports/2.0.0/");
    await worker.register([a]);
    const persistedBefore = clone(persistedRules(worker));

    const reply = await worker.register([b, { ...a, dst: "https://other.test/orders/" }]);
    assert.equal(reply.type, "error");
    assert.match(reply.message, /already registered.*cannot be remapped/);
    assert.deepEqual(persistedRules(worker), persistedBefore);
    assert.equal(persistedRules(worker).some(item => item.src === b.src), false);
    await worker.fetch(a.src + "/pages/index.js");
    await worker.fetch(b.src + "/pages/index.js");
    assert.deepEqual(worker.fetches, ["https://cdn.test/orders/1.4.0/pages/index.js", b.src + "/pages/index.js"]);
});

test("framework and multiple module generations coexist and remain independently routable", async () => {
    const worker = createWorker();
    await worker.register([
        rule("/_assets/xshell/0.9.0.xxx", "https://cdn.test/xshell/"),
        rule("/_assets/orders/1.4.0.aaa", "https://cdn.test/orders/1.4.0/"),
        rule("/_assets/orders/1.5.0.bbb", "https://cdn.test/orders/1.5.0/"),
        rule("/_assets/reports/2.0.0.rrr", "https://cdn.test/reports/")
    ]);

    await worker.fetch("https://example.test/app/_assets/orders/1.4.0.aaa/pages/index.js");
    await worker.fetch("https://example.test/app/_assets/orders/1.5.0.bbb/pages/index.js");
    assert.deepEqual(worker.fetches, [
        "https://cdn.test/orders/1.4.0/pages/index.js",
        "https://cdn.test/orders/1.5.0/pages/index.js"
    ]);
    assert.equal(persistedRules(worker).length, 4);
});

test("each registration retains its requested mappings while the worker stores their union", async () => {
    const worker = createWorker();
    const generationA = [rule("/_assets/app/1.0.0.aaa", "https://cdn.test/app/a/")];
    const generationB = [rule("/_assets/app/2.0.0.bbb", "https://cdn.test/app/b/")];

    await worker.register(generationA);
    await worker.register(generationB);

    assert.deepEqual(generationA.map(item => item.src), ["https://example.test/app/_assets/app/1.0.0.aaa"]);
    assert.deepEqual(generationB.map(item => item.src), ["https://example.test/app/_assets/app/2.0.0.bbb"]);
    assert.deepEqual(persistedRules(worker).map(item => item.src), [generationA[0].src, generationB[0].src]);
});

test("a restarted worker restores the complete persisted registry", async () => {
    const storage = new Map();
    const firstWorker = createWorker(storage);
    await firstWorker.register([
        rule("/_assets/orders/1.4.0.aaa", "https://cdn.test/orders/1.4.0/"),
        rule("/_assets/reports/2.0.0.bbb", "https://cdn.test/reports/2.0.0/")
    ]);

    const restartedWorker = createWorker(storage);
    await restartedWorker.fetch("https://example.test/app/_assets/reports/2.0.0.bbb/pages/index.js?mode=full");
    assert.deepEqual(restartedWorker.fetches, ["https://cdn.test/reports/2.0.0/pages/index.js?mode=full"]);
});

test("Service Workers namespace fixed state stores by normalized registration scope", async () => {
    // Workers sharing an origin retain independent registries, and script locations do not select the database.
    const shared = createNamespacedIndexedDB();
    const admin = createWorker(new Map(), {scope:"https://example.test/admin/", scriptPath:"/assets/worker.js", indexedDB:shared.indexedDB});
    const projects = createWorker(new Map(), {scope:"https://example.test/projects", scriptPath:"/admin/sw.js", indexedDB:shared.indexedDB});
    await admin.register([{src:"https://example.test/admin/_assets/x", dst:"https://cdn.test/admin/"}]);
    await projects.register([{src:"https://example.test/projects/_assets/x", dst:"https://cdn.test/projects/"}]);

    assert.deepEqual([...new Set(shared.opens.map(item => item.name))], ["admin-xshell-sw", "projects-xshell-sw"]);
    assert.equal(shared.opens.every(item => !item.name.startsWith("-") && !item.name.includes("--")), true);
    assert.deepEqual([...shared.databases.values()].map(database => [...database.stores]), [["state"], ["state"]]);
    assert.equal(shared.databases.get("admin-xshell-sw").records.get("state").rules[0].dst, "https://cdn.test/admin/");
    assert.equal(shared.databases.get("projects-xshell-sw").records.get("state").rules[0].dst, "https://cdn.test/projects/");
});

test("Service Worker scope naming covers root and URL-encoded nested paths", async () => {
    // Scope URL pathnames use the same encoded normalized-prefix convention as application Services.
    for (const [scope, expected] of [
        ["https://example.test/", "xshell-sw"],
        ["https://example.test/company/admin/", "company-admin-xshell-sw"],
        ["https://example.test/company//admin/", "company-%2F-admin-xshell-sw"],
        ["https://example.test/encoded%20path/", "encoded%2520path-xshell-sw"]
    ]) {
        const shared = createNamespacedIndexedDB();
        const worker = createWorker(new Map(), {scope, indexedDB:shared.indexedDB});
        await worker.register([{src:new URL("_assets/x", scope).href, dst:"https://cdn.test/x/"}]);
        assert.equal(shared.opens[0].name, expected);
        assert.equal(expected.startsWith("-") || expected.includes("--"), false);
    }
});

test("concurrent registrations are serialized and persist their union", async () => {
    const worker = createWorker();
    const a = rule("/_assets/orders/1.4.0.aaa", "https://cdn.test/orders/1.4.0/");
    const b = rule("/_assets/reports/2.0.0.bbb", "https://cdn.test/reports/2.0.0/");

    const [aReply, bReply] = await Promise.all([worker.register([a]), worker.register([b])]);
    assert.deepEqual(aReply, { type: "registered" });
    assert.deepEqual(bReply, { type: "registered" });
    assert.deepEqual(new Set(persistedRules(worker).map(item => item.src)), new Set([a.src, b.src]));
});

test("routing selects the longest complete-boundary match independently of registration order", async () => {
    const worker = createWorker();
    await worker.register([
        rule("/_assets/orders", "https://cdn.test/legacy/"),
        rule("/_assets/orders/1.4.0.aaa", "https://cdn.test/generation/")
    ]);
    await worker.fetch("https://example.test/app/_assets/orders/1.4.0.aaa/pages/index.js");
    assert.deepEqual(worker.fetches, ["https://cdn.test/generation/pages/index.js"]);

    const boundaryWorker = createWorker();
    await boundaryWorker.register([rule("/_assets/orders/1.4.0.aaa", "https://cdn.test/generation/")]);
    const unrelated = "https://example.test/app/_assets/orders/1.4.0.aaa-extra/pages/index.js";
    await boundaryWorker.fetch(unrelated);
    assert.deepEqual(boundaryWorker.fetches, [unrelated]);
});

test("GET and HEAD requests route through mappings while other methods remain untouched", async () => {
    const worker = createWorker();
    const source = "https://example.test/app/_assets/app/1.0.0.aaa/file.js";
    await worker.register([rule("/_assets/app/1.0.0.aaa", "https://cdn.test/app/")]);

    await worker.fetch(source, "GET");
    await worker.fetch(source, "HEAD");
    assert.deepEqual(worker.fetches, ["https://cdn.test/app/file.js", "https://cdn.test/app/file.js"]);
    assert.equal(await worker.fetch(source, "POST"), undefined);
    assert.equal(worker.fetches.length, 2);
});
