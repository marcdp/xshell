
import assert from "node:assert/strict";
import test from "node:test";

import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import Menus from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/menus.js";
import MenusContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/menus.json" with { type: "json" };
import Modules from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/modules.js";
import ModulesContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/modules.json" with { type: "json" };
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import { mergeManifests, normalizeManifest } from "./helpers/manifest-composition.mjs";

function context(definitions, selections = {}) {
    const config = { app: { baseUrl: "https://example.test/" }, modules: {}, xshell: { assets: { basePath: "/_assets" } } };
    const bus = new EventTarget();
    bus.emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
    const areas = new Areas({ config, bus }, { default: Object.keys(selections)[0] ?? null, definitions: selections });
    const menus = new Menus({ config, bus, areas }, { definitions });
    return { config, bus, areas, menus };
}

test("Menus is constructed and validated by Services with its declarative options", async () => {
    const { config, bus, areas } = context({});
    const implementation = "/services/menus.js";
    const options = { definitions: { global: { scope: "global", items: [{ label: "Help" }] } } };
    config.xshell.services = { menus: { contract: "menus", implementation, lifetime: "singleton", options } };
    const setup = async (Implementation, contract = MenusContract) => {
        const services = new Services({
            config, loader: { load: async () => Implementation },
            contracts: { getContractItemById: id => ({ id, contract }) },
            resolver: { resolve: () => ({ definition: { moduleId: "xshell" } }) }
        });
        services.register("config", config);
        services.register("areas", areas);
        services.register("bus", bus);
        await services.init();
        return services;
    };

    // Controllers can read globals and register sources before the container initializes contextual menus.
    const services = await setup(Menus);
    const instance = services.resolve("menus");
    assert.equal(instance.getMenu("global").items[0].label, "Help");
    assert.equal(await services.initialize("menus"), instance);
    assert.equal(services.resolve("menus"), instance);

    const invalidContract = await setup(class { static optionsSchema = Menus.optionsSchema; });
    assert.throws(() => invalidContract.resolve("menus"), /getMenus/);
    options.definitions.global.items[0].shortcut = [];
    const invalidOptions = await setup(Menus);
    assert.throws(() => invalidOptions.resolve("menus"), /Invalid options for service 'menus'/);
});

test("module controller startup can read global menus and register a source before Area homes are derived", async () => {
    const definitions = {
        global: { scope: "global", items: [{ label: "Help" }] },
        "main-navigation": { sources: [{ source: "main-pages" }] }
    };
    const { config, areas, bus } = context(definitions, { main: { prefix: "main", menus: { navigation: "main-navigation" } } });
    const controllerPath = "/_assets/demo/module.js";
    config.modules.demo = { assets: { path: "/_assets/demo" }, files: [{ path: controllerPath }] };
    config.xshell.services = {
        menus: { contract: "menus", implementation: "/services/menus.js", lifetime: "singleton", options: { definitions } },
        modules: { contract: "modules", implementation: "/services/modules.js", lifetime: "singleton" }
    };
    class Controller {
        constructor({ areas, menus }) {
            this.menus = menus;
            assert.equal(areas.getCurrentArea().id, "main");
            assert.equal(menus.getMenu("global").items[0].label, "Help");
            assert.equal(menus.getMenu("navigation"), null);
        }
        start() {
            this.menus.registerSource("main-pages", { resolve: () => [{ label: "Home", path: "/home", href: "/_assets/demo/home.js" }] });
        }
    }
    const implementations = new Map([
        ["esm:/services/menus.js", Menus], ["esm:/services/modules.js", Modules], ["esm:" + controllerPath, Controller]
    ]);
    const loader = { load: async resource => implementations.get(resource) };
    const resolver = { resolve: () => ({ definition: { moduleId: "xshell" } }) };
    const contracts = { getContractItemById: id => ({ id, contract: id === "menus" ? MenusContract : ModulesContract }) };
    const services = new Services({ config, loader, resolver, contracts });
    for (const [name, instance] of Object.entries({ config, loader, resolver, bus, areas, document: { adoptedStyleSheets: [] } })) {
        services.register(name, instance);
    }
    await services.init();
    services.resolve("menus");
    const modules = await services.initialize("modules");
    const menus = await services.initialize("menus");
    areas.init({ modules, menus });
    assert.equal(areas.getDefaultArea().home, "/main/home");
    assert.equal(menus.resolvePath("/main/home").href, "/main/_assets/demo/home.js");
    await modules.stop();
});

test("manifests extend nested named definitions and Areas contextualize reusable slots independently", () => {
    const framework = { name: "xshell", manifest: { xshell: { resolver: { esm: { xshell: { src: "/xshell.js" } } } } } };
    const contribution = (name, definitions, dependencies = {}) => {
        const module = { name, dependencies, assetsPath: "/_assets/" + name, manifestUrl: "https://example.test/" + name + "/manifest.json" };
        module.manifest = normalizeManifest({ modules: { [name]: {} }, xshell: { services: { menus: { options: { definitions } } } } }, module);
        return module;
    };
    const base = contribution("base", {
        tools: { label: "Tools", items: [{ id: "settings", label: "Settings", icon: "settings", children: [
            { id: "about", label: "About", path: "about", href: "/pages/about.js" }
        ] }] },
        shortcuts: { scope: "global", label: "Shortcuts", items: [{ label: "Help", href: "/pages/help.js" }] }
    });
    const app = contribution("app", {
        tools: { items: [{ id: "settings", children: [
            { id: "about", description: "Updated" },
            { id: "diagnostics", label: "Diagnostics", path: "diagnostics", href: "/pages/index.js", default: true, open: "dock", outlet: "details" }
        ] }] },
        shortcuts: { label: "Actions" }
    }, { base: "1.0.0" });
    const effective = mergeManifests([app, framework, base], app).xshell.services.menus.options;
    const original = structuredClone(effective.definitions);
    const { areas, menus } = context(effective.definitions, {
        main: { prefix: "main", menus: { navigation: "tools" } },
        lab: { prefix: "lab", menus: { navigation: "tools" } },
        empty: { prefix: "empty" }
    });

    const global = menus.getMenu("shortcuts");
    assert.equal(global.label, "Actions");
    assert.equal(global.items[0].href, "/_assets/base/pages/help.js");
    assert.equal(menus.getMenu("navigation"), null);
    menus.init();
    areas.init({ modules: {}, menus });

    const main = menus.getMenu("navigation", "main");
    const lab = menus.getMenu("navigation", "lab");
    const [about, diagnostics] = main.items[0].children;
    assert.equal(main.name, "navigation");
    assert.equal(main.label, "Tools");
    assert.equal(main.items[0].module, null);
    assert.deepEqual([about.module, about.description, about.href], ["base", "Updated", "/main/_assets/base/pages/about.js"]);
    assert.equal(diagnostics.module, "app");
    assert.equal(diagnostics.path, "/main/diagnostics");
    assert.equal(lab.items[0].children[1].path, "/lab/diagnostics");
    assert.equal(lab.items[0].children[1].href, "/lab/_assets/app/pages/index.js");
    assert.equal(areas.getArea("main").menus.navigation, "tools");
    assert.equal(areas.getArea("main").home, diagnostics.path);
    assert.equal(areas.getArea("lab").home, "/lab/diagnostics");
    assert.equal(areas.getArea("empty").home, null);
    assert.equal(menus.resolvePath("/main/diagnostics"), diagnostics);
    assert.equal(menus.resolveHref("/_assets/app/pages/index.js?verbose", "lab"), lab.items[0].children[1]);
    assert.deepEqual(menus.getMenuitemBreadcrumb(diagnostics.href).map(({ label, open, outlet }) => [label, open, outlet]),
        [["Settings", null, null], ["Diagnostics", "dock", "details"]]);
    assert.deepEqual(menus.getMenus("empty"), [global]);
    assert.equal(menus.getMenu("shortcuts", "lab"), global);
    assert.equal(menus.getMenu("shortcuts", "unknown"), null);
    assert.deepEqual(menus.getMenus("unknown"), []);
    assert.ok(Object.isFrozen(main) && Object.isFrozen(main.items) && Object.isFrozen(main.items[0].children));
    assert.deepEqual(structuredClone(effective.definitions), original);
});

test("Menus validates references and retains the global static-only restriction", () => {
    assert.throws(() => context({}, { main: { menus: { navigation: "missing" } } }), /Area 'main'.*navigation.*unknown menu 'missing'/);
    assert.throws(() => context({ global: { scope: "global", sources: [{ source: "runtime" }] } }), /Global menu 'global'.*Root sources/);
    assert.throws(() => context({ global: { scope: "global", items: [{ label: "Group", childrenSource: "runtime" }] } }),
        /Global menu 'global'.*Children source 'runtime'/);
    const { menus } = context({ local: { sources: [{ source: "runtime" }] } }, { main: { menus: { navigation: "local" } } });
    assert.throws(() => menus.init(), /Area 'main' menu 'local' references unregistered menu source 'runtime'/);
});

test("Menus orders equal entries stably and derives a fallback Area home", () => {
    const { areas, menus } = context({ local: { items: [
        { label: "First equal", href: "/_assets/test/first.js" },
        { label: "Last", order: 1, path: "last" },
        { label: "Second equal", order: 0, path: "second" },
        { label: "Heading", order: -1 }
    ] } }, { main: { prefix: "main", menus: { navigation: "local" } } });
    menus.init();
    areas.init({ modules: {}, menus });
    assert.deepEqual(menus.getMenu("navigation").items.map(({ label, order }) => [label, order]),
        [["Heading", -1], ["First equal", 0], ["Second equal", 0], ["Last", 1]]);
    assert.equal(areas.getDefaultArea().home, "/main/_assets/test/first.js");
});

test("root and child sources refresh read-only projections and emit only on effective changes", () => {
    const definitions = { local: {
        sources: [{ id: "primary", source: "roots" }, { id: "secondary", source: "extra" }],
        items: [{ id: "group", label: "Group", childrenSource: "children", children: [{ id: "static", label: "Static", href: "/static.js" }] }]
    } };
    const { menus, bus } = context(definitions, {
        main: { prefix: "main", menus: { navigation: "local" } },
        lab: { prefix: "lab", menus: { navigation: "local" } }
    });
    let children = [{ id: "static", label: "Live" }, { label: "Nested", childrenSource: "nested", order: -1 }];
    let roots = [{ label: "Root", href: "/root.js" }];
    const childSource = { resolve: () => children, dependsOn: ["test:update"] };
    const rootSource = { resolve: () => roots };
    const nested = { resolve: () => [{ label: "Nested child" }] };
    menus.registerSource("roots", rootSource);
    menus.registerSource("children", childSource);
    menus.registerSource("nested", nested);
    menus.registerSource("extra", { resolve: () => [{ label: "Extra" }] });
    assert.throws(() => menus.registerSource("roots", rootSource), /already registered/);
    let changes = 0;
    bus.addEventListener("xshell:menus:change", () => changes++);
    menus.init();

    const menu = menus.getMenu("navigation");
    const [group, root, extra] = menu.items;
    assert.deepEqual([root.label, extra.label], ["Root", "Extra"]);
    assert.deepEqual(group.children.map(item => item.label), ["Nested", "Live"]);
    assert.equal(group.children[0].children[0].label, "Nested child");
    assert.equal(rootSource.refresh(), false);
    assert.throws(() => group.children.pop(), TypeError);

    children = [];
    bus.emit("test:update", {});
    assert.equal(changes, 1);
    assert.equal(menus.getMenu("navigation"), menu);
    assert.equal(menu.items[0].children[0].label, "Static");
    assert.equal(menus.getMenu("navigation", "lab").items[0].children[0].href, "/lab/static.js");
    assert.equal(group.children[1].label, "Live");
    assert.equal(nested.refresh(), false);

    roots = [{ label: "New root", href: "/new.js" }];
    assert.equal(rootSource.refresh(), true);
    assert.equal(changes, 2);
    assert.equal(menus.resolveHref("/new.js", "main").label, "New root");
    assert.equal(menus.resolveHref("/root.js", "main"), null);

    roots = {};
    assert.throws(() => rootSource.refresh(), /must resolve to an array/);
    assert.equal(menu.items[1].label, "New root");
    assert.equal(changes, 2);
});
