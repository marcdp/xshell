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
    performance,
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

test("manifest arrays merge by ID in bootstrap precedence order", () => {
    // Supply normalized manifests in a different order from their merge precedence.
    const framework = {
        name: "xshell", manifest: {
            xshell: { resolver: { esm: { xshell: { src: "/xshell.js" } } } },
            menu: {
                items: [{ id: "open", obsolete: true }, "separator", { id: "save" }, { label: "Help" }, { id: "" }, { id: 1 }],
                other: [{ id: "open", label: "Other" }]
            }
        }
    };
    const dependency = {
        name: "dep", manifest: {
            modules: { dep: {} },
            menu: { items: [{ id: "save", label: "Dependency" }, { id: "open", label: "Dependency", obsolete: true }] }
        }
    };
    const app = {
        name: "app", dependencies: { dep: "1.0.0" }, manifest: {
            modules: { app: {} },
            menu: {
                items: ["separator", { id: "rename", label: "First" }, { id: "open", label: "Root" }, { label: "Help" },
                    { id: "rename", label: "Last" }, { id: "" }, { id: 1 }],
                rootOnly: [{ id: "new", label: "First" }, null, { id: "new", label: "Last" }]
            }
        }
    };
    const modules = [app, dependency, framework];
    const original = structuredClone(modules);

    // Exercise the active bootstrap's scoped merge and verify the source manifests remain independent.
    const mergeSource = bootstrapSource.match(/^        function mergeManifests\(\) \{[\s\S]*?^        \}/m)[0];
    const config = vm.runInNewContext(`${mergeSource}\nmergeManifests()`, {
        app, resolvedModules: new Map(modules.map(module => [module.name, module])), structuredClone
    });
    assert.deepEqual(plain(config.menu), {
        items: [{ id: "open", label: "Root" }, "separator", { id: "save", label: "Dependency" }, { label: "Help" }, { id: "" }, { id: 1 },
            "separator", { id: "rename", label: "Last" }, { label: "Help" }, { id: "" }, { id: 1 }],
        other: [{ id: "open", label: "Other" }],
        rootOnly: [{ id: "new", label: "Last" }, null]
    });
    config.menu.items[0].label = "Changed";
    config.menu.other[0].label = "Changed";
    config.menu.items.pop();
    assert.deepEqual(modules, original);
});

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
    const config = { xshell: { services: { navigation: { options: { mode: "path" } } }, flags: {} } };

    apply(config, {
        "xshell:services.navigation.options.mode": '"hash"',
        "xshell:flags.enabled": "true",
        "xshell:flags.values": "[1,2]"
    });

    assert.deepEqual(plain(config.xshell), {
        services: { navigation: { options: { mode: "hash" } } },
        flags: { enabled: true, values: [1, 2] }
    });
});

test("an existing service gains options when an override traverses it", () => {
    const config = { xshell: { services: { commands: { contract: "commands", implementation: "/commands.js" } } } };

    apply(config, { "xshell:services.commands.options.timeout": "30" });

    assert.deepEqual(plain(config.xshell.services.commands.options), { timeout: 30 });
});

test("unknown services and arbitrary missing intermediate paths remain rejected", () => {
    const config = { xshell: { services: { commands: { contract: "commands", implementation: "/commands.js" }, navigation: { options: {} } } } };

    assert.throws(() => apply(config, { "xshell:services.unknown.options.timeout": "30" }),
        /Unknown configuration path: services\.unknown\.options\.timeout/);
    assert.throws(() => apply(config, { "xshell:services.navigation.options.missing.value": "30" }),
        /Unknown configuration path: services\.navigation\.options\.missing\.value/);
});

test("invalid paths, incompatible intermediates, and prototype-pollution segments are rejected", () => {
    const config = { xshell: { services: { navigation: { options: { mode: "path" } } }, values: [] } };

    assert.throws(() => apply(config, { "xshell:services.navigation.options..mode": '"hash"' }), /Invalid configuration override/);
    assert.throws(() => apply(config, { "xshell:values.0.name": '"value"' }), /Invalid configuration path/);
    for (const segment of ["__proto__", "prototype", "constructor"]) {
        assert.throws(() => apply(config, { [`xshell:services.navigation.options.${segment}.polluted`]: "true" }), /Invalid configuration override/);
    }
    assert.equal({}.polluted, undefined);
});

test("reserved app metadata is not applied as a config.xshell override", () => {
    const config = { xshell: { services: { navigation: { options: { mode: "path" } } } } };

    apply(config, {
        "xshell:app.environment": "Development",
        "xshell:services.navigation.options.mode": '"hash"'
    });

    assert.deepEqual(plain(config.xshell), { services: { navigation: { options: { mode: "hash" } } } });
});

test("bootstrap applies overrides before XShell initialization and configuration validation", () => {
    const applyIndex = bootstrapSource.indexOf("config = fillXShellOverrides(config)");
    const initIndex = bootstrapSource.indexOf("await xshell.init(deepFreeze(config), timings)");

    assert.notEqual(applyIndex, -1);
    assert.notEqual(initIndex, -1);
    assert.ok(applyIndex < initIndex);
});
