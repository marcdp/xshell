import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ConfigSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/config.schema.json" with { type: "json" };

const frameworkUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/", import.meta.url);

test("framework manifest registers Navigation declaratively with service options", async () => {
    const source = await readFile(new URL("manifest.jsonc", frameworkUrl), "utf8");

    assert.match(source, /"navigation"\s*:\s*\{\s*"contract"\s*:\s*"navigation",\s*"implementation"\s*:\s*"\/services\/navigation\.js",\s*"options"\s*:\s*\{\s*"mode"\s*:\s*"path"\s*\}/s);
    assert.equal((source.match(/"navigation"\s*:/g) ?? []).length, 1);
});

test("global configuration delegates Navigation option validation to the service implementation", () => {
    assert.equal(ConfigSchema.$defs.xshell.required.includes("navigation"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs.xshell.properties, "navigation"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs, "xshellNavigation"), false);
});

test("XShell resolves the configured Navigation singleton after Areas composition", async () => {
    const source = await readFile(new URL("xshell.js", frameworkUrl), "utf8");
    const servicesIndex = source.indexOf("await this._services.init()");
    const resolveModulesIndex = source.indexOf('const modules = await this._services.initialize("modules")');
    const areasResolveIndex = source.indexOf('const areas = this._services.resolve("areas")');
    const areasIndex = source.indexOf("areas.init({ modules })");
    const navigationIndex = source.indexOf('await this._services.initialize("navigation")');

    assert.doesNotMatch(source, /import Navigation from/);
    assert.doesNotMatch(source, /new Navigation\s*\(/);
    assert.doesNotMatch(source, /register\("navigation"/);
    assert.match(source, /get navigation\(\) \{ return this\._services\.resolve\("navigation"\); \}/);
    assert.ok(servicesIndex < areasResolveIndex && areasResolveIndex < resolveModulesIndex && resolveModulesIndex < areasIndex && areasIndex < navigationIndex);
});

test("HTML link processing reads the configured Navigation service mode", async () => {
    const source = await readFile(new URL("utils/html.js", frameworkUrl), "utf8");

    assert.match(source, /context\.services\.navigation\.mode/);
    assert.doesNotMatch(source, /config\.xshell\.navigation/);
});
