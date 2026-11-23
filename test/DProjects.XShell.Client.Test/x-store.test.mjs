import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import StoreContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/contracts/store.json" with { type: "json" };
import StoreSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/schemas/store.schema.json" with { type: "json" };
import SampleStore from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/samples/store.json" with { type: "json" };
import MemoryStore from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/js/store-mem.js";
import StorePage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/pages/store.js";
import DetailPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/pages/store-detail.js";
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import PageSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/page.schema.json" with { type: "json" };
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Loader from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/loader.js";
import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/resolver.js";

const createStore = (url = "mem:test") => new MemoryStore({jsonValidator: new JsonValidator()}, {url});

test("Store contract and Store metadata schema validate", () => {
    // Validate the public contract through the shared contract vocabulary.
    const validator = new JsonValidator();
    assert.equal(validator.validate(StoreContract, ContractSchema).valid, true);
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

test("store resources resolve through instance-js and cache each memory identity", async () => {
    // Construct the real Resolver/Loader path with the same property-based service-provider shape used in production.
    const jsonValidator = new JsonValidator();
    const resolvedServices = [];
    const services = new Proxy(Object.create(null), {get(target, name) {
        if (typeof name !== "string") return undefined;
        resolvedServices.push(name);
        if (name === "jsonValidator") return jsonValidator;
        throw new Error(`Unexpected service '${name}'`);
    }});
    const providerUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/js/store-mem.js", import.meta.url).href;
    const instanceLoaderUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/instance-js.js", import.meta.url).href;
    const config = {
        app: {basePath: "", baseUrl: new URL("../../", import.meta.url).href},
        xshell: {
            assets: {path: "/_assets/xshell"}, services: {navigation: {options: {mode: "path"}}}, ui: {components: {lazy: null}},
            resolver: {store: {
                "mem:": {src: providerUrl, loader: instanceLoaderUrl, cache: true},
                "mem:{identity}": {src: providerUrl, loader: instanceLoaderUrl, cache: true}
            }}
        }
    };
    const resolver = new Resolver({config});
    const loader = new Loader({config, resolver, bus: {emit() {}}, services}, {
        appBasePath: config.app.basePath,
        xshellAssetsPath: config.xshell.assets.path,
        componentLazy: config.xshell.ui.components.lazy
    });
    const first = await loader.load("store:mem:demo");
    const again = await loader.load("store:mem:demo");
    const other = await loader.load("store:mem:other");
    assert.strictEqual(first, again);
    assert.notStrictEqual(first, other);
    assert.equal(first.url, "mem:demo");
    assert.deepEqual(resolvedServices, ["jsonValidator", "jsonValidator", "jsonValidator", "jsonValidator"]);
    await first.add("customers", {id: "only-demo", name: "Demo"});
    assert.equal(await other.get("customers", "only-demo"), null);
});

test("Store Explorer discovers collections and refreshes after Detail success", async () => {
    // Test controller interaction without depending on DOM rendering internals.
    const store = createStore();
    const state = structuredClone(StorePage.state);
    let navigated;
    const controller = StorePage.controller({
        state,
        loader: {async load(resource) { assert.equal(resource, "store:mem:"); return store; }},
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
        const controller = DetailPage.controller({state, loader: {async load() { return store; }}, page});
        await controller.load();
        if (!id) state.document.name = "Added from Detail";
        else state.document.name = "Edited from Detail";
        await controller.save();
        assert.equal(called, true);
        assert.equal(closed.saved, true);
        store[expectedMethod] = original;
    }
});
