import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ConfigSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/config.schema.json" with { type: "json" };
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";

const frameworkUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/", import.meta.url);

test("framework manifest registers Areas declaratively with service options", async () => {
    const source = await readFile(new URL("manifest.jsonc", frameworkUrl), "utf8");

    assert.match(source, /"areas"\s*:\s*\{\s*"contract"\s*:\s*"areas",\s*"implementation"\s*:\s*"\/services\/areas\.js",\s*"options"\s*:\s*\{\s*"default"\s*:\s*"main",\s*"global"\s*:\s*\["shortcuts"\],\s*"definitions"\s*:\s*\{\}/s);
    assert.equal((source.match(/"areas"\s*:/g) ?? []).length, 1);
});

test("global configuration delegates Area option validation to the service implementation", () => {
    assert.equal(ConfigSchema.$defs.xshell.required.includes("areas"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs.xshell.properties, "areas"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs, "xshellAreas"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs, "xshellArea"), false);
});

test("XShell resolves Areas before Modules and composes it before Navigation", async () => {
    const source = await readFile(new URL("xshell.js", frameworkUrl), "utf8");
    const servicesIndex = source.indexOf("await this._services.init()");
    const registryIndex = source.indexOf('await this._services.initialize("registry")');
    const resolveAreasIndex = source.indexOf('const areas = this._services.resolve("areas")');
    const resolveModulesIndex = source.indexOf('const modules = await this._services.initialize("modules")');
    const initAreasIndex = source.indexOf("areas.init({ modules })");
    const navigationIndex = source.indexOf('await this._services.initialize("navigation")');

    assert.doesNotMatch(source, /import Areas from/);
    assert.doesNotMatch(source, /new Areas\s*\(/);
    assert.doesNotMatch(source, /register\("areas"/);
    assert.match(source, /get areas\(\) \{ return this\._services\.resolve\("areas"\); \}/);
    assert.ok(servicesIndex < registryIndex && registryIndex < resolveAreasIndex && resolveAreasIndex < resolveModulesIndex &&
        resolveModulesIndex < initAreasIndex && initAreasIndex < navigationIndex);
});

test("Areas performs semantic option validation during construction", () => {
    const bus = { addEventListener() {} };
    const config = {
        modules: { test: { menus: { shortcuts: "runtime-source" } } },
        xshell: { assets: { basePath: "/_assets" } }
    };

    assert.throws(() => new Areas({ config, bus }, {
        default: "missing", global: [], definitions: { main: { prefix: "/main", modules: ["test"] } }
    }), /Default area 'missing' is not defined/);
    assert.throws(() => new Areas({ config, bus }, {
        default: null, global: [], definitions: { first: { prefix: "demo" }, second: { prefix: "/demo/" } }
    }), /Areas 'first' and 'second' have duplicate normalized prefix '\/demo'/);
    assert.throws(() => new Areas({ config, bus }, {
        default: null, global: [], definitions: { main: { modules: ["missing"] } }
    }), /Area 'main' references unknown module 'missing'/);
    assert.throws(() => new Areas({ config, bus }, {
        default: null, global: ["shortcuts"], definitions: {}
    }), /Global menu 'shortcuts' from module 'test' must be a static array/);
});
