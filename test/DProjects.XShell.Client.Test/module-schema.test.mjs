import assert from "node:assert/strict";
import test from "node:test";

import ConfigSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/config.schema.json" with { type: "json" };
import ModuleSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/module.schema.json" with { type: "json" };
import { Validator } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/vendor/json-schema/4.1.1/json-schema.js";
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import { compileRoute } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/utils/route.js";

const validator = new Validator(ConfigSchema, "2020-12");
validator.addSchema(ModuleSchema, ModuleSchema.$id);
const areasOptionsValidator = new Validator(Areas.optionsSchema, "2020-12");

const areaOptions = config => config.xshell.services.areas.options;

async function validateConfig(name, config) {
    // validate service-owned Area options and their semantic relationship to effective modules
    if (!areasOptionsValidator.validate(areaOptions(config)).valid) throw new Error("Invalid config");
    new Areas({ config, bus: { addEventListener() {} } }, areaOptions(config));

    // preserve route validation as an unrelated XShell responsibility
    for (const [moduleId, module] of Object.entries(config.modules)) {
        for (const path of Object.keys(module.routes || {})) {
            try {
                compileRoute(path);
            } catch (cause) {
                throw new Error(`Module '${moduleId}' declares invalid route '${path}'.`, { cause });
            }
        }
    }
}

const moduleDefinition = routes => ({
    label: "Test module",
    version: "1.0.0",
    copyright: "",
    icon: "",
    configUrl: "https://example.test/test/manifest.jsonc",
    assets: { path: "/_assets/test", url: "https://example.test/test/" },
    files: [{ path: "/_assets/test/pages/index.js", size: 123, hash: "test-hash" }],
    ...(routes === undefined ? {} : { routes }),
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
                areas: { contract: "areas", implementation: "/services/areas.js", options: { default: null, global: [], definitions: {} } },
                navigation: { contract: "navigation", implementation: "/services/navigation.js", options: { mode: "path" } }
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

function assertValid(module) {
    const result = validator.validate(configuration(module));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
}

test("module schema keeps routes optional", () => {
    assertValid(moduleDefinition());
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

test("effective config rejects unknown Area modules and accepts canonical ids", async () => {
    const config = configuration(moduleDefinition());
    areaOptions(config).definitions.admin = { modules: ["missing"] };
    await assert.rejects(validateConfig("test", config), /Area 'admin' references unknown module 'missing'/);

    areaOptions(config).definitions.admin.modules = ["test"];
    await assert.doesNotReject(validateConfig("test", config));
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

test("effective config validates route grammar before runtime construction", async () => {
    const config = configuration(moduleDefinition({ "/repository/{123id}": "/_assets/test/pages/index.js" }));
    await assert.rejects(validateConfig("test", config), /Module 'test' declares invalid route '\/repository\/\{123id\}'/);

    config.modules.test.routes = { "/repository/{repositoryId}/items": "/_assets/test/pages/index.js" };
    await assert.doesNotReject(validateConfig("test", config));
});

test("global menus accept metadata and static items while Area menus can declare a source", async () => {
    const config = configuration(moduleDefinition());
    areaOptions(config).global = ["shortcuts"];
    config.modules.test.menus = { shortcuts: { source: "runtime-shortcuts" }, tools: { source: "runtime-tools" } };
    await assert.rejects(validateConfig("test", config), /Global menu 'shortcuts' from module 'test' must use static contributions/);
    config.modules.test.menus.shortcuts.source = "/_assets/test/pages";
    await assert.rejects(validateConfig("test", config), /Global menu 'shortcuts' from module 'test' must use static contributions/);

    config.modules.test.menus.shortcuts = { label: "Shortcuts" };
    await assert.doesNotReject(validateConfig("test", config));
    config.modules.test.menus.shortcuts.items = [{ label: "Shortcut", href: "/pages/shortcut.js" }];
    await assert.doesNotReject(validateConfig("test", config));

    areaOptions(config).global = [];
    config.modules.test.menus.shortcuts.source = "runtime-shortcuts";
    await assert.doesNotReject(validateConfig("test", config));
});

test("module schema validates named menu definitions and rejects obsolete formats", () => {
    const module = moduleDefinition();
    module.menus = {
        navigation: { label: "Navigation", description: "Find a Page.", icon: null,
            source: "/pages", items: [{ id: "reports", label: "Reports", children: [{ label: "Detail" }] }] },
        tools: { icon: "x-tools" },
        empty: {}
    };
    assertValid(module);

    for (const definition of [[], "/pages", { items: "/pages" }, { children: [] }, { id: "empty" }, { name: "empty" },
        { description: null }, { icon: true }, { label: 1 }, { source: "" }]) {
        module.menus.empty = definition;
        assert.equal(validator.validate(configuration(module)).valid, false, JSON.stringify(definition));
    }
});

test("menu schema accepts embedded and rejects the pre-V0 embeded spelling", () => {
    const module = moduleDefinition();
    module.menus = { navigation: { items: [{ label: "Inline report", href: "/pages/report.js", embedded: true }] } };
    assertValid(module);

    module.menus.navigation.items[0] = { label: "Inline report", href: "/pages/report.js", embeded: true };
    assert.equal(validator.validate(configuration(module)).valid, false);
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

test("module schema accepts static and parameterized routes", () => {
    assertValid(moduleDefinition({
        "/something": "/pages/index.js",
        "/repository/{repositoryId}/projects/{projectId}/items": "/pages/index.js"
    }));
});

test("module schema requires route values to be strings", () => {
    const result = validator.validate(configuration(moduleDefinition({ "/something": 123 })));

    assert.equal(result.valid, false);
});

test("module schema rejects object and array route values", () => {
    for (const value of [{ target: "/pages/index.js" }, ["/pages/index.js"]]) {
        const result = validator.validate(configuration(moduleDefinition({ "/something": value })));

        assert.equal(result.valid, false);
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

test("effective schema accepts named service contract and implementation objects", () => {
    const config = configuration(moduleDefinition());
    config.xshell.services = {
        toast: {
            contract: "toast",
            implementation: "/_assets/x/services/toast-default.js"
        }
    };

    const result = validator.validate(config);

    assert.equal(result.valid, true, JSON.stringify(result.errors));
});
