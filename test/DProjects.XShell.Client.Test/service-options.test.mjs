import assert from "node:assert/strict";
import test from "node:test";

import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import Commands from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/commands.js";
import Dialog from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/dialog.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Navigation from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/navigation.js";
import Preferences from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/preferences.js";
import Secrets from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/secrets.js";
import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";
import Temp from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/temp.js";
import Markdown from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/services/markdown-default.js";
import Theme from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/services/theme-default.js";
import Toast from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/services/toast-default.js";
import Principal from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-identity/services/principal.js";
import Session from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-identity/services/session.js";
import SignIn from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-identity/services/signin.js";
import XVault from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/services/xvault.js";

function createServices(implementation, options, name = "example") {
    const emitted = [];
    const bus = { emit(type, detail) { emitted.push({ type, detail }); } };
    const definition = { contract: name, implementation: `/services/${name}.js`, lifetime: "singleton" };
    if (options !== undefined) definition.options = options;
    const config = {
        app: { baseUrl: "https://example.test/" },
        modules: { test: { files: [{ path: definition.implementation, size: 1 }] } },
        xshell: { services: { [name]: definition }, files: [] }
    };
    const services = new Services({
        config,
        loader: { async load() { return implementation; } },
        contracts: {
            getContractItemById() {
                return { id: name, contract: { methods: {}, properties: {} } };
            }
        },
        resolver: { resolve() { return { definition: { moduleId: "test" } }; } },
        bus
    });
    return { bus, config, emitted, services };
}

const timeoutSchema = {
    type: "object",
    properties: { timeout: { type: "integer", minimum: 0 } },
    required: ["timeout"],
    additionalProperties: false
};

test("every repository-configured service implementation declares an optionsSchema object", () => {
    for (const implementation of [
        Areas, Commands, Dialog, JsonValidator, Navigation, Preferences, Secrets, Tasks, Temp,
        Markdown, Theme, Toast,
        Principal, Session, SignIn,
        XVault
    ]) {
        assert.equal(Object.hasOwn(implementation, "optionsSchema"), true, implementation.name);
        assert.equal(typeof implementation.optionsSchema, "object", implementation.name);
        assert.equal(Array.isArray(implementation.optionsSchema), false, implementation.name);
    }
});

test("valid service options are validated immediately before singleton construction", async () => {
    const order = [];
    const options = { timeout: 30 };
    const originalOptions = structuredClone(options);
    const originalSchema = structuredClone(timeoutSchema);
    class Example {
        static get optionsSchema() {
            order.push("schema");
            return timeoutSchema;
        }
        constructor(services, configuredOptions) {
            order.push("constructor");
            this.options = configuredOptions;
        }
    }
    const { emitted, services } = createServices(Example, options);

    await services.init();
    assert.deepEqual(order, []);
    const first = services.resolve("example");
    const second = services.resolve("example");

    assert.strictEqual(first, second);
    assert.strictEqual(first.options, options);
    assert.deepEqual(order, ["schema", "constructor"]);
    assert.deepEqual(options, originalOptions);
    assert.deepEqual(timeoutSchema, originalSchema);
    assert.deepEqual(emitted, [{ type: "xshell:service:created", detail: { id: "example" } }]);
});

test("a service without options receives a validated empty object", async () => {
    class Example {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor(services, options) { this.options = options; }
    }
    const { services } = createServices(Example);

    await services.init();

    assert.deepEqual(services.resolve("example").options, {});
});

test("missing or non-object optionsSchema declarations fail lazily", async () => {
    for (const [implementation, expected] of [
        [class Missing {}, /must define a static optionsSchema object/],
        [class InvalidObject { static optionsSchema = []; }, /invalid static optionsSchema.*expected a JSON Schema object/],
        [class ThrowingSchema { static get optionsSchema() { throw new Error("schema failed"); } }, /invalid static optionsSchema: schema failed/]
    ]) {
        const { services } = createServices(implementation);
        await services.init();
        assert.throws(() => services.resolve("example"), expected);
        assert.equal(services.getServiceInfo("example").state, "registered");
    }
});

test("invalid options do not invoke the constructor or emit a created event", async () => {
    let constructions = 0;
    class Example {
        static optionsSchema = timeoutSchema;
        constructor() { constructions++; }
    }

    for (const [options, expected] of [
        [{}, /required property "timeout"/],
        [{ timeout: "30" }, /#\/timeout.*type "string" is invalid/],
        [{ timeout: 30, unknown: true }, /additional properties schema/]
    ]) {
        const { emitted, services } = createServices(Example, options);
        await services.init();
        assert.throws(() => services.resolve("example"), expected);
        assert.equal(services.getServiceInfo("example").state, "registered");
        assert.deepEqual(emitted, []);
    }
    assert.equal(constructions, 0);
});

test("validated constructor injection preserves lazy dependency resolution", async () => {
    class Dependency {
        static optionsSchema = { type: "object", additionalProperties: false };
        value() { return 42; }
    }
    class Consumer {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor({ dependency }) { this.dependency = dependency; }
    }
    const definitions = {
        dependency: { contract: "dependency", implementation: "/services/dependency.js", lifetime: "singleton" },
        consumer: { contract: "consumer", implementation: "/services/consumer.js", lifetime: "singleton" }
    };
    const implementations = {
        "esm:/services/dependency.js": Dependency,
        "esm:/services/consumer.js": Consumer
    };
    const services = new Services({
        config: {
            app: { baseUrl: "https://example.test/" },
            modules: { test: { files: [] } },
            xshell: { services: definitions, files: [] }
        },
        loader: { async load(resource) { return implementations[resource]; } },
        contracts: { getContractItemById(id) { return { id, contract: { methods: {}, properties: {} } }; } },
        resolver: { resolve() { return { definition: { moduleId: "test" } }; } }
    });

    await services.init();
    const consumer = services.resolve("consumer");

    assert.equal(consumer.dependency.value(), 42);
    assert.strictEqual(services.resolve("consumer"), consumer);
    assert.equal(services.getServiceInfo("dependency").state, "created");
});

test("Navigation validates service options before lazy singleton construction", async () => {
    for (const mode of ["hash", "path"]) {
        const body = { querySelectorAll() { return []; } };
        const originalDocument = globalThis.document;
        globalThis.document = { body };
        try {
            const { bus, config, services } = createServices(Navigation, { mode }, "navigation");
            const areas = { getDefaultArea() { return null; } };
            const resolver = {};
            config.app.basePath = "";
            config.xshell.assets = { basePath: "/_assets" };
            services.register("areas", areas);
            services.register("bus", bus);
            services.register("config", config);
            services.register("resolver", resolver);

            await services.init();

            assert.equal(services.getServiceInfo("navigation").state, "registered");
            const first = services.resolve("navigation");
            assert.strictEqual(services.resolve("navigation"), first);
            assert.strictEqual(first._areas, areas);
            assert.strictEqual(first._bus, bus);
            assert.strictEqual(first._config, config);
            assert.strictEqual(first._resolver, resolver);
            assert.strictEqual(first._container, body);
            assert.equal(first.mode, mode);
        } finally {
            globalThis.document = originalDocument;
        }
    }
});

test("Areas validates options and injects config and bus before lazy singleton construction", async () => {
    const options = { default: "main", definitions: { main: { prefix: "/main", modules: ["test"] } } };
    const { bus, config, services } = createServices(Areas, options, "areas");
    bus.addEventListener = () => {};
    config.xshell.assets = { basePath: "/_assets" };
    services.register("bus", bus);
    services.register("config", config);

    await services.init();

    assert.equal(services.getServiceInfo("areas").state, "registered");
    const first = services.resolve("areas");
    assert.strictEqual(services.resolve("areas"), first);
    assert.strictEqual(first._bus, bus);
    assert.strictEqual(first._config, config);
    assert.equal(first.getDefaultArea().id, "main");
});

test("Areas rejects missing, invalid, and unknown service options without constructing", async () => {
    for (const [options, expected] of [
        [{ definitions: {} }, /required property "default"/],
        [{ default: "", definitions: {} }, /#\/default/],
        [{ default: null, definitions: {}, unknown: true }, /additional properties schema/],
        [{ default: null, definitions: { main: { unknown: true } } }, /additional properties schema/]
    ]) {
        const { config, services } = createServices(Areas, options, "areas");
        config.xshell.assets = { basePath: "/_assets" };
        services.register("bus", { addEventListener() {} });
        services.register("config", config);
        await services.init();
        assert.throws(() => services.resolve("areas"), expected);
        assert.equal(services.getServiceInfo("areas").state, "registered");
    }
});

test("Navigation receives the configured Areas singleton through service injection", async () => {
    const definitions = {
        areas: { contract: "areas", implementation: "/services/areas.js", lifetime: "singleton", options: { default: null, definitions: {} } },
        navigation: { contract: "navigation", implementation: "/services/navigation.js", lifetime: "singleton", options: { mode: "path" } }
    };
    const implementations = {
        "esm:/services/areas.js": Areas,
        "esm:/services/navigation.js": Navigation
    };
    const config = {
        app: { basePath: "", baseUrl: "https://example.test/" },
        modules: { test: { files: [] } },
        xshell: { assets: { basePath: "/_assets" }, services: definitions, files: [] }
    };
    const bus = { addEventListener() {}, emit() {} };
    const resolver = { resolve() { return { definition: { moduleId: "test" } }; } };
    const services = new Services({
        config,
        loader: { async load(resource) { return implementations[resource]; } },
        contracts: { getContractItemById(id) { return { id, contract: { methods: {}, properties: {} } }; } },
        resolver,
        bus
    });
    services.register("bus", bus);
    services.register("config", config);
    services.register("resolver", resolver);
    const originalDocument = globalThis.document;
    globalThis.document = { body: { querySelectorAll() { return []; } } };
    try {
        await services.init();
        const navigation = services.resolve("navigation");
        assert.strictEqual(navigation._areas, services.resolve("areas"));
    } finally {
        globalThis.document = originalDocument;
    }
});

test("Navigation rejects missing, invalid, and unknown service options without constructing", async () => {
    for (const [options, expected] of [
        [{}, /required property "mode"/],
        [{ mode: "query" }, /#\/mode.*does not match any/],
        [{ mode: "path", unknown: true }, /additional properties schema/]
    ]) {
        const { services } = createServices(Navigation, options, "navigation");
        await services.init();
        assert.throws(() => services.resolve("navigation"), expected);
        assert.equal(services.getServiceInfo("navigation").state, "registered");
    }
});
