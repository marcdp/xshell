import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const bootstrapPath = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/bootstrap/index.js", import.meta.url);
const bootstrapSource = readFileSync(bootstrapPath, "utf8");
const metadata = [];
const source = bootstrapSource.replace(
    /\/\/ main\s+main\(\);\s*$/,
    "globalThis.__bootstrapOverrides = { fillXShellOverrides, parseXShellOverrideValue };"
);
const context = vm.createContext({
    URL,
    document: {
        querySelector() { return null; },
        querySelectorAll(selector) {
            if (selector === 'meta[name="xshell:app.source"]') return [];
            if (selector === 'meta[name^="xshell:"]') return metadata;
            throw new Error(`Unexpected selector: ${selector}`);
        }
    }
});
new vm.Script(source, { filename: bootstrapPath.pathname }).runInContext(context);
const api = context.__bootstrapOverrides;
const plain = value => JSON.parse(JSON.stringify(value));

function apply(config, entries) {
    metadata.splice(0, metadata.length, ...Object.entries(entries).map(([name, content]) => ({ name, content })));
    return api.fillXShellOverrides(config);
}

test("override values use JSON-first parsing with an explicit string fallback", () => {
    const cases = new Map([
        ["true", true],
        ["123", 123],
        ["null", null],
        ['{"key":"value"}', { key: "value" }],
        ['[1,"two",false]', [1, "two", false]],
        ['"true"', "true"],
        ['"123"', "123"],
        ["/temp", "/temp"]
    ]);

    for (const [content, expected] of cases) {
        assert.deepEqual(plain(api.parseXShellOverrideValue(content)), expected);
    }
});

test("multiple overrides are applied in metadata order", () => {
    const config = { xshell: { navigation: { mode: "path" }, flags: {} } };

    apply(config, {
        "xshell:navigation.mode": '"hash"',
        "xshell:flags.enabled": "true",
        "xshell:flags.values": "[1,2]"
    });

    assert.deepEqual(plain(config.xshell), {
        navigation: { mode: "hash" },
        flags: { enabled: true, values: [1, 2] }
    });
});

test("an existing service gains options when an override traverses it", () => {
    const config = { xshell: { services: { commands: { contract: "commands", implementation: "/commands.js" } } } };

    apply(config, { "xshell:services.commands.options.timeout": "30" });

    assert.deepEqual(plain(config.xshell.services.commands.options), { timeout: 30 });
});

test("unknown services and arbitrary missing intermediate paths remain rejected", () => {
    const config = { xshell: { services: { commands: { contract: "commands", implementation: "/commands.js" } }, navigation: {} } };

    assert.throws(() => apply(config, { "xshell:services.unknown.options.timeout": "30" }),
        /Unknown configuration path: services\.unknown\.options\.timeout/);
    assert.throws(() => apply(config, { "xshell:navigation.missing.value": "30" }),
        /Unknown configuration path: navigation\.missing\.value/);
});

test("invalid paths, incompatible intermediates, and prototype-pollution segments are rejected", () => {
    const config = { xshell: { navigation: { mode: "path" }, values: [] } };

    assert.throws(() => apply(config, { "xshell:navigation..mode": '"hash"' }), /Invalid configuration override/);
    assert.throws(() => apply(config, { "xshell:values.0.name": '"value"' }), /Invalid configuration path/);
    for (const segment of ["__proto__", "prototype", "constructor"]) {
        assert.throws(() => apply(config, { [`xshell:navigation.${segment}.polluted`]: "true" }), /Invalid configuration override/);
    }
    assert.equal({}.polluted, undefined);
});

test("reserved app metadata is not applied as a config.xshell override", () => {
    const config = { xshell: { navigation: { mode: "path" } } };

    apply(config, {
        "xshell:app.environment": "Development",
        "xshell:navigation.mode": '"hash"'
    });

    assert.deepEqual(plain(config.xshell), { navigation: { mode: "hash" } });
});

test("bootstrap applies overrides before XShell initialization and configuration validation", () => {
    const applyIndex = bootstrapSource.indexOf("config = fillXShellOverrides(config)");
    const initIndex = bootstrapSource.indexOf("await xshell.init(deepFreeze(config))");

    assert.notEqual(applyIndex, -1);
    assert.notEqual(initIndex, -1);
    assert.ok(applyIndex < initIndex);
});
