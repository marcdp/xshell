import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ConfigSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/config.schema.json" with { type: "json" };
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import MenusContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/menus.json" with { type: "json" };
import AreasContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/areas.json" with { type: "json" };
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";

const frameworkUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/", import.meta.url);

test("framework manifest registers Areas declaratively with service options", async () => {
    const source = await readFile(new URL("manifest.jsonc", frameworkUrl), "utf8");

    const manifest = JSON.parse(source.replace(/^\s*\/\/[^\r\n]*/gm, ""));
    assert.deepEqual(manifest.xshell.services.areas, {
        contract: "areas", implementation: "/services/areas.js",
        lifetime: "singleton",
        options: { default: "main", definitions: {} }
    });
    assert.deepEqual(manifest.xshell.services.menus, {
        contract: "menus", implementation: "/services/menus.js",
        lifetime: "singleton", options: { definitions: {} }
    });
    assert.equal((source.match(/"areas"\s*:/g) ?? []).length, 1);
});

test("Menus owns the effective menu shape and menu events in its public contract", () => {
    const validator = new JsonValidator();
    const result = validator.validate(AreasContract, ContractSchema);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    const menuResult = validator.validate(MenusContract, ContractSchema);
    assert.equal(menuResult.valid, true, JSON.stringify(menuResult.errors));
    const { methods, types } = MenusContract;
    assert.equal(Object.hasOwn(AreasContract.methods, "getMenu"), false);
    assert.equal(Object.hasOwn(AreasContract.events, "xshell:menus:change"), false);
    assert.ok(Object.hasOwn(MenusContract.events, "xshell:menus:change"));
    assert.equal(methods.getMenu.returns.ref, "menuDefinition");
    assert.equal(Object.hasOwn(methods, "getGlobalMenu"), false);
    assert.equal(methods.getMenus.returns.type, "array");
    assert.deepEqual(types.menuDefinition.schema.required, ["name", "scope", "label", "description", "icon", "items"]);
    assert.deepEqual(types.menuDefinition.schema.properties.scope.enum, ["global", "area"]);
    assert.equal(typeof Areas.prototype.getGlobalMenu, "undefined");
});

test("global configuration delegates Area option validation to the service implementation", () => {
    assert.equal(ConfigSchema.$defs.xshell.required.includes("areas"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs.xshell.properties, "areas"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs, "xshellAreas"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs, "xshellArea"), false);
});

test("Services rejects the removed global menu option", async () => {
    const implementation = "/services/areas.js";
    const config = {
        app: { baseUrl: "https://example.test/" },
        modules: {},
        xshell: {
            assets: { basePath: "/_assets" },
            files: [{ path: implementation, size: 1 }],
            services: { areas: { contract: "areas", implementation, lifetime: "singleton", options: { default: null, definitions: {}, global: ["shortcuts"] } } }
        }
    };
    const bus = new EventTarget();
    const services = new Services({
        config, bus,
        loader: { async load() { return Areas; } },
        contracts: { getContractItemById() { return { id: "areas", contract: AreasContract }; } },
        resolver: { resolve() { return { definition: { moduleId: "xshell" } }; } }
    });
    await services.init();
    assert.throws(() => services.resolve("areas"), /Invalid options for service 'areas'.*Property "global".*additional properties schema/);
});

test("XShell resolves Areas before Modules and composes it before Navigation", async () => {
    const source = await readFile(new URL("xshell.js", frameworkUrl), "utf8");
    const servicesIndex = source.indexOf("await this._services.init()");
    const resolveAreasIndex = source.indexOf('const areas = this._services.resolve("areas")');
    const resolveMenusIndex = source.indexOf('this._services.resolve("menus");');
    const initMenusIndex = source.indexOf('const menus = await this._services.initialize("menus")');
    const resolveModulesIndex = source.indexOf('const modules = await this._services.initialize("modules")');
    const initAreasIndex = source.indexOf("areas.init({ modules, menus })");
    const navigationIndex = source.indexOf('await this._services.initialize("navigation")');

    assert.doesNotMatch(source, /import Areas from/);
    assert.doesNotMatch(source, /new Areas\s*\(/);
    assert.doesNotMatch(source, /register\("areas"/);
    assert.match(source, /const services = this\._services;\s+const XPage = createXPageClass\(\{[\s\S]*?get areas\(\) \{ return services\.resolve\("areas"\); \}/);
    assert.ok(servicesIndex < resolveAreasIndex && resolveAreasIndex < resolveMenusIndex && resolveMenusIndex < resolveModulesIndex &&
        resolveModulesIndex < initMenusIndex && initMenusIndex < initAreasIndex && initAreasIndex < navigationIndex);
});

test("Areas performs semantic option validation during construction", () => {
    const bus = { addEventListener() {} };
    const config = {
        modules: { test: {} },
        xshell: { assets: { basePath: "/_assets" } }
    };

    assert.throws(() => new Areas({ config, bus }, {
        default: "missing", definitions: { main: { prefix: "/main", modules: ["test"] } }
    }), /Default area 'missing' is not defined/);
    assert.throws(() => new Areas({ config, bus }, {
        default: null, definitions: { first: { prefix: "demo" }, second: { prefix: "/demo/" } }
    }), /Areas 'first' and 'second' have duplicate normalized prefix '\/demo'/);
    assert.throws(() => new Areas({ config, bus }, {
        default: null, definitions: { main: { modules: ["missing"] } }
    }), /Area 'main' references unknown module 'missing'/);
});
