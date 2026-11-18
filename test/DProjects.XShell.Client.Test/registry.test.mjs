import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import Registry from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/registry.js";
import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/resolver.js";
import SchemaLoader from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/schema-json.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import ConfigSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/config.schema.json" with { type: "json" };

const modulePath = "/_assets/files/1.0.0.dev";
const otherPath = "/_assets/other/2.0.0.dev";
const frameworkPath = "/_assets/xshell/0.9.0.dev";

function createConfig(registry = {}) {
    return {
        app: { basePath: "", baseUrl: "https://example.test/" },
        modules: {
            files: { assets: { path: modulePath } },
            other: { assets: { path: otherPath } }
        },
        xshell: {
            assets: { path: frameworkPath },
            services: { registry: { contract: "registry", implementation: "/services/registry.js", options: registry } },
            resolver: { schema: {
                "files:/{path}": { src: `${modulePath}/{path}`, loader: "schema-json" },
                "other:/{path}": { src: `${otherPath}/{path}`, loader: "schema-json" },
                config: { src: `${frameworkPath}/schemas/config.schema.json`, loader: "schema-json" }
            } }
        }
    };
}

function createRegistry(config, schemas = {}) {
    const requested = [];
    const loader = { async load(resource) {
        requested.push(resource);
        if (!Object.hasOwn(schemas, resource)) throw new Error(`Missing resource ${resource}`);
        return schemas[resource];
    } };
    return { registry: new Registry({ config, loader, resolver: new Resolver({ config }) }, config.xshell.services.registry.options), requested };
}

const fileSchema = {
    $id: "https://example.test/file.schema.json",
    type: "object",
    required: ["id", "options"],
    properties: {
        id: { type: "string", minLength: 1 },
        options: { $ref: "#/$defs/options" }
    },
    $defs: { options: { type: "object", required: ["key"], properties: { key: { type: "string", minLength: 2 } } } }
};

test("empty registry leaves the public API available without loading schemas", async () => {
    const { registry, requested } = createRegistry(createConfig());
    await registry.init();
    assert.deepEqual(requested, []);
    assert.deepEqual(registry.registry, {});
    assert.equal(Object.isFrozen(registry.registry), true);
    assert.equal(registry.has("missing"), false);
    assert.equal(registry.get("missing"), undefined);
});

test("registry options schema preserves the former configuration constraints", () => {
    const validator = new JsonValidator();
    assert.equal(validator.validate({}, Registry.optionsSchema).valid, true);
    assert.equal(validator.validate({ files: { schema: "/schemas/file.schema.json", contributions: [{}] } }, Registry.optionsSchema).valid, true);
    for (const options of [
        { "": { schema: "/schemas/file.schema.json" } },
        { files: {} },
        { files: { schema: "" } },
        { files: { schema: "/schemas/file.schema.json", contributions: ["invalid"] } },
        { files: { schema: "/schemas/file.schema.json", unknown: true } }
    ]) assert.equal(validator.validate(options, Registry.optionsSchema).valid, false);
});

test("global configuration schema no longer owns Registry options", () => {
    assert.equal(ConfigSchema.$defs.xshell.required.includes("registry"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs.xshell.properties, "registry"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs, "xshellRegistry"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs, "xshellRegistryItem"), false);
});

test("registry is lazily constructed through Services with injected dependencies and service options", async () => {
    const options = { files: { schema: `${modulePath}/schemas/file.schema.json`, contributions: [] } };
    const config = createConfig(options);
    const requested = [];
    const resolver = new Resolver({ config });
    const loader = { async load(resource) {
        requested.push(resource);
        if (resource === "esm:/services/registry.js") return Registry;
        if (resource === "schema:files:/schemas/file.schema.json") return fileSchema;
        throw new Error(`Missing resource ${resource}`);
    } };
    const services = new Services({
        config,
        loader,
        contracts: { getContractItemById() { return { id: "registry", contract: { properties: { registry: {} }, methods: { init: {}, has: {}, get: {} } } }; } },
        resolver: { resolve(resource) {
            if (resource === "esm:/services/registry.js") return { definition: { moduleId: "xshell" } };
            return resolver.resolve(resource);
        } }
    });
    services.register("config", config);
    services.register("loader", loader);
    services.register("resolver", resolver);

    await services.init();
    assert.equal(services.getServiceInfo("registry").state, "registered");
    assert.deepEqual(requested, ["esm:/services/registry.js"]);

    const registry = services.resolve("registry");
    assert.strictEqual(registry.get("files"), options.files);
    assert.strictEqual(services.resolve("registry"), registry);
    assert.equal(services.getServiceInfo("registry").state, "created");

    await registry.init();
    assert.deepEqual(requested, ["esm:/services/registry.js", "schema:files:/schemas/file.schema.json"]);
});

test("invalid registry service options are rejected before construction", async () => {
    const config = createConfig({ files: { contributions: [] } });
    const services = new Services({
        config,
        loader: { async load() { return Registry; } },
        contracts: { getContractItemById() { return { id: "registry", contract: { properties: {}, methods: {} } }; } },
        resolver: { resolve() { return { definition: { moduleId: "xshell" } }; } }
    });
    services.register("config", config);
    services.register("loader", {});
    services.register("resolver", {});

    await services.init();
    assert.throws(() => services.resolve("registry"), /Invalid options for service 'registry'.*required property "schema"/);
    assert.equal(services.getServiceInfo("registry").state, "registered");
});

test("registry without contributions still loads its schema and preserves its view", async () => {
    const path = `${modulePath}/schemas/file.schema.json`;
    const item = { schema: path };
    const { registry, requested } = createRegistry(createConfig({ files: item }), { "schema:files:/schemas/file.schema.json": fileSchema });
    await registry.init();
    assert.deepEqual(requested, ["schema:files:/schemas/file.schema.json"]);
    assert.deepEqual(registry.registry.files, { schema: path, contributions: [] });
    assert.equal(Object.isFrozen(registry.registry.files), true);
    assert.equal(registry.has("files"), true);
    assert.equal(registry.get("files"), item);
});

test("empty contributions array is accepted", async () => {
    const path = `${modulePath}/schemas/file.schema.json`;
    const { registry } = createRegistry(createConfig({ files: { schema: path, contributions: [] } }), {
        "schema:files:/schemas/file.schema.json": fileSchema
    });
    await registry.init();
    assert.deepEqual(registry.registry.files.contributions, []);
});

test("valid contributions in different registries use their own module schemas", async () => {
    const files = { schema: `${modulePath}/schemas/file.schema.json`, contributions: [{ id: "encrypt", options: { key: "abc" } }] };
    const other = { schema: `${otherPath}/schemas/action.schema.json`, contributions: [{ count: 2 }] };
    const { registry, requested } = createRegistry(createConfig({ files, other }), {
        "schema:files:/schemas/file.schema.json": fileSchema,
        "schema:other:/schemas/action.schema.json": { type: "object", required: ["count"], properties: { count: { type: "integer", minimum: 1 } } }
    });
    await registry.init();
    assert.deepEqual(requested, ["schema:files:/schemas/file.schema.json", "schema:other:/schemas/action.schema.json"]);
});

test("nested constraint errors identify the registry, schema, index, and validation cause", async () => {
    const path = `${modulePath}/schemas/file.schema.json`;
    const { registry } = createRegistry(createConfig({ files: {
        schema: path,
        contributions: [{ id: "ok", options: { key: "valid" } }, { id: "bad", options: { key: "x" } }]
    } }), { "schema:files:/schemas/file.schema.json": fileSchema });
    await assert.rejects(registry.init(), error => {
        assert.match(error.message, /registry 'files'/);
        assert.match(error.message, /contribution 1/);
        assert.ok(error.message.includes(path));
        assert.ok(Array.isArray(error.cause));
        assert.ok(error.cause.some(item => item.keyword === "minLength"));
        return true;
    });
});

test("framework schema paths use an existing inventory resolver resource", async () => {
    const path = `${frameworkPath}/schemas/config.schema.json`;
    const { registry, requested } = createRegistry(createConfig({ framework: { schema: path, contributions: [{}] } }), {
        "schema:config": { type: "object" }
    });
    await registry.init();
    assert.deepEqual(requested, ["schema:config"]);
});

test("unknown, unnormalized, and prefix-collision paths fail before loading", async () => {
    const paths = ["/schemas/file.schema.json", `${modulePath}x/schemas/file.schema.json`,
        `${frameworkPath}/schemas/missing.schema.json`, `${modulePath}/schemas/../private.schema.json`];
    for (const path of paths) {
        const { registry, requested } = createRegistry(createConfig({ files: { schema: path } }));
        await assert.rejects(registry.init(), error => {
            assert.match(error.message, /registry 'files'/);
            assert.ok(error.message.includes(path));
            assert.ok(error.cause instanceof Error);
            return true;
        });
        assert.deepEqual(requested, []);
    }
});

test("schema loader errors keep the registry and schema context and original cause", async () => {
    const path = `${modulePath}/schemas/missing.schema.json`;
    const { registry } = createRegistry(createConfig({ files: { schema: path, contributions: [] } }));
    await assert.rejects(registry.init(), error => {
        assert.match(error.message, /registry 'files'/);
        assert.ok(error.message.includes(path));
        assert.match(error.cause.message, /Missing resource/);
        return true;
    });
});

test("schema loader bundles relative references for registry validation", async () => {
    const previousDocument = globalThis.document;
    const previousFetch = globalThis.fetch;
    globalThis.document = { baseURI: "https://example.test/" };
    globalThis.fetch = async url => ({ ok: true, json: async () => url.endsWith("root.schema.json")
        ? { $id: "https://example.test/root.schema.json", type: "object", properties: { options: { $ref: "options.schema.json" } } }
        : { $id: "https://example.test/options.schema.json", type: "object", required: ["key"] } });
    try {
        const schema = await new SchemaLoader().load("https://example.test/root.schema.json");
        const { registry } = createRegistry(createConfig({ files: {
            schema: `${modulePath}/schemas/root.schema.json`, contributions: [{ options: {} }]
        } }), { "schema:files:/schemas/root.schema.json": schema });
        await assert.rejects(registry.init(), error => {
            assert.ok(error.cause.some(item => item.keyword === "required"));
            return true;
        });
    } finally {
        globalThis.document = previousDocument;
        globalThis.fetch = previousFetch;
    }
});

test("registry initialization precedes module initialization", async () => {
    const source = await readFile(new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/xshell.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /import Registry from/);
    assert.doesNotMatch(source, /new Registry\s*\(/);
    assert.doesNotMatch(source, /register\("registry"/);
    assert.ok(source.indexOf('await this._services.initialize("registry")') < source.indexOf('const modules = await this._services.initialize("modules")'));
    assert.match(source, /get registry\(\) \{ return this\._services\?\.has\("registry"\) \? this\._services\.resolve\("registry"\) : null; \}/);
});

test("framework manifest registers Registry declaratively without the old top-level configuration", async () => {
    const source = await readFile(new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/manifest.jsonc", import.meta.url), "utf8");
    assert.match(source, /"registry"\s*:\s*\{\s*"contract"\s*:\s*"registry",\s*"implementation"\s*:\s*"\/services\/registry\.js",\s*"options"\s*:\s*\{\}/s);
    assert.equal((source.match(/"registry"\s*:/g) ?? []).length, 1);
});
