import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import ConfigSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/config.schema.json" with { type: "json" };
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import ModuleSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/module.schema.json" with { type: "json" };
import { Validator } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/vendor/json-schema/4.1.1/json-schema.js";
import LoaderSchemaJson from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/schema-json.js";
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Menus from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/menus.js";

const validator = new Validator(ConfigSchema, "2020-12");
validator.addSchema(ModuleSchema, ModuleSchema.$id);
validator.addSchema(ContractSchema, ContractSchema.$id);
const menusOptionsValidator = new Validator(Menus.optionsSchema, "2020-12");
const areasOptionsValidator = new Validator(Areas.optionsSchema, "2020-12");

const areaOptions = config => config.xshell.services.areas.options;

async function validateConfig(name, config) {
    // Validate service-owned Area options and construction.
    if (!areasOptionsValidator.validate(areaOptions(config)).valid) throw new Error("Invalid config");
    new Areas({ config, bus: { addEventListener() {} } }, areaOptions(config));

}

const moduleDefinition = () => ({
    label: "Test module",
    version: "1.0.0",
    copyright: "",
    icon: "",
    configUrl: "https://example.test/test/manifest.jsonc",
    assets: { path: "/_assets/test", url: "https://example.test/test/" },
    files: [{ path: "/_assets/test/pages/index.js", size: 123, hash: "test-hash" }],
    defaults: {
        page: { renderEngine: "x", stateEngine: "proxy" },
        component: { renderEngine: "x", stateEngine: "proxy" }
    }
});

function configuration(module) {
    return {
        app: {
            id: "test",
            label: "Test",
            version: "1.0.0",
            copyright: "",
            icon: "",
            basePath: "/",
            baseUrl: "https://example.test/",
            params: {}
        },
        modules: { test: module },
        xshell: {
            version: "1.0.0",
            assets: { basePath: "/_assets", path: "/_assets/xshell", url: "https://example.test/xshell/" },
            services: {
                areas: { contract: "areas", implementation: "/services/areas.js", lifetime: "singleton", options: { default: null, definitions: {} } },
                navigation: { contract: "navigation", implementation: "/services/navigation.js", lifetime: "singleton", options: { mode: "path" } }
            },
            resolver: {},
            ui: { layouts: {}, components: {} },
            configUrl: "https://example.test/xshell/manifest.json",
            serviceWorker: { mappings: [
                { src: "https://example.test/_assets/xshell", dst: "https://example.test/xshell/", version: "1.0.0", name: "xshell",
                    exceptions: ["https://example.test/xshell/manifest.json"] },
                { src: "https://example.test/_assets/test", dst: "https://example.test/test/", version: "1.0.0", name: "test",
                    exceptions: ["https://example.test/test/manifest.jsonc"] }
            ] },
            files: [{ path: "/_assets/xshell/xshell.js", size: 456, hash: "xshell-hash" }]
        }
    };
}

test("Menus options schema accepts nested and identified shortcut declarations and rejects invalid types", () => {
    const item = {id: "search", shortcut: "Ctrl+K"};
    const options = { definitions: {tools: {scope: "global", items: [{label: "Group", children: [item]}]}} };
    for (const shortcut of ["Ctrl+K", ["Ctrl+K"], ["Ctrl+K", "Meta+K"]]) {
        item.shortcut = shortcut;
        assert.equal(menusOptionsValidator.validate(options).valid, true);
    }
    for (const invalid of [null, 42, "", [], [""], ["Ctrl+K", false], [["Ctrl+K"]]]) {
        item.shortcut = invalid;
        assert.equal(menusOptionsValidator.validate(options).valid, false, JSON.stringify(invalid));
    }
});

test("Menus options schema accepts browser targets and rejects non-string values", () => {
    const item = {label: "Help", href: "/pages/help.js", target: "_blank"};
    const options = { definitions: {tools: {items: [item]}} };
    assert.equal(menusOptionsValidator.validate(options).valid, true);
    item.target = null;
    assert.equal(menusOptionsValidator.validate(options).valid, true);
    item.target = true;
    assert.equal(menusOptionsValidator.validate(options).valid, false);
});

function assertValid(module) {
    const result = validator.validate(configuration(module));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
}

test("effective schema rejects obsolete module-level routes", () => {
    const module = moduleDefinition();
    assertValid(module);
    assert.equal(validator.validate(configuration({ ...module, routes: { "/old": "/pages/index.js" } })).valid, false);
});

test("representative normal module authors stable classification tags", () => {
    const path = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/manifest.jsonc", import.meta.url);
    const source = readFileSync(path, "utf8");

    assert.match(source, /"tags"\s*:\s*\["filesystem",\s*"files",\s*"storage"\]/);
});

test("module and generated resource tags use ordered lowercase kebab-case identifiers", () => {
    const module = moduleDefinition();
    module.tags = ["business", "order-management"];
    module.files[0].resource = { type: "page", title: "Orders", tags: ["navigation", "order-management"] };
    assertValid(module);

    for (const tags of [[], ["ui"], ["file-management", "cloud-storage"]]) {
        module.tags = tags;
        module.files[0].resource.tags = tags;
        assertValid(module);
    }

    for (const tags of [["UI"], ["file management"], ["data", "data"], [""], ["data_analytics"], "data", [1]]) {
        module.tags = tags;
        assert.equal(validator.validate(configuration(module)).valid, false, JSON.stringify(tags));
        module.tags = ["business"];
        module.files[0].resource.tags = tags;
        assert.equal(validator.validate(configuration(module)).valid, false, JSON.stringify(tags));
    }
});

test("the runtime schema loader and validator enforce optional framework metadata", async t => {
    // Load the effective configuration schema with its runtime-bundled references.
    const base = "https://example.test/_assets/xshell/schemas/";
    const schemas = new Map([["config", ConfigSchema], ["module", ModuleSchema], ["contract", ContractSchema]]);
    t.mock.method(globalThis, "fetch", async url => {
        const schema = schemas.get(url.slice(base.length, -".schema.json".length));
        assert.ok(url.startsWith(base) && schema, url);
        return { ok: true, json: async () => structuredClone(schema) };
    });
    const previousDocument = globalThis.document;
    globalThis.document = { baseURI: base };
    t.after(() => {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });
    const schema = await new LoaderSchemaJson().load("config.schema.json");
    const runtimeValidator = new JsonValidator();
    const config = configuration(moduleDefinition());
    assert.equal(runtimeValidator.validate(config, schema).valid, true);

    // Validate the framework fields against the same conventions as module metadata.
    const metadata = { label: "XShell", description: "Core runtime.", tags: ["framework", "core-runtime"], icon: "x-xshell" };
    Object.assign(config.xshell, metadata);
    assert.equal(runtimeValidator.validate(config, schema).valid, true);
    for (const [key, value] of [["label", 42], ["description", null], ["icon", {}], ["tags", "runtime"],
        ["tags", ["Core Runtime"]], ["tags", ["runtime", "runtime"]]]) {
        config.xshell[key] = value;
        assert.equal(runtimeValidator.validate(config, schema).valid, false, `${key}: ${JSON.stringify(value)}`);
        config.xshell[key] = metadata[key];
    }
});

test("effective schema accepts optional UTC package build times for modules and XShell", () => {
    const config = configuration(moduleDefinition());
    assert.equal(validator.validate(config).valid, true);
    config.modules.test.builtAt = "2026-10-11T15:30:00Z";
    config.xshell.builtAt = "2026-10-11T15:31:00Z";
    assert.equal(validator.validate(config).valid, true);
    config.modules.test.builtAt = "2026-10-11T15:30:00+02:00";
    assert.equal(validator.validate(config).valid, false);
    config.modules.test.builtAt = "2026-10-11T15:30:00Z";
    config.xshell.builtAt = "invalid";
    assert.equal(validator.validate(config).valid, false);
});

test("effective schema rejects obsolete Temp configuration and accepts service options", () => {
    const config = configuration(moduleDefinition());
    config.xshell.temp = { url: "https://example.test/temp" };
    assert.equal(validator.validate(config).valid, false);

    delete config.xshell.temp;
    config.xshell.services = {
        temp: {
            contract: "temp",
            implementation: "/_assets/xshell/services/temp.js",
            lifetime: "singleton",
            options: { url: "https://example.test/temp" }
        }
    };
    assert.equal(validator.validate(config).valid, true, JSON.stringify(validator.validate(config).errors));
});

test("effective schema enforces the lexical module ID grammar", () => {
    for (const moduleId of ["x", "app", "orders", "x-demo", "orders-v2", "xshell-docs"]) {
        const config = configuration(moduleDefinition());
        config.modules = { [moduleId]: moduleDefinition() };
        assert.equal(validator.validate(config).valid, true, moduleId);
    }

    for (const moduleId of ["", "XDemo", "123", "x_demo", "x.demo", "x/demo", "x demo", "-x-demo", "x-demo-", "x--demo", "café", "foo%20bar"]) {
        const config = configuration(moduleDefinition());
        config.modules = { [moduleId]: moduleDefinition() };
        assert.equal(validator.validate(config).valid, false, moduleId);
    }
});

test("Area options reject obsolete module membership", () => {
    assert.equal(areasOptionsValidator.validate({ default: null, definitions: { admin: { modules: ["test"] } } }).valid, false);
});

test("effective config requires a defined Area when a default is configured", async () => {
    const config = configuration(moduleDefinition());
    areaOptions(config).default = "missing";
    await assert.rejects(validateConfig("test", config), /Default area 'missing' is not defined/);

    areaOptions(config).default = "";
    await assert.rejects(validateConfig("test", config), /Invalid config/);

    areaOptions(config).default = null;
    await assert.doesNotReject(validateConfig("test", config));

    areaOptions(config).definitions.main = { prefix: "/main" };
    areaOptions(config).default = "main";
    await assert.doesNotReject(validateConfig("test", config));
});

test("effective config rejects duplicate normalized Area prefixes", async () => {
    const config = configuration(moduleDefinition());
    areaOptions(config).definitions.first = { prefix: "demo" };
    for (const duplicate of ["demo", "/demo/", "///demo///"]) {
        areaOptions(config).definitions.second = { prefix: duplicate };
        await assert.rejects(validateConfig("test", config), /Areas 'first' and 'second' have duplicate normalized prefix '\/demo'/);
    }

    areaOptions(config).definitions.first.prefix = "";
    areaOptions(config).definitions.second.prefix = "/";
    await assert.rejects(validateConfig("test", config), /Areas 'first' and 'second' have duplicate normalized prefix ''/);

    areaOptions(config).definitions.second.prefix = "/other/";
    await assert.doesNotReject(validateConfig("test", config));
});

test("validated Area configuration constructs with normalized prefixes and an explicit default", async () => {
    const config = configuration(moduleDefinition());
    areaOptions(config).default = "second";
    areaOptions(config).definitions = {
        first: { prefix: "///demo///" },
        second: { prefix: "/other/" }
    };

    await validateConfig("test", config);
    const areas = new Areas({ config, bus: { addEventListener() {} } }, areaOptions(config));
    assert.equal(areas.getArea("first").prefix, "/demo");
    assert.equal(areas.getDefaultArea().id, "second");
});

test("Area construction validates route grammar", async () => {
    const config = configuration(moduleDefinition());
    const admin = areaOptions(config).definitions.admin = { routes: { "/repository/{123id}": "/_assets/test/pages/index.js" } };
    await assert.rejects(validateConfig("test", config), /Area 'admin' declares invalid route '\/repository\/\{123id\}'/);

    admin.routes = { "/repository/{repositoryId}/items": "/_assets/test/pages/index.js" };
    await assert.doesNotReject(validateConfig("test", config));
});

test("Menus validates named options and rejects obsolete module menu configuration", () => {
    const config = configuration(moduleDefinition());
    const definitions = {
        navigation: { label: "Navigation", description: "Find a Page.", icon: null,
            sources: [{ id: "inventory", source: "/_assets/test/pages" }], items: [{ id: "reports", children: [{ label: "Detail" }] }] },
        tools: { scope: "area", icon: "x-tools" },
        shortcuts: { scope: "global", items: [] },
        empty: {}
    };
    const options = { definitions };
    assert.equal(menusOptionsValidator.validate(options).valid, true);
    config.modules.test.menus = definitions;
    assert.equal(validator.validate(config).valid, false);

    for (const invalid of [[], "/pages", { items: "/pages" }, { children: [] }, { id: "empty" }, { name: "empty" },
        { description: null }, { icon: true }, { label: 1 }, { source: "/pages" }, { sources: ["runtime"] },
        { sources: [{ id: "missing-target" }] }, { scope: "local" }, { scope: null }, { global: true }]) {
        definitions.empty = invalid;
        assert.equal(menusOptionsValidator.validate(options).valid, false, JSON.stringify(invalid));
    }
});

test("Menus options reserve source path and default for inventory definitions", () => {
    const definition = {};
    const options = { definitions: { navigation: definition } };
    for (const valid of [
        { source: "registered" },
        { source: "/_assets/test/pages", path: "/customers/", default: false },
        { source: "/_assets/test/pages", path: "", default: true }
    ]) {
        definition.sources = [valid];
        assert.equal(menusOptionsValidator.validate(options).valid, true, JSON.stringify(valid));
    }
    for (const invalid of [
        { source: "registered", path: "customers" }, { source: "registered", default: false },
        { source: "/_assets/test/pages", path: null }, { source: "/_assets/test/pages", default: "true" },
        { source: "/_assets/test/pages", path: "/customers?sort=name" }, { source: "/_assets/test/pages", path: "https://example.test/" }
    ]) {
        definition.sources = [invalid];
        assert.equal(menusOptionsValidator.validate(options).valid, false, JSON.stringify(invalid));
    }
});

test("Menus options accept Page presentation fields and reject removed embedded spellings", () => {
    const items = [{ label: "Inline report", href: "/pages/report.js", open: "embed", outlet: "self" }];
    const options = { definitions: { navigation: { items } } };
    assert.equal(menusOptionsValidator.validate(options).valid, true);
    for (const property of ["embedded", "embeded"]) {
        items[0] = { label: "Inline report", href: "/pages/report.js", [property]: true };
        assert.equal(menusOptionsValidator.validate(options).valid, false);
    }
    for (const open of ["auto", "top", "stack", "dialog", "dock", "embed", null]) {
        items[0] = { label: "Report", open, outlet: open === "embed" ? "content" : null };
        assert.equal(menusOptionsValidator.validate(options).valid, true);
    }
});

test("effective schema requires app baseUrl", () => {
    const config = configuration(moduleDefinition());
    delete config.app.baseUrl;
    assert.equal(validator.validate(config).valid, false);

    config.app.baseUrl = "https://example.test/";
    assert.equal(validator.validate(config).valid, true, JSON.stringify(validator.validate(config).errors));
});

test("effective schema rejects module contracts", () => {
    const module = moduleDefinition();
    assertValid(module);
    module.contract = { events: { ready: { description: "Module is ready" } } };

    const result = validator.validate(configuration(module));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.error.includes('Property "contract"')));
});

test("effective schema rejects the removed xshell.identity configuration", () => {
    const config = configuration(moduleDefinition());
    config.xshell.identity = { provider: "anonymous" };
    assert.equal(validator.validate(config).valid, false);
});

test("effective schema requires normalized assets.basePath and rejects obsolete flat fields", () => {
    const config = configuration(moduleDefinition());
    delete config.xshell.assets.basePath;
    assert.equal(validator.validate(config).valid, false);
    config.xshell.assets.basePath = "app:/_assets";
    assert.equal(validator.validate(config).valid, false);
    config.xshell.assets.basePath = "/_assets";
    config.xshell.assetsPrefix = "_assets";
    assert.equal(validator.validate(config).valid, false);
});

test("module schema accepts unique non-empty service requirements", () => {
    const module = moduleDefinition();
    module.requires = ["toast", "identity"];

    assertValid(module);
});

test("module schema rejects duplicate or empty service requirements", () => {
    for (const requires of [["toast", "toast"], [""]]) {
        const module = moduleDefinition();
        module.requires = requires;

        assert.equal(validator.validate(configuration(module)).valid, false);
    }
});

test("Area options accept route maps and require non-empty string targets", () => {
    const options = { default: null, definitions: { main: { routes: {
        "/something": "/_assets/test/pages/index.js",
        "/repository/{repositoryId}/items": "/_assets/test/pages/items.js"
    } } } };
    assert.equal(areasOptionsValidator.validate(options).valid, true);
    for (const value of [123, null, "", { target: "/pages/index.js" }, ["/pages/index.js"]]) {
        options.definitions.main.routes["/something"] = value;
        assert.equal(areasOptionsValidator.validate(options).valid, false);
    }
    for (const value of [null, [], "/pages/index.js"]) {
        options.definitions.main.routes = value;
        assert.equal(areasOptionsValidator.validate(options).valid, false);
    }
});

test("effective schema requires module files", () => {
    const module = moduleDefinition();
    delete module.files;

    assert.equal(validator.validate(configuration(module)).valid, false);
});

test("effective schema requires XShell files", () => {
    const config = configuration(moduleDefinition());
    delete config.xshell.files;

    assert.equal(validator.validate(config).valid, false);
});

test("effective schema requires generated serviceWorker mappings and validates their retained metadata", () => {
    const config = configuration(moduleDefinition());
    delete config.xshell.serviceWorker;
    assert.equal(validator.validate(config).valid, false);

    config.xshell.serviceWorker = { mappings: [{}] };
    assert.equal(validator.validate(config).valid, false);

    config.xshell.serviceWorker = configuration(moduleDefinition()).xshell.serviceWorker;
    config.xshell.serviceWorker.mappings[0].exceptions = [123];
    assert.equal(validator.validate(config).valid, false);

    config.xshell.serviceWorker = configuration(moduleDefinition()).xshell.serviceWorker;
    config.xshell.serviceWorker.mappings[0].unexpected = true;
    assert.equal(validator.validate(config).valid, false);

    config.xshell.serviceWorker = configuration(moduleDefinition()).xshell.serviceWorker;
    assert.equal(validator.validate(config).valid, true, JSON.stringify(validator.validate(config).errors));
});

test("effective schema requires complete nested module and XShell assets objects", () => {
    const module = moduleDefinition();
    delete module.assets.path;
    assert.equal(validator.validate(configuration(module)).valid, false);
    module.assets.path = "/_assets/test";
    delete module.assets.url;
    assert.equal(validator.validate(configuration(module)).valid, false);

    const config = configuration(moduleDefinition());
    delete config.xshell.assets.path;
    assert.equal(validator.validate(config).valid, false);
    config.xshell.assets.path = "/_assets/xshell";
    delete config.xshell.assets.url;
    assert.equal(validator.validate(config).valid, false);
});

test("effective schema rejects obsolete flat asset fields", () => {
    for (const field of ["assetsPath", "assetsUrl"]) {
        const config = configuration(moduleDefinition());
        config.modules.test[field] = field === "assetsPath" ? "/_assets/test" : "https://example.test/test/";
        assert.equal(validator.validate(config).valid, false);
    }
    for (const field of ["assetsBasePath", "assetsPath", "assetsUrl"]) {
        const config = configuration(moduleDefinition());
        config.xshell[field] = field === "assetsUrl" ? "https://example.test/xshell/" : "/_assets";
        assert.equal(validator.validate(config).valid, false);
    }
});

test("effective schema accepts optional published package hashes but rejects empty values", () => {
    const config = configuration(moduleDefinition());
    assert.equal(validator.validate(config).valid, true);
    config.modules.test.hash = "a82c31f943e01abc";
    config.xshell.hash = "31d04ab8e220a581";
    assert.equal(validator.validate(config).valid, true);
    config.modules.test.hash = "";
    assert.equal(validator.validate(config).valid, false);
    config.modules.test.hash = "a82c31f943e01abc";
    config.xshell.hash = "";
    assert.equal(validator.validate(config).valid, false);
});

test("effective schema validates inventory path, size, and hash", () => {
    for (const file of [
        { size: 1, hash: "hash" },
        { path: "", size: 1, hash: "hash" },
        { path: "/_assets/test/file.js", size: -1, hash: "hash" },
        { path: "/_assets/test/file.js", size: 1.5, hash: "hash" },
        { path: "/_assets/test/file.js", size: 1, hash: "" }
    ]) {
        const module = moduleDefinition();
        module.files = [file];

        assert.equal(validator.validate(configuration(module)).valid, false);
    }
});

test("effective schema accepts typed optional resource metadata", () => {
    const module = moduleDefinition();
    module.files[0].resource = { type: "page", title: "Home", description: "Start here.", icon: "x-home" };
    const config = configuration(module);
    config.xshell.files[0].resource = { type: "schema", id: "https://example.test/schema", title: "Schema" };

    const result = validator.validate(config);

    assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("effective schema rejects invalid resource metadata", () => {
    for (const resource of [
        { title: "Missing type" },
        { type: "dataset", title: "Unsupported" },
        { type: "page", title: 123 },
        { type: "page", title: "Page", unexpected: true }
    ]) {
        const module = moduleDefinition();
        module.files[0].resource = resource;

        assert.equal(validator.validate(configuration(module)).valid, false);
    }
});

test("effective schema accepts named service contract and implementation objects", () => {
    const config = configuration(moduleDefinition());
    config.xshell.services = {
        toast: {
            contract: "toast",
            implementation: "/_assets/x/services/toast-default.js",
            lifetime: "singleton"
        }
    };

    const result = validator.validate(config);

    assert.equal(result.valid, true, JSON.stringify(result.errors));
});
