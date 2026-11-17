import assert from "node:assert/strict";
import test from "node:test";

import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import Commands from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/commands.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
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

function createServices(implementation, options) {
    const emitted = [];
    const definition = { contract: "example", implementation: "/services/example.js" };
    if (options !== undefined) definition.options = options;
    const services = new Services({
        config: {
            app: { baseUrl: "https://example.test/" },
            modules: { test: { files: [{ path: definition.implementation, size: 1 }] } },
            xshell: { services: { example: definition }, files: [] }
        },
        loader: { async load() { return implementation; } },
        contracts: {
            getContractItemById() {
                return { id: "example", contract: { methods: {}, properties: {} } };
            }
        },
        areas: { getModuleId() { return "test"; } },
        bus: { emit(type, detail) { emitted.push({ type, detail }); } }
    });
    return { emitted, services };
}

const timeoutSchema = {
    type: "object",
    properties: { timeout: { type: "integer", minimum: 0 } },
    required: ["timeout"],
    additionalProperties: false
};

test("every repository-configured service implementation declares an optionsSchema object", () => {
    for (const implementation of [
        Commands, JsonValidator, Preferences, Secrets, Tasks, Temp,
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
        dependency: { contract: "dependency", implementation: "/services/dependency.js" },
        consumer: { contract: "consumer", implementation: "/services/consumer.js" }
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
        areas: { getModuleId() { return "test"; } }
    });

    await services.init();
    const consumer = services.resolve("consumer");

    assert.equal(consumer.dependency.value(), 42);
    assert.strictEqual(services.resolve("consumer"), consumer);
    assert.equal(services.getServiceInfo("dependency").state, "created");
});
