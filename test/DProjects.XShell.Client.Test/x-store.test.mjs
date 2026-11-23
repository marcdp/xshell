import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import StoreContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/contracts/store.json" with { type: "json" };
import StoresContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/contracts/stores.json" with { type: "json" };
import StoreSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/schemas/store.schema.json" with { type: "json" };
import SampleStore from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/samples/store.json" with { type: "json" };
import MemoryStore from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/providers/store-mem.js";
import Stores from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/services/stores.js";
import StorePage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/pages/store.js";
import DetailPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/pages/store-detail.js";
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import PageSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/page.schema.json" with { type: "json" };
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Loader from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/loader.js";
import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/resolver.js";

const createStore = (url = "mem:test") => new MemoryStore({jsonValidator: new JsonValidator()}, {url});

function createLoaderStub() {
    // Capture local provider translation and the internal Loader handoff without using the global Resolver.
    const calls = [];
    return {
        calls,
        _createResourcePatternResolver(appBaseUrl, providers) {
            return {
                resolve(url) {
                    const definition = providers[url];
                    if (!definition) return null;
                    const absolute = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(definition.src);
                    return {definition, url: absolute ? definition.src : new URL(definition.src.replace(/^\/+/, ""), appBaseUrl).href,
                        path: absolute ? null : definition.src};
                }
            };
        },
        async _loadResolved(resource, resolved) {
            calls.push({resource, resolved});
            if (!resolved) throw Object.assign(new Error(`Resource not found: ${resource}`), {code: "RESOURCE_NOT_FOUND"});
            return {resource};
        }
    };
}

function createRuntime(providers, services = {}) {
    // Build the local provider matcher and Loader over a global Resolver with no Store category.
    services = {jsonValidator: new JsonValidator(), ...services};
    const config = {
        app: {basePath: "", baseUrl: new URL("../../", import.meta.url).href},
        xshell: {assets: {path: "/_assets/xshell"}, resolver: {}}
    };
    const resolver = new Resolver({config});
    const xshellRuntimeUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell", import.meta.url).href;
    const loader = new Loader({resolver, bus: {emit() {}}, services}, {
        appBasePath: xshellRuntimeUrl, xshellAssetsPath: "", componentLazy: null
    });
    return {config, resolver, loader, stores: new Stores({loader, config}, {providers})};
}

test("Store contract and Store metadata schema validate", () => {
    // Validate the public contract through the shared contract vocabulary.
    const validator = new JsonValidator();
    assert.equal(validator.validate(StoreContract, ContractSchema).valid, true);
    assert.equal(validator.validate(StoresContract, ContractSchema).valid, true);
    assert.deepEqual(Object.keys(StoresContract.methods), ["open"]);
    assert.equal(validator.validate(SampleStore.schema, StoreSchema).valid, true);
    assert.equal(validator.validate({...SampleStore.schema, collections: []}, StoreSchema).valid, false);
});

test("Store Explorer and Detail definitions satisfy the Page schema", () => {
    // Validate complete definitions the same way page-js projects controller functions before validation.
    for (const definition of [StorePage, DetailPage]) {
        const projected = Object.fromEntries(Object.entries(definition).map(([name, value]) => [name, typeof value === "function" ? {} : value]));
        const result = new JsonValidator().validate(projected, PageSchema, {"./contract.schema.json": ContractSchema});
        assert.equal(result.valid, true, JSON.stringify(result.errors));
    }
});

test("memory Store discovers collections and supports CRUD with generated ids", async () => {
    // Exercise the complete minimal Store surface against multiple declared collections.
    const store = createStore();
    assert.deepEqual(Object.keys(store.schema.collections), ["customers", "products"]);
    assert.equal((await store.list("customers")).length, 2);
    assert.equal((await store.get("customers", "customer-1")).name, "Ada Lovelace");
    assert.equal(await store.get("customers", "missing"), null);

    const added = await store.add("customers", {name: "Generated", email: "generated@example.test"});
    assert.match(added.id, /^[0-9a-f-]{36}$/i);
    assert.equal((await store.get("customers", added.id)).name, "Generated");

    await assert.rejects(() => store.add("customers", {id: added.id, name: "Duplicate"}), /already exists/);
    const saved = await store.save("customers", {id: added.id, name: "Saved", email: "saved@example.test"});
    assert.equal(saved.name, "Saved");
    assert.equal(await store.remove("customers", added.id), true);
    assert.equal(await store.remove("customers", added.id), false);
});

test("memory Store rejects unknown collections and invalid documents without mutation", async () => {
    // Confirm every failure occurs before provider state changes.
    const store = createStore();
    await assert.rejects(() => store.list("missing"), /Unknown Store collection/);
    await assert.rejects(() => store.add("customers", {id: "invalid"}), /Invalid document/);
    await assert.rejects(() => store.save("customers", {name: "Missing id"}), /document.id/);
    await assert.rejects(() => store.save("products", {id: "product-1", name: "Invalid", price: -1}), /Invalid document/);
    assert.deepEqual(await store.get("products", "product-1"), {id: "product-1", name: "Notebook", price: 12.5});
});

test("memory Store returns defensive copies and accepts only JSON-compatible documents", async () => {
    // Mutating get/list/schema output must not mutate provider state.
    const store = createStore();
    const first = await store.get("customers", "customer-1");
    first.name = "Changed";
    const listed = await store.list("customers");
    listed[0].name = "Also changed";
    const schema = store.schema;
    schema.collections.customers.label = "Changed";
    assert.equal((await store.get("customers", "customer-1")).name, "Ada Lovelace");
    assert.equal(store.schema.collections.customers.label, "Customers");
    await assert.rejects(() => store.add("customers", {id: "date", name: "Bad", value: new Date()}), /plain JSON objects/);
});

test("Stores.open translates providers and preserves complete internal identity", async () => {
    // Verify the authored provider surface is cloned and translated to the private instance-js definition.
    const loader = createLoaderStub();
    const providerOptions = {tag: "configured", nested: {value: 1}};
    const stores = new Stores({loader, config: {app: {baseUrl: "https://example.test/"}}}, {providers: {
        "mem:demo": {implementation: "/providers/store-mem.js", cache: true, cacheMode: "path", options: providerOptions}
    }});
    providerOptions.tag = "changed";
    providerOptions.nested.value = 2;

    assert.deepEqual(await stores.open("mem:demo"), {resource: "store:mem:demo"});
    assert.deepEqual(loader.calls[0], {
        resource: "store:mem:demo",
        resolved: {
            definition: {src: "/providers/store-mem.js", loader: "instance-js", cache: true, cacheMode: "path",
                options: {tag: "configured", nested: {value: 1}}},
            url: "https://example.test/providers/store-mem.js", path: "/providers/store-mem.js"
        }
    });
    for (const value of [null, undefined, "", "   ", 0, false, {}, []]) {
        await assert.rejects(() => stores.open(value), {name: "TypeError", message: "Store URL must be a non-empty string."});
    }
    assert.equal(loader.calls.length, 1);
});

test("Stores.open resolves locally and caches each memory identity", async t => {
    // Exercise Stores, the local matcher, Loader, instance-js, and MemoryStore without a global Store category.
    const providerUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/providers/store-mem.js", import.meta.url).href;
    const {resolver, loader, stores} = createRuntime({
        "mem:": {implementation: providerUrl, cache: true},
        "mem:{identity}": {implementation: providerUrl, cache: true}
    });
    const anonymousFirst = await stores.open("mem:");
    const anonymousAgain = await stores.open("mem:");
    const first = await stores.open("mem:demo");
    const again = await stores.open("mem:demo");
    const other = await stores.open("mem:other");
    assert.strictEqual(anonymousFirst, anonymousAgain);
    assert.strictEqual(first, again);
    assert.notStrictEqual(first, other);
    assert.equal(first.url, "mem:demo");
    await first.add("customers", {id: "only-demo", name: "Demo"});
    assert.equal(await other.get("customers", "only-demo"), null);
    assert.deepEqual(loader.registry.map(item => item.resource), ["store:mem:", "store:mem:demo", "store:mem:other"]);
    assert.equal(resolver.registry.some(item => item.resource.startsWith("store:")), false);
    t.mock.method(console, "error", () => {});
    assert.equal(resolver.resolve("store:mem:demo"), null);
    await assert.rejects(() => loader.load("store:mem:demo"), {name: "ResourceError", code: "RESOURCE_NOT_FOUND"});
});

test("Stores reuses Loader sharing, failure eviction, and instance-js option validation", async () => {
    // Preserve Loader lifecycle behavior and implementation-owned option validation for local providers.
    const providerUrl = new URL("./fixtures/store-provider.mjs?case=lifecycle", import.meta.url).href;
    const provider = await import(providerUrl);
    provider.reset();
    const {stores, loader} = createRuntime({"test:{identity}": {
        implementation: providerUrl, cache: true, options: {tag: "configured"}
    }});
    const firstPromise = stores.open("test:demo");
    const secondPromise = stores.open("test:demo");
    await provider.waitForCallCount(1);
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    assert.strictEqual(first, second);
    assert.deepEqual(provider.getCalls().map(call => call.options), [{tag: "configured", url: "test:demo"}]);
    assert.equal(loader.registry.length, 1);

    provider.reset();
    provider.failOnce();
    const retryRuntime = createRuntime({"test:{identity}": {implementation: providerUrl, cache: true}});
    await assert.rejects(() => retryRuntime.stores.open("test:retry"), /Simulated Store provider failure/);
    assert.equal((await retryRuntime.stores.open("test:retry")).number, 2);

    const invalidRuntime = createRuntime({"test:{identity}": {implementation: providerUrl, options: {unknown: true}}});
    await assert.rejects(() => invalidRuntime.stores.open("test:invalid"), /Invalid provider options/);
});

test("Stores options and manifest expose only the domain provider API", () => {
    // Validate the closed provider shape and the configured singleton Service boundary.
    const validator = new JsonValidator();
    const valid = {providers: {"mem:{identity}": {
        implementation: "/providers/store-mem.js", cache: true, cacheMode: "path", options: {tag: "work"}
    }}};
    assert.equal(validator.validate(valid, Stores.optionsSchema).valid, true);
    for (const definition of [
        {}, {implementation: ""}, {implementation: "/providers/store-mem.js", cache: "yes"},
        {implementation: "/providers/store-mem.js", cacheMode: "identity"}, {implementation: "/providers/store-mem.js", options: null},
        {implementation: "/providers/store-mem.js", options: []}, {implementation: "/providers/store-mem.js", loader: "instance-js"}
    ]) assert.equal(validator.validate({providers: {"mem:": definition}}, Stores.optionsSchema).valid, false);

    const manifest = readFileSync(new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/manifest.jsonc", import.meta.url), "utf8");
    assert.match(manifest, /"stores"\s*:\s*\{\s*"contract"\s*:\s*"stores"[\s\S]*?"lifetime"\s*:\s*"singleton"/);
    assert.match(manifest, /"providers"\s*:\s*\{[\s\S]*?"mem:"[\s\S]*?"mem:\{identity\}"/);
    assert.match(manifest, /"implementation"\s*:\s*"\/providers\/store-mem\.js"/);
    assert.doesNotMatch(manifest, /"implementation"\s*:\s*"\/js\/store-/);
    assert.doesNotMatch(manifest, /"resolver"\s*:/);
});

test("Store Explorer discovers collections and refreshes after Detail success", async () => {
    // Test controller interaction without depending on DOM rendering internals.
    const store = createStore();
    const state = structuredClone(StorePage.state);
    let navigated;
    const controller = StorePage.controller({
        state,
        stores: {async open(url) { assert.equal(url, "mem:"); return store; }},
        navigation: {async navigate(options) { navigated = options; return {saved: true}; }},
        page: {id: "explorer"},
        dialog: {async confirm() { return "yes"; }}
    });
    await controller.load();
    assert.deepEqual(state.collections.map(item => item.name), ["customers", "products"]);
    assert.equal(state.documents.length, 2);
    await controller.openDetail("customer-1");
    assert.equal(navigated.open, "stack");
    assert.deepEqual(navigated.params, {src: "mem:", collection: "customers", id: "customer-1"});
});

test("Store Detail uses add and edit modes and reports a saved stack result", async () => {
    // Cover both mutation paths while treating x-schema validation as an existing component responsibility.
    const store = createStore();
    for (const [id, expectedMethod] of [["", "add"], ["customer-1", "save"]]) {
        const state = {...structuredClone(DetailPage.state), collection: "customers", id};
        let closed;
        const original = store[expectedMethod].bind(store);
        let called = false;
        store[expectedMethod] = async (...args) => { called = true; return original(...args); };
        const page = {host: {querySelector() { return {validate() { return []; }}; }}, close(result) { closed = result; }};
        const controller = DetailPage.controller({state, stores: {async open(url) { assert.equal(url, "mem:"); return store; }}, page});
        await controller.load();
        if (!id) state.document.name = "Added from Detail";
        else state.document.name = "Edited from Detail";
        await controller.save();
        assert.equal(called, true);
        assert.equal(closed.saved, true);
        store[expectedMethod] = original;
    }
});
