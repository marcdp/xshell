import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import ConfigSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/config.schema.json" with { type: "json" };
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import { Validator } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/vendor/json-schema/4.1.1/json-schema.js";

function createServices(bus = { emit() {} }) {
    return new Services({
        config: { app: { baseUrl: "https://example.test/" }, modules: {}, xshell: { services: {} } },
        loader: { async load() { throw new Error("Unexpected load."); } },
        contracts: { getContractItemById() { return undefined; } },
        resolver: { resolve() { return undefined; } },
        bus
    });
}

function createConfiguredServices(definitions, implementations) {
    const config = {
        app: { baseUrl: "https://example.test/" },
        modules: { test: { files: [] } },
        xshell: { services: definitions }
    };
    return new Services({
        config,
        loader: { async load(resource) { return implementations[resource]; } },
        contracts: { getContractItemById(id) { return { id, contract: { methods: {}, properties: {} } }; } },
        resolver: { resolve() { return { definition: { moduleId: "test" } }; } },
        bus: { emit() {} }
    });
}

function registerImplementation(services, name, implementation, lifetime = "singleton", contractItem) {
    services.register(name, null, { lifetime, implementationItem: { class: implementation }, contractItem });
}

test("repository-authored complete service definitions declare explicit lifetimes", () => {
    const manifests = ["xshell", "x", "x-filesystem", "x-vault", "xshell-docs", "xshell-diagnostics", "x-demo"];
    for (const moduleId of manifests) {
        const source = readFileSync(new URL(`../../src/DProjects.XShell/Resources/DProjects.XShell/${moduleId}/manifest.jsonc`, import.meta.url), "utf8");
        const manifest = JSON.parse(source.replace(/^\s*\/\/[^\r\n]*/gm, ""));
        for (const [name, definition] of Object.entries(manifest.xshell?.services ?? {})) {
            if (!Object.hasOwn(definition, "contract") && !Object.hasOwn(definition, "implementation")) continue;
            assert.equal(typeof definition.contract, "string", `${moduleId}:${name} contract`);
            assert.equal(typeof definition.implementation, "string", `${moduleId}:${name} implementation`);
            assert.ok(["singleton", "scoped", "transient"].includes(definition.lifetime), `${moduleId}:${name} lifetime`);
        }
    }
});

test("service configuration requires one supported explicit lifetime", async () => {
    const validator = new Validator(ConfigSchema.$defs.xshellService, "2020-12");
    const base = { contract: "example", implementation: "/services/example.js" };

    assert.equal(validator.validate(base).valid, false);
    for (const lifetime of ["singleton", "scoped", "transient"]) {
        assert.equal(validator.validate({ ...base, lifetime }).valid, true, lifetime);
    }

    // Validate the effective merged definition rather than an options-only contribution in isolation.
    assert.equal(validator.validate({...base, ...{lifetime: "scoped"}}).valid, true);
    assert.equal(validator.validate({...base, ...{options: {value: 42}}}).valid, false);
    for (const lifetime of ["application", "scope", "", null, 1]) {
        assert.equal(validator.validate({ ...base, lifetime }).valid, false, String(lifetime));
    }

    class Example {
        static optionsSchema = { type: "object", properties: { value: { type: "integer" } }, additionalProperties: false };
        constructor(services, options) { this.options = options; }
    }
    const definitions = {
        singleton: { contract: "singleton", implementation: "/services/singleton.js", lifetime: "singleton" },
        scoped: { contract: "scoped", implementation: "/services/scoped.js", lifetime: "scoped", options: { value: 42 } },
        transient: { contract: "transient", implementation: "/services/transient.js", lifetime: "transient" }
    };
    const implementations = Object.fromEntries(Object.values(definitions).map(definition => [`esm:${definition.implementation}`, Example]));
    const services = createConfiguredServices(definitions, implementations);
    await services.init();

    assert.equal(services.getServiceInfo("singleton").lifetime, "singleton");
    assert.equal(services.getServiceInfo("scoped").lifetime, "scoped");
    assert.equal(services.getServiceInfo("transient").lifetime, "transient");
    assert.deepEqual(services.beginScope().resolve("scoped").options, { value: 42 });
});

test("configured services fail runtime registration when lifetime is missing or invalid", async () => {
    class Example { static optionsSchema = {type: "object", additionalProperties: false}; }
    for (const [lifetime, message] of [[undefined, /must declare a lifetime/], ["application", /Invalid lifetime 'application'/]]) {
        const definition = {contract: "example", implementation: "/services/example.js"};
        if (lifetime !== undefined) definition.lifetime = lifetime;
        const services = createConfiguredServices({example: definition}, {"esm:/services/example.js": Example});
        await assert.rejects(services.init(), message);
    }
});

test("direct registrations remain singleton and reject incompatible preconstructed lifetimes", () => {
    const services = createServices();
    const instance = {};
    services.register("core", instance);

    assert.strictEqual(services.beginScope().resolve("core"), instance);
    assert.equal(services.getServiceInfo("core").lifetime, "singleton");
    assert.throws(() => services.register("invalidScoped", {}, { lifetime: "scoped" }), /must use the singleton lifetime/);
    assert.throws(() => services.register("invalidTransient", {}, { lifetime: "transient" }), /must use the singleton lifetime/);
    assert.throws(() => services.register("invalid", null, { lifetime: "application" }), /Invalid lifetime 'application'/);
});

test("singletons construct once in root context and remain shared across scopes", async () => {
    const services = createServices();
    let dependencyConstructions = 0;
    let consumerConstructions = 0;
    let singletonDisposals = 0;
    class Dependency {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor() { dependencyConstructions++; }
    }
    class Consumer {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ dependency }) { consumerConstructions++; this.dependency = dependency; }
        dispose() { singletonDisposals++; }
    }
    registerImplementation(services, "dependency", Dependency);
    registerImplementation(services, "consumer", Consumer);
    const first = services.beginScope();
    const second = services.beginScope();

    const instance = first.resolve("consumer");

    assert.strictEqual(second.resolve("consumer"), instance);
    assert.strictEqual(services.resolve("consumer"), instance);
    assert.strictEqual(instance.dependency, services.resolve("dependency"));
    assert.equal(dependencyConstructions, 1);
    assert.equal(consumerConstructions, 1);
    await first.dispose();
    assert.equal(singletonDisposals, 0);
});

test("scoped services are cached independently in each explicit child scope", () => {
    const services = createServices();
    let constructions = 0;
    class Scoped {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor() { this.id = ++constructions; }
    }
    registerImplementation(services, "scoped", Scoped, "scoped");
    const first = services.beginScope();
    const second = services.beginScope();
    const nested = first.beginScope();

    const firstInstance = first.resolve("scoped");

    assert.strictEqual(first.resolve("scoped"), firstInstance);
    assert.notStrictEqual(second.resolve("scoped"), firstInstance);
    assert.notStrictEqual(nested.resolve("scoped"), firstInstance);
    assert.equal(constructions, 3);
    assert.throws(() => services.resolve("scoped"), /requires an explicit child Services scope/);
    assert.equal(services.getServiceInfo("scoped").state, "registered");
    assert.equal(services.getServiceInfo("scoped").initializationState, "not-initialized");
});

test("scoped dependencies resolve in the same owning scope", () => {
    const services = createServices();
    class Dependency { static optionsSchema = { type: "object", additionalProperties: false }; }
    class Consumer {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ dependency }) { this.dependency = dependency; }
    }
    registerImplementation(services, "dependency", Dependency, "scoped");
    registerImplementation(services, "consumer", Consumer, "scoped");
    const first = services.beginScope();
    const second = services.beginScope();

    assert.strictEqual(first.resolve("consumer").dependency, first.resolve("dependency"));
    assert.strictEqual(second.resolve("consumer").dependency, second.resolve("dependency"));
    assert.notStrictEqual(first.resolve("dependency"), second.resolve("dependency"));
});

test("transients construct on every resolution and inherit the resolving scope", async () => {
    const services = createServices();
    let transientConstructions = 0;
    let transientDisposals = 0;
    class Singleton { static optionsSchema = { type: "object", additionalProperties: false }; }
    class Scoped { static optionsSchema = { type: "object", additionalProperties: false }; }
    class Transient {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ singleton, scoped }) { transientConstructions++; this.singleton = singleton; this.scoped = scoped; }
        dispose() { transientDisposals++; }
    }
    registerImplementation(services, "singleton", Singleton);
    registerImplementation(services, "scoped", Scoped, "scoped");
    registerImplementation(services, "transient", Transient, "transient");
    const scope = services.beginScope();

    const first = scope.resolve("transient");
    const second = scope.resolve("transient");

    assert.notStrictEqual(first, second);
    assert.strictEqual(first.singleton, services.resolve("singleton"));
    assert.strictEqual(first.scoped, scope.resolve("scoped"));
    assert.strictEqual(second.scoped, first.scoped);
    assert.equal(transientConstructions, 2);
    assert.throws(() => services.resolve("transient"), /Scoped service 'scoped' requires an explicit child Services scope.*transient -> scoped/);
    assert.throws(() => scope.initialize("transient"), /cannot be initialized by name/);
    assert.equal(transientConstructions, 2);

    await scope.dispose();
    assert.equal(transientDisposals, 2);
});

test("non-disposable transients are not retained by scope ownership", async () => {
    const services = createServices();
    class Transient { static optionsSchema = { type: "object", additionalProperties: false }; }
    registerImplementation(services, "transient", Transient, "transient");
    const scope = services.beginScope();

    scope.resolve("transient");
    scope.resolve("transient");

    assert.equal(scope._disposables.length, 0);
    await scope.dispose();
});

test("root-owned disposable transients are released only by explicit root disposal", async () => {
    const services = createServices();
    let disposals = 0;
    class Transient {
        static optionsSchema = { type: "object", additionalProperties: false };
        dispose() { disposals++; }
    }
    registerImplementation(services, "transient", Transient, "transient");

    const first = services.resolve("transient");
    const second = services.resolve("transient");

    assert.notStrictEqual(first, second);
    assert.equal(disposals, 0);
    await services.dispose();
    assert.equal(disposals, 2);
});

test("captive scoped dependencies are rejected through direct and transient singleton graphs", () => {
    const services = createServices();
    class Scoped { static optionsSchema = { type: "object", additionalProperties: false }; }
    class DirectSingleton {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ scoped }) { this.scoped = scoped; }
    }
    class Transient {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ scoped }) { this.scoped = scoped; }
    }
    class IndirectSingleton {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ transient }) { this.transient = transient; }
    }
    registerImplementation(services, "scoped", Scoped, "scoped");
    registerImplementation(services, "directSingleton", DirectSingleton);
    registerImplementation(services, "transient", Transient, "transient");
    registerImplementation(services, "indirectSingleton", IndirectSingleton);
    const scope = services.beginScope();

    assert.throws(
        () => scope.resolve("directSingleton"),
        /singleton service 'directSingleton' cannot depend on scoped service 'scoped'.*directSingleton -> scoped/
    );
    assert.throws(
        () => scope.resolve("indirectSingleton"),
        /singleton service 'indirectSingleton' cannot depend on scoped service 'scoped'.*indirectSingleton -> transient -> scoped/
    );
    assert.equal(services.getServiceInfo("directSingleton").state, "registered");
    assert.equal(services.getServiceInfo("indirectSingleton").state, "registered");
});

test("allowed lifetime dependency combinations resolve successfully", () => {
    const services = createServices();
    class Singleton { static optionsSchema = { type: "object", additionalProperties: false }; }
    class Transient { static optionsSchema = { type: "object", additionalProperties: false }; }
    class SingletonConsumer {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ transient }) { this.transient = transient; }
    }
    class ScopedConsumer {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ singleton, transient }) { this.singleton = singleton; this.transient = transient; }
    }
    registerImplementation(services, "singleton", Singleton);
    registerImplementation(services, "transient", Transient, "transient");
    registerImplementation(services, "singletonConsumer", SingletonConsumer);
    registerImplementation(services, "scopedConsumer", ScopedConsumer, "scoped");
    const scope = services.beginScope();

    const singletonConsumer = scope.resolve("singletonConsumer");
    const scopedConsumer = scope.resolve("scopedConsumer");

    assert.ok(singletonConsumer.transient instanceof Transient);
    assert.strictEqual(scopedConsumer.singleton, services.resolve("singleton"));
    assert.ok(scopedConsumer.transient instanceof Transient);
});

test("circular dependencies are detected across every lifetime combination without corrupting caches", () => {
    for (const [firstLifetime, secondLifetime] of [
        ["singleton", "singleton"],
        ["scoped", "scoped"],
        ["transient", "transient"],
        ["scoped", "transient"],
        ["transient", "singleton"]
    ]) {
        const services = createServices();
        class First {
            static optionsSchema = { type: "object", additionalProperties: false };
            constructor({ second }) { this.second = second; }
        }
        class Second {
            static optionsSchema = { type: "object", additionalProperties: false };
            constructor({ first }) { this.first = first; }
        }
        registerImplementation(services, "first", First, firstLifetime);
        registerImplementation(services, "second", Second, secondLifetime);
        const scope = services.beginScope();
        const owner = firstLifetime === "scoped" || secondLifetime === "scoped" ? scope : services;

        assert.throws(() => owner.resolve("first"), /Circular service dependency detected: first -> second -> first/);
        assert.equal(services.getServiceInfo("first").state, "registered");
        assert.equal(services.getServiceInfo("second").state, "registered");
        assert.equal(scope._scopedInstances.get("first")?.instance ?? null, null);
        assert.equal(scope._scopedInstances.get("second")?.instance ?? null, null);
    }
});

test("failed scoped construction and validation leave retryable scope-local caches", () => {
    const services = createServices();
    let attempts = 0;
    class Retryable {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor() {
            attempts++;
            if (attempts === 1) throw new Error("Try again.");
        }
        execute() {}
    }
    registerImplementation(services, "retryable", Retryable, "scoped", { contract: { methods: { execute: {} } } });
    const scope = services.beginScope();

    assert.throws(() => scope.resolve("retryable"), /Try again/);
    const instance = scope.resolve("retryable");

    assert.ok(instance instanceof Retryable);
    assert.strictEqual(scope.resolve("retryable"), instance);
    assert.equal(attempts, 2);
});

test("scoped initialization is concurrent, once-only, and independent per scope", async () => {
    const services = createServices();
    let constructions = 0;
    const releases = [];
    class Scoped {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor() { this.id = ++constructions; this.initCalls = 0; }
        async init() {
            this.initCalls++;
            await new Promise(resolve => releases.push(resolve));
        }
    }
    registerImplementation(services, "scoped", Scoped, "scoped");
    const first = services.beginScope();
    const second = services.beginScope();

    const firstInitialization = first.initialize("scoped");
    const duplicateInitialization = first.initialize("scoped");
    const secondInitialization = second.initialize("scoped");

    assert.strictEqual(firstInitialization, duplicateInitialization);
    await Promise.resolve();
    assert.equal(releases.length, 2);
    releases.splice(0).forEach(release => release());
    const [firstInstance, duplicateInstance, secondInstance] = await Promise.all([
        firstInitialization, duplicateInitialization, secondInitialization
    ]);
    assert.strictEqual(firstInstance, duplicateInstance);
    assert.notStrictEqual(firstInstance, secondInstance);
    assert.equal(firstInstance.initCalls, 1);
    assert.equal(secondInstance.initCalls, 1);
});

test("scoped initialization failures are retained independently per scope", async () => {
    const services = createServices();
    let initCalls = 0;
    class Scoped {
        static optionsSchema = { type: "object", additionalProperties: false };
        init() { initCalls++; throw new Error(`failure-${initCalls}`); }
    }
    registerImplementation(services, "scoped", Scoped, "scoped");
    const first = services.beginScope();
    const second = services.beginScope();

    const firstFailure = first.initialize("scoped");
    await assert.rejects(firstFailure, /failure-1/);
    assert.strictEqual(first.initialize("scoped"), firstFailure);
    const secondFailure = second.initialize("scoped");
    await assert.rejects(secondFailure, /failure-2/);
    assert.equal(initCalls, 2);
});

test("scope disposal waits for scoped initialization and follows reverse dependency ownership", async () => {
    const services = createServices();
    const order = [];
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    class Dependency {
        static optionsSchema = { type: "object", additionalProperties: false };
        dispose() { order.push("dependency"); }
    }
    class Consumer {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ dependency }) { this.dependency = dependency; }
        async init() { order.push("init-start"); await ready; order.push("init-end"); }
        dispose() { order.push("consumer"); }
    }
    registerImplementation(services, "dependency", Dependency, "scoped");
    registerImplementation(services, "consumer", Consumer, "scoped");
    const scope = services.beginScope();
    const initialization = scope.initialize("consumer");
    await Promise.resolve();

    const disposal = scope.dispose();
    await Promise.resolve();
    assert.deepEqual(order, ["init-start"]);
    release();
    await initialization;
    await disposal;

    assert.deepEqual(order, ["init-start", "init-end", "consumer", "dependency"]);
    assert.equal(scope._scopedInstances.size, 0);
    assert.throws(() => scope.resolve("consumer"), /disposed/);
});

test("hierarchical disposal owns child and parent lifetime instances independently and continues after failure", async () => {
    const services = createServices();
    const order = [];
    class Scoped {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor() { this.owner = ""; }
        dispose() { order.push(this.owner); if (this.owner === "child") throw new Error("child cleanup failed"); }
    }
    registerImplementation(services, "scoped", Scoped, "scoped");
    const parent = services.beginScope();
    const child = parent.beginScope();
    parent.resolve("scoped").owner = "parent";
    child.resolve("scoped").owner = "child";
    parent.addDisposable({ dispose() { order.push("parent-resource"); } });

    await assert.rejects(parent.dispose(), /child cleanup failed/);

    assert.deepEqual(order, ["child", "parent-resource", "parent"]);
    assert.equal(services.getServiceInfo("scoped").state, "registered");
});
