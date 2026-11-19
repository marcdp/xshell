import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ConfigSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/config.schema.json" with { type: "json" };
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import AreasContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/areas.json" with { type: "json" };
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";

const frameworkUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/", import.meta.url);

test("framework manifest registers Areas declaratively with service options", async () => {
    const source = await readFile(new URL("manifest.jsonc", frameworkUrl), "utf8");

    const manifest = JSON.parse(source.replace(/^\s*\/\/[^\r\n]*/gm, ""));
    assert.deepEqual(manifest.xshell.services.areas, {
        contract: "areas", implementation: "/services/areas.js",
        options: { default: "main", global: ["shortcuts", "preferences"], definitions: {} }
    });
    assert.equal((source.match(/"areas"\s*:/g) ?? []).length, 1);
});

test("Areas declares the effective menu shape in its public contract", () => {
    const validator = new JsonValidator();
    const result = validator.validate(AreasContract, ContractSchema);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    const { methods, types } = AreasContract;
    assert.equal(methods.getMenu.returns.ref, "menuDefinition");
    assert.equal(methods.getGlobalMenu.returns.ref, "menuDefinition");
    assert.equal(methods.getMenus.returns.type, "array");
    assert.deepEqual(types.menuDefinition.schema.required, ["name", "label", "description", "icon", "items"]);
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
    const resolveAreasIndex = source.indexOf('const areas = this._services.resolve("areas")');
    const resolveModulesIndex = source.indexOf('const modules = await this._services.initialize("modules")');
    const initAreasIndex = source.indexOf("areas.init({ modules })");
    const navigationIndex = source.indexOf('await this._services.initialize("navigation")');

    assert.doesNotMatch(source, /import Areas from/);
    assert.doesNotMatch(source, /new Areas\s*\(/);
    assert.doesNotMatch(source, /register\("areas"/);
    assert.match(source, /get areas\(\) \{ return this\._services\.resolve\("areas"\); \}/);
    assert.ok(servicesIndex < resolveAreasIndex && resolveAreasIndex < resolveModulesIndex &&
        resolveModulesIndex < initAreasIndex && initAreasIndex < navigationIndex);
});

test("Areas performs semantic option validation during construction", () => {
    const bus = { addEventListener() {} };
    const config = {
        modules: { test: { menus: { shortcuts: { source: "runtime-source" } } } },
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
    }), /Global menu 'shortcuts' from module 'test' must use static contributions/);
});
