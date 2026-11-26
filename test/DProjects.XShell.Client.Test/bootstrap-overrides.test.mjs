import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";

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
            xshell: {
                resolver: { esm: { xshell: { src: "/xshell.js" } } },
                services: {
                    filesystems: { options: { editors: {
                        text: { page: "/text.js", label: "Open", extensions: ["txt"] }
                    } } },
                    stores: { options: { providers: {
                        mem: { implementation: "/providers/store-mem.js" }
                    } } }
                }
            },
            menu: {
                items: [{ id: "open", obsolete: true }, "separator", { id: "save" }, { label: "Help" }, { id: "" }, { id: 1 }],
                other: [{ id: "open", label: "Other" }]
            }
        }
    };
    const dependency = {
        name: "dep", manifest: {
            modules: { dep: {} },
            xshell: { services: {
                filesystems: { options: { editors: {
                    archive: { page: "/archive.js", label: "Open", extensions: ["zip"] }
                } } },
                stores: { options: { providers: {
                    remote: { implementation: "/providers/store-remote.js", options: { endpoint: "https://example.test/api" } }
                } } }
            } },
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
    assert.deepEqual(plain(config.xshell.services.filesystems.options.editors), {
        text: { page: "/text.js", label: "Open", extensions: ["txt"] },
        archive: { page: "/archive.js", label: "Open", extensions: ["zip"] }
    });
    assert.deepEqual(plain(config.xshell.services.stores.options.providers), {
        mem: { implementation: "/providers/store-mem.js" },
        remote: { implementation: "/providers/store-remote.js", options: { endpoint: "https://example.test/api" } }
    });
    config.menu.items[0].label = "Changed";
    config.menu.other[0].label = "Changed";
    config.menu.items.pop();
    assert.deepEqual(modules, original);
});

test("menu configuration follows generic value-driven path semantics", () => {
    const definition = { menus: {
        navigation: { source: "/pages/navigation" },
        tools: { source: "/pages/tools" },
        arbitraryMenu123: { source: "/pages/custom" },
        registered: { source: "customer-pages" },
        reports: { label: "Reports", icon: "/icons/reports.svg", items: [{
            label: "Reports", path: "/reports", href: "/pages/report.js", tooltip: "/literal-tooltip",
            children: [{ label: "Detail", path: "/reports/detail", href: "./pages/detail.js", class: "/literal-class" }]
        }] }
    }, params: { metadata: { path: "/metadata" }, sample: { href: "/sample", url: "ordinary-url" } } };
    // Exercise the path normalization functions scoped to the active bootstrap.
    const normalize = bootstrapSource.match(/^        function normalizeUrl\([\s\S]*?^        \}\r?\n        function normalizeManifest\([\s\S]*?^        \}/m)[0];
    const module = plain(vm.runInNewContext(`${normalize}\nnormalizeManifest(definition, owner)`, {
        URL, definition, appBaseUrl: "https://example.test/app/",
        owner: { assetsPath: "/_assets/x/1.0.0.dev", manifestUrl: "https://example.test/modules/x/manifest.json" }
    }));

    assert.equal(module.menus.navigation.source, "/_assets/x/1.0.0.dev/pages/navigation");
    assert.equal(module.menus.tools.source, "/_assets/x/1.0.0.dev/pages/tools");
    assert.equal(module.menus.arbitraryMenu123.source, "/_assets/x/1.0.0.dev/pages/custom");
    assert.equal(module.menus.registered.source, "customer-pages");
    assert.equal(module.menus.reports.label, "Reports");
    assert.equal(module.menus.reports.icon, "/_assets/x/1.0.0.dev/icons/reports.svg");
    const [report] = module.menus.reports.items;
    assert.equal(report.path, "/_assets/x/1.0.0.dev/reports");
    assert.equal(report.href, "/_assets/x/1.0.0.dev/pages/report.js");
    assert.equal(report.tooltip, "/_assets/x/1.0.0.dev/literal-tooltip");
    assert.equal(report.children[0].path, "/_assets/x/1.0.0.dev/reports/detail");
    assert.equal(report.children[0].href, "/_assets/x/1.0.0.dev/pages/detail.js");
    assert.equal(report.children[0].class, "/_assets/x/1.0.0.dev/literal-class");
    assert.deepEqual(module.params, {
        metadata: { path: "/_assets/x/1.0.0.dev/metadata" },
        sample: { href: "/_assets/x/1.0.0.dev/sample", url: "ordinary-url" }
    });
});

test("manifest normalization keeps Navigation's global prefix application-relative", () => {
    const normalize = bootstrapSource.match(/^        function normalizeUrl\([\s\S]*?^        \}\r?\n        function normalizeManifest\([\s\S]*?^        \}/m)[0];
    for (const [name, globalPrefix] of [["xshell", "/global"], ["x-demo", "/tools/workbench"]]) {
        const assetPath = `/_assets/${name}/0.9.0.dev`;
        const owner = { assetsPath: assetPath, manifestUrl: `https://example.test/modules/${name}/manifest.json` };
        const definition = { xshell: { services: {
            navigation: { implementation: "/services/navigation.js", options: { globalPrefix } },
            other: { options: { globalPrefix: "/resource.js" } }
        } } };
        const config = vm.runInNewContext(`${normalize}\nnormalizeManifest(definition, owner)`, {
            URL, definition, owner, appBaseUrl: "https://example.test/prefix/"
        });

        // Construct Areas with the namespace supplied by bootstrap before XShell starts.
        config.xshell.assets = { basePath: "/_assets" };
        config.modules = {};
        const areas = new Areas({ config, bus: new EventTarget() }, { default: null, definitions: {} });
        assert.equal(areas.globalPrefix, globalPrefix);
        assert.equal(config.xshell.services.navigation.implementation, assetPath + "/services/navigation.js");
        assert.equal(config.xshell.services.other.options.globalPrefix, assetPath + "/resource.js");
    }
});

test("generated resource metadata and Search provider prefixes remain literal", () => {
    const metadata = { type: "page", title: "/Getting Started", description: "app: configuration guide", icon: "x-settings" };
    const prefixes = ["/", "./", "app:", "url:", "page:"];
    const definition = {
        xshell: {
            files: [{ path: "/framework.js", size: 12, hash: "framework", resource: metadata }],
            services: { search: { options: { providers: { custom: { implementation: "/providers/search-custom.js", prefixes } } } } }
        },
        modules: { x: { files: [{ path: "/pages/index.js", size: 123, hash: "module", resource: metadata }] } },
        unrelated: { path: "/ordinary.js", size: 1, hash: "ordinary", resource: { title: "/Normalize me" }, prefixes: ["/ordinary.js"] }
    };
    const normalize = bootstrapSource.match(/^        function normalizeUrl\([\s\S]*?^        \}\r?\n        function normalizeManifest\([\s\S]*?^        \}/m)[0];
    const module = plain(vm.runInNewContext(`${normalize}\nnormalizeManifest(definition, owner)`, {
        URL, definition, appBaseUrl: "https://example.test/app/",
        owner: { assetsPath: "/_assets/x/1.0.0.dev", manifestUrl: "https://example.test/modules/x/manifest.json" }
    }));

    assert.equal(module.xshell.files[0].path, "/_assets/x/1.0.0.dev/framework.js");
    assert.deepEqual(module.xshell.files[0].resource, metadata);
    assert.equal(module.modules.x.files[0].path, "/_assets/x/1.0.0.dev/pages/index.js");
    assert.deepEqual(module.modules.x.files[0].resource, metadata);
    assert.equal(module.unrelated.resource.title, "/_assets/x/1.0.0.dev/Normalize%20me");
    assert.deepEqual(module.unrelated.prefixes, ["/_assets/x/1.0.0.dev/ordinary.js"]);
    assert.deepEqual(module.xshell.services.search.options.providers.custom, {
        implementation: "/_assets/x/1.0.0.dev/providers/search-custom.js", prefixes
    });
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
    const config = { xshell: { services: { commands: { contract: "commands", implementation: "/commands.js", lifetime: "singleton" } } } };

    apply(config, { "xshell:services.commands.options.timeout": "30" });

    assert.deepEqual(plain(config.xshell.services.commands.options), { timeout: 30 });
});

test("unknown services and arbitrary missing intermediate paths remain rejected", () => {
    const config = { xshell: { services: { commands: { contract: "commands", implementation: "/commands.js", lifetime: "singleton" }, navigation: { options: {} } } } };

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
