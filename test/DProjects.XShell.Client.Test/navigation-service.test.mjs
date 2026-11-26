import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Navigation from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/navigation.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";

import ConfigSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/config.schema.json" with { type: "json" };

const frameworkUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/", import.meta.url);

test("framework manifest registers Navigation declaratively with service options", async () => {
    const source = await readFile(new URL("manifest.jsonc", frameworkUrl), "utf8");

    assert.match(source, /"navigation"\s*:\s*\{\s*"contract"\s*:\s*"navigation",\s*"implementation"\s*:\s*"\/services\/navigation\.js",\s*"lifetime"\s*:\s*"singleton",\s*"options"\s*:\s*\{\s*"mode"\s*:\s*"path",\s*"globalPrefix"\s*:\s*"\/global"\s*\}/s);
    assert.equal((source.match(/"navigation"\s*:/g) ?? []).length, 1);
});

test("global configuration delegates Navigation option validation to the service implementation", () => {
    assert.equal(ConfigSchema.$defs.xshell.required.includes("navigation"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs.xshell.properties, "navigation"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs, "xshellNavigation"), false);
});

test("Navigation options accept an optional reserved prefix as a string", () => {
    const validator = new JsonValidator();
    for (const options of [{ mode: "path" }, { mode: "hash", globalPrefix: "/shared/tools" }]) {
        assert.equal(validator.validate(options, Navigation.optionsSchema).valid, true);
    }
    assert.equal(validator.validate({ mode: "path", globalPrefix: 123 }, Navigation.optionsSchema).valid, false);
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
    assert.match(source, /const services = this\._services;\s+const XPage = createXPageClass\(\{[\s\S]*?get navigation\(\) \{ return services\.resolve\("navigation"\); \}/);
    assert.ok(servicesIndex < areasResolveIndex && areasResolveIndex < resolveModulesIndex && resolveModulesIndex < areasIndex && areasIndex < navigationIndex);
});

test("HTML link processing reads only Navigation mode from the explicit render context", async () => {
    const source = await readFile(new URL("utils/html.js", frameworkUrl), "utf8");

    assert.match(source, /context\.navigationMode/);
    assert.doesNotMatch(source, /context\.navigation(?:\.|\[)/);
    assert.doesNotMatch(source, /context\.services/);
    assert.doesNotMatch(source, /config\.xshell\.navigation/);
});
