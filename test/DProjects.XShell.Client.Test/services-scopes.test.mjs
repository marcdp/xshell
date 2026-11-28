import assert from "node:assert/strict";
import test from "node:test";

import Services, {serviceForConsumer} from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";

function createServices() {
    return new Services({
        config: { app: { baseUrl: "https://example.test/" }, modules: {}, xshell: { services: {} } },
        loader: { async load() { throw new Error("Unexpected load."); } },
        contracts: { getContractItemById() { return undefined; } },
        resolver: { resolve() { return undefined; } }
    });
}

test("consumer adaptation preserves ordinary lookup, nested identities and lifetime ownership", async () => {
    const root = createServices();
    const adapted = [];
    const disposed = [];
    const plain = {forConsumer() { assert.fail("A public method is not the internal hook"); }};
    class Adapter {
        static optionsSchema = {type: "object", additionalProperties: false};
        init() { this.initialized = true; }
        dispose() { disposed.push(this); }
        [serviceForConsumer](consumer) {
            adapted.push(consumer);
            return {consumer, owner: this, dispose() { assert.fail("The returned view has no lifecycle"); }};
        }
    }
    class Nested {
        static optionsSchema = {type: "object", additionalProperties: false};
        constructor({singleton}) { this.consumer = singleton.consumer; }
    }
    class Consumer {
        static optionsSchema = {type: "object", additionalProperties: false};
        constructor(dependencies) {
            this.nested = dependencies.nested;
            this.first = dependencies.singleton;
            this.second = dependencies.singleton;
        }
    }
    for (const lifetime of ["singleton", "scoped", "transient"]) {
        root.register(lifetime, null, {lifetime, implementationItem: {class: Adapter}});
    }
    root.register("plain", plain);
    root.register("nested", null, {implementationItem: {class: Nested}});
    root.register("consumer", null, {implementationItem: {class: Consumer}});
    await root.init();
    const a = root.beginScope();
    const b = root.beginScope();
    const descriptor = {type: "page", id: "sample:/pages/index.js"};
    const singleton = await a.initialize("singleton");
    const scoped = await a.initialize("scoped");
    assert.ok(singleton.initialized && scoped.initialized);
    assert.equal(a.getServiceInfo("singleton").lifetime, "singleton");
    assert.equal(a.registry.length, 6);
    assert.deepEqual(adapted, []);
    assert.equal(a.resolve("plain", descriptor), plain);
    assert.throws(() => a.resolve("missing", descriptor), /Service not found: missing/);
    assert.equal(a.resolve("singleton", descriptor).consumer, descriptor);
    assert.equal(b.resolve("singleton", descriptor).owner, singleton);
    assert.equal(a.resolve("singleton"), singleton);
    assert.equal(a.resolve("scoped", descriptor).owner, scoped);
    const sibling = b.resolve("scoped", descriptor).owner;
    assert.notEqual(sibling, scoped);
    const first = a.resolve("transient", descriptor).owner;
    const second = a.resolve("transient", descriptor).owner;
    assert.notEqual(first, second);
    const consumer = a.resolve("consumer", descriptor);
    assert.deepEqual(consumer.nested.consumer, {type: "service", id: "nested"});
    assert.deepEqual(consumer.first.consumer, {type: "service", id: "consumer"});
    assert.equal(consumer.first.consumer, consumer.second.consumer);
    assert.notEqual(consumer.first, consumer.second);
    await a.dispose();
    assert.deepEqual(disposed, [second, first, scoped]);
    assert.equal(root.resolve("singleton"), singleton);
    await b.dispose();
    assert.equal(disposed.at(-1), sibling);
    await root.dispose();
});

test("Services scopes do not expose registry, ownership, context, or lifecycle internals", async () => {
    const root = createServices();
    const scope = root.beginScope({context: {owner: "test"}});
    const internalNames = [
        "_root", "_items", "_children", "_parent", "_scopedInstances", "_disposables", "_disposableSet",
        "_creationPath", "_lifecycleState", "_disposalPromise", "_context"
    ];

    for (const name of internalNames) {
        assert.equal(Object.hasOwn(scope, name), false, name);
        assert.equal(scope[name], undefined, name);
    }
    assert.deepEqual(Object.getOwnPropertyNames(Services.prototype).filter(name => name.startsWith("_")), []);
    await root.dispose();
});

test("beginScope creates distinct nested Services scopes without constructing services", async () => {
    const root = createServices();
    let constructions = 0;
    class Example {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor() { constructions++; }
    }
    root.register("example", null, { implementationItem: { class: Example } });
    await root.init();

    const first = root.beginScope();
    const second = root.beginScope();
    const nested = first.beginScope();

    assert.ok(first instanceof Services);
    assert.ok(nested instanceof Services);
    assert.notStrictEqual(first, second);
    assert.equal(constructions, 0);
    assert.equal(first.has("example"), true);
    assert.deepEqual(first.registry, root.registry);
    assert.deepEqual(first.getServiceInfo("example"), root.getServiceInfo("example"));
    assert.throws(() => first.register("local", {}), /Only the root Services instance can register services/);
    await assert.rejects(first.init(), /Only the root Services instance can initialize the service registry/);
});

test("root and child scopes share lazy singleton construction and dependencies", () => {
    const root = createServices();
    let dependencyConstructions = 0;
    let consumerConstructions = 0;
    class Dependency {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor() { dependencyConstructions++; }
    }
    class Consumer {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ dependency }) { consumerConstructions++; this.dependency = dependency; }
    }
    root.register("dependency", null, { implementationItem: { class: Dependency } });
    root.register("consumer", null, { implementationItem: { class: Consumer } });
    const first = root.beginScope();
    const second = root.beginScope();

    const consumer = first.resolve("consumer");

    assert.strictEqual(second.resolve("consumer"), consumer);
    assert.strictEqual(root.resolve("consumer"), consumer);
    assert.strictEqual(consumer.dependency, root.resolve("dependency"));
    assert.equal(dependencyConstructions, 1);
    assert.equal(consumerConstructions, 1);
});

test("scoped resolution preserves missing, circular, contract, and options validation errors", () => {
    const root = createServices();
    class First {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ second }) { this.second = second; }
    }
    class Second {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ first }) { this.first = first; }
    }
    class InvalidContract {
        static optionsSchema = { type: "object", additionalProperties: false };
    }
    class InvalidOptions {
        static optionsSchema = { type: "object", required: ["enabled"], additionalProperties: false };
    }
    root.register("first", null, { implementationItem: { class: First } });
    root.register("second", null, { implementationItem: { class: Second } });
    root.register("invalidContract", null, {
        implementationItem: { class: InvalidContract },
        contractItem: { contract: { methods: { execute: {} } } }
    });
    root.register("invalidOptions", null, { implementationItem: { class: InvalidOptions } });
    const scope = root.beginScope();

    assert.throws(() => scope.resolve("missing"), /Service not found: missing/);
    assert.throws(() => scope.resolve("first", {type: "module", id: "test"}), /Circular service dependency detected: first -> second -> first/);
    assert.throws(() => scope.resolve("invalidContract"), /does not implement required method 'execute'/);
    assert.throws(() => scope.resolve("invalidOptions"), /Invalid options for service 'invalidOptions'/);
});

test("initialization through scopes is shared, once-only, and never implicit", async () => {
    const root = createServices();
    let initCalls = 0;
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    const service = {
        async init() {
            initCalls++;
            await ready;
        }
    };
    root.register("example", service);
    const first = root.beginScope();
    const second = root.beginScope();

    assert.strictEqual(first.resolve("example"), service);
    assert.equal(initCalls, 0);
    const firstInitialization = first.initialize("example");
    const secondInitialization = second.initialize("example");

    assert.strictEqual(firstInitialization, secondInitialization);
    await Promise.resolve();
    assert.equal(initCalls, 1);
    release();
    assert.strictEqual(await firstInitialization, service);
    assert.strictEqual(await second.initialize("example"), service);
    assert.equal(initCalls, 1);
});

test("initialization failures requested through scopes remain retained", async () => {
    const root = createServices();
    const failure = new Error("Initialization failed.");
    let initCalls = 0;
    root.register("example", { init() { initCalls++; throw failure; } });
    const first = root.beginScope();
    const second = root.beginScope();

    const firstInitialization = first.initialize("example");
    await assert.rejects(firstInitialization, error => error === failure);
    const secondInitialization = second.initialize("example");

    assert.strictEqual(secondInitialization, firstInitialization);
    await assert.rejects(secondInitialization, error => error === failure);
    assert.equal(initCalls, 1);
});

test("scope disposal is isolated, reverse ordered, recursive, and detaches completed children", async () => {
    const root = createServices();
    const singleton = {};
    root.register("example", singleton);
    const order = [];
    const parent = root.beginScope();
    const firstChild = parent.beginScope();
    const secondChild = parent.beginScope();
    const thirdChild = parent.beginScope();
    const sibling = root.beginScope();
    firstChild.addDisposable({ dispose() { order.push("first-child"); } });
    secondChild.addDisposable({ async dispose() { await Promise.resolve(); order.push("second-child"); } });
    thirdChild.addDisposable({ dispose() { order.push("third-child"); } });
    parent.addDisposable({ dispose() { order.push("parent-first"); } });
    parent.addDisposable({ dispose() { order.push("parent-second"); } });

    await firstChild.dispose();

    assert.deepEqual(order, ["first-child"]);
    assert.throws(() => firstChild.has("example"), /Services scope is disposed/);
    assert.strictEqual(parent.resolve("example"), singleton);
    assert.equal(sibling.has("missing"), false);

    await parent.dispose();

    assert.deepEqual(order, ["first-child", "third-child", "second-child", "parent-second", "parent-first"]);
    assert.throws(() => parent.has("example"), /Services scope is disposed/);
    assert.equal(sibling.has("missing"), false);
});

test("disposables are validated, deduplicated, and never inferred from resolved singletons", async () => {
    const root = createServices();
    let ownedDisposals = 0;
    let singletonDisposals = 0;
    const owned = { dispose() { ownedDisposals++; } };
    const singleton = { dispose() { singletonDisposals++; } };
    root.register("singleton", singleton);
    const scope = root.beginScope();

    assert.throws(() => scope.addDisposable({}), /must expose a callable dispose/);
    assert.strictEqual(scope.addDisposable(owned), owned);
    scope.addDisposable(owned);
    assert.strictEqual(scope.resolve("singleton"), singleton);

    await scope.dispose();

    assert.equal(ownedDisposals, 1);
    assert.equal(singletonDisposals, 0);
    assert.strictEqual(root.resolve("singleton"), singleton);
});

test("disposal continues after failures and aggregates multiple errors", async () => {
    const root = createServices();
    const scope = root.beginScope();
    const order = [];
    const firstFailure = new Error("first failure");
    const secondFailure = new Error("second failure");
    scope.addDisposable({ dispose() { order.push("first"); throw firstFailure; } });
    scope.addDisposable({ async dispose() { order.push("second"); throw secondFailure; } });
    scope.addDisposable({ dispose() { order.push("third"); } });

    await assert.rejects(scope.dispose(), error => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [secondFailure, firstFailure]);
        return true;
    });

    assert.deepEqual(order, ["third", "second", "first"]);
    assert.throws(() => scope.has("missing"), /Services scope is disposed/);
    assert.equal(root.has("missing"), false);
});

test("disposal is idempotent, concurrent, and immediately blocks descendant operations", async () => {
    const root = createServices();
    root.register("example", {});
    const parent = root.beginScope();
    const child = parent.beginScope();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let disposals = 0;
    parent.addDisposable({
        async dispose() {
            disposals++;
            await gate;
        }
    });

    const first = parent.dispose();
    const second = parent.dispose();

    assert.strictEqual(first, second);
    assert.throws(() => parent.beginScope(), /Services scope is disposing/);
    assert.throws(() => parent.resolve("example"), /Services scope is disposing/);
    assert.throws(() => parent.initialize("example"), /Services scope is disposing/);
    assert.throws(() => parent.addDisposable({ dispose() {} }), /Services scope is disposing/);
    assert.throws(() => child.resolve("example"), /Ancestor Services scope is disposing/);
    release();
    await first;
    assert.strictEqual(parent.dispose(), first);
    assert.equal(disposals, 1);
    assert.throws(() => child.beginScope(), /disposed/);
    assert.strictEqual(root.resolve("example"), root.resolve("example"));
});

test("disposing the root disposes scopes and root-owned resources but not singleton services", async () => {
    const root = createServices();
    const order = [];
    let singletonDisposals = 0;
    root.register("example", { dispose() { singletonDisposals++; } });
    root.addDisposable({ dispose() { order.push("root"); } });
    root.beginScope().addDisposable({ dispose() { order.push("child"); } });

    await root.dispose();

    assert.deepEqual(order, ["child", "root"]);
    assert.equal(singletonDisposals, 0);
    assert.throws(() => root.resolve("example"), /Services scope is disposed/);
});
