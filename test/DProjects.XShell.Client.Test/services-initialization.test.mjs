import assert from "node:assert/strict";
import test from "node:test";

import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";

function createServices() {
    return new Services({
        config: { app: { baseUrl: "https://example.test/" }, modules: {}, xshell: { services: {} } },
        loader: { async load() { throw new Error("Unexpected load."); } },
        contracts: { getContractItemById() { return undefined; } },
        resolver: { resolve() { return undefined; } },
        bus: { emit() {} }
    });
}

test("initialize awaits one shared asynchronous initialization and returns the resolved singleton", async () => {
    const services = createServices();
    let initCalls = 0;
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    const service = {
        async init() {
            initCalls++;
            await ready;
            this.ready = true;
        }
    };
    services.register("example", service);

    const first = services.initialize("example");
    const second = services.initialize("example");

    assert.strictEqual(first, second);
    assert.equal(initCalls, 0);
    assert.equal(services.getServiceInfo("example").state, "created");
    assert.equal(services.getServiceInfo("example").initializationState, "initializing");
    await Promise.resolve();
    assert.equal(initCalls, 1);
    release();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    assert.strictEqual(firstResult, service);
    assert.strictEqual(secondResult, service);
    assert.strictEqual(services.resolve("example"), service);
    assert.equal(service.ready, true);
    assert.equal(services.getServiceInfo("example").initializationState, "initialized");
    assert.strictEqual(await services.initialize("example"), service);
    assert.equal(initCalls, 1);
});

test("initialize supports synchronous init methods and binds this to the singleton", async () => {
    const services = createServices();
    const service = {
        init() {
            assert.strictEqual(this, service);
            this.ready = true;
        }
    };
    services.register("example", service);

    assert.strictEqual(await services.initialize("example"), service);
    assert.equal(service.ready, true);
    assert.equal(services.getServiceInfo("example").initializationState, "initialized");
});

test("resolve remains synchronous and does not initialize a lazily constructed service", () => {
    const services = createServices();
    let initCalls = 0;
    class ExampleService {
        static optionsSchema = { type: "object", additionalProperties: false };
        init() { initCalls++; }
    }
    services.register("example", null, {
        implementationItem: { class: ExampleService },
        contractItem: { contract: { methods: { init: {} } } }
    });

    const service = services.resolve("example");

    assert.ok(service instanceof ExampleService);
    assert.equal(service instanceof Promise, false);
    assert.equal(initCalls, 0);
    assert.equal(services.getServiceInfo("example").state, "created");
    assert.equal(services.getServiceInfo("example").initializationState, "not-initialized");
});

test("Services.init registers and freezes topology without initializing registered instances", async () => {
    const services = createServices();
    let initCalls = 0;
    const service = { init() { initCalls++; } };
    services.register("example", service);

    await services.init();

    assert.equal(initCalls, 0);
    assert.strictEqual(services.resolve("example"), service);
    assert.equal(services.getServiceInfo("example").initializationState, "not-initialized");
    assert.throws(() => services.register("late", {}), /Service registry is immutable after initialization/);
});

test("initialize retains a missing-init failure without retrying", async () => {
    const services = createServices();
    const service = {};
    services.register("example", service);

    const first = services.initialize("example");
    await assert.rejects(first, /Service 'example' does not implement init\(\)\./);
    const second = services.initialize("example");

    assert.strictEqual(second, first);
    await assert.rejects(second, /Service 'example' does not implement init\(\)\./);
    assert.strictEqual(services.resolve("example"), service);
    assert.equal(services.getServiceInfo("example").state, "created");
    assert.equal(services.getServiceInfo("example").initializationState, "failed");
});

test("initialize propagates and retains the original failure without automatic retry", async () => {
    const services = createServices();
    const failure = new Error("Initialization failed.");
    let initCalls = 0;
    const service = { init() { initCalls++; throw failure; } };
    services.register("example", service);

    const first = services.initialize("example");
    await assert.rejects(first, error => error === failure);
    const second = services.initialize("example");

    assert.strictEqual(second, first);
    await assert.rejects(second, error => error === failure);
    assert.equal(initCalls, 1);
    assert.strictEqual(services.resolve("example"), service);
    assert.equal(services.getServiceInfo("example").state, "created");
    assert.equal(services.getServiceInfo("example").initializationState, "failed");
});

test("initialize preserves construction contract validation and dependency cycle handling", () => {
    const invalidServices = createServices();
    class InvalidService {
        static optionsSchema = { type: "object", additionalProperties: false };
        init() {}
    }
    invalidServices.register("invalid", null, {
        implementationItem: { class: InvalidService },
        contractItem: { contract: { methods: { execute: {} } } }
    });

    assert.throws(() => invalidServices.initialize("invalid"), /does not implement required method 'execute'/);
    assert.equal(invalidServices.getServiceInfo("invalid").state, "registered");
    assert.equal(invalidServices.getServiceInfo("invalid").initializationState, "not-initialized");

    const cyclicServices = createServices();
    class FirstService {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ second }) { this.second = second; }
        init() {}
    }
    class SecondService {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ first }) { this.first = first; }
        init() {}
    }
    cyclicServices.register("first", null, { implementationItem: { class: FirstService } });
    cyclicServices.register("second", null, { implementationItem: { class: SecondService } });

    assert.throws(() => cyclicServices.initialize("first"), /Circular service dependency detected: first -> second -> first/);
    assert.equal(cyclicServices.getServiceInfo("first").state, "registered");
    assert.equal(cyclicServices.getServiceInfo("second").state, "registered");
});
