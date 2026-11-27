
import assert from "node:assert/strict";
import test from "node:test";

import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import Logger from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/logger.js";
import Menus from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/menus.js";
import MenusContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/menus.json" with { type: "json" };
import Modules from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/modules.js";
import ModulesContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/modules.json" with { type: "json" };
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import { mergeManifests, normalizeManifest } from "./helpers/manifest-composition.mjs";

function context(definitions, selections = {}, defaultArea = Object.keys(selections)[0] ?? null) {
    const config = { app: { baseUrl: "https://example.test/" }, modules: {}, xshell: { assets: { basePath: "/_assets" } } };
    const bus = new EventTarget();
    bus.emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
    const areas = new Areas({ config, bus }, { default: defaultArea, definitions: selections });
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
    assert.deepEqual(instance.getMenus(), [instance.getMenu("global")]);
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
    for (const [name, instance] of Object.entries({ config, loader, resolver, bus, areas, logger: new Logger({}), document: { adoptedStyleSheets: [] } })) {
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
    assert.deepEqual(menus.getMenus("main"), [main, global]);
    assert.deepEqual(menus.getMenus("lab"), [lab, global]);
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

test("Area slots cannot reference or shadow global definitions during construction", () => {
    const definitions = { global: { scope: "global" }, preferences: { scope: "global" }, local: {} };
    assert.throws(() => context(definitions, { main: { menus: { actions: "global" } } }),
        /Area 'main' menu slot 'actions' cannot reference global menu 'global'/);
    assert.throws(() => context(definitions, { main: { menus: { preferences: "local" } } }),
        /Area 'main' menu slot 'preferences' conflicts with global menu name 'preferences'/);

    const { menus } = context(definitions, { main: { menus: { navigation: "local" } } });
    menus.init();
    const all = menus.getMenus("main");
    assert.deepEqual(all.map(menu => menu.name), ["navigation", "global", "preferences"]);
    assert.deepEqual(all, all.map(menu => menus.getMenu(menu.name, "main")));
});

test("Area aliases may be repeated across slots for an equivalent contextual destination", () => {
    const { menus } = context({
        local: { items: [{ label: "Group", path: "help", children: [{
            label: "Help", path: "help", href: "/pages/help.js?view=full&sort=name#usage"
        }] }] },
        tools: { items: [{ label: "Help link", path: "/main/help", href: "/main/pages/help.js?sort=name&view=full#usage" }] }
    }, { main: { prefix: "main", menus: { navigation: "local", tools: "tools" } } });
    menus.init();
    const [group] = menus.getMenu("navigation").items;
    assert.equal(group.path, "/main/help");
    assert.equal(menus.resolvePath("/main/help"), group.children[0]);
    assert.equal(menus.resolvePath(null), null);
});

test("friendly aliases use the longest Area prefix regardless of declaration, default, or display order", t => {
    const definitions = {
        main: { items: [{ label: "Status", path: "status", href: "/pages/status.js" }, {
            label: "Tools group", path: "tools/help", children: [{ label: "Overview", path: "overview", href: "/pages/overview.js" }]
        }] },
        tools: { items: [{ label: "Help", path: "help", href: "/pages/help.js" }] },
        root: { items: [{ label: "Welcome", path: "welcome", href: "/pages/welcome.js" },
            { label: "Extra tools", path: "main-tools-extra/help", href: "/pages/extra-tools.js" }] },
        standalone: { items: [{ label: "Help", path: "help", href: "/pages/standalone.js" }] }
    };
    const selections = {
        root: { prefix: "", order: -1, menus: { navigation: "root" } },
        main: { prefix: "/main", order: 1, menus: { navigation: "main" } },
        tools: { prefix: "/main/tools", order: 2, menus: { navigation: "tools" } },
        standalone: { prefix: "/main-tools", menus: { navigation: "standalone" } }
    };
    const reversed = Object.fromEntries(Object.entries(selections).reverse());
    for (const [areasConfig, defaultArea, firstArea] of [[selections, "main", "main"], [reversed, "tools", "tools"], [reversed, null, "root"]]) {
        const { areas, menus } = context(definitions, areasConfig, defaultArea);
        menus.init();
        assert.equal(areas.getAreas()[0].id, firstArea);
        const getAreas = t.mock.method(areas, "getAreas");

        // A cross-Area organizational path is retained and only its navigable descendants are validated.
        const group = menus.getMenu("navigation", "main").items[1];
        assert.equal(group.path, "/main/tools/help");
        assert.equal(menus.resolvePath("/main/overview"), group.children[0]);
        for (const [path, owner, href] of [
            ["/welcome", "root", "/pages/welcome.js"],
            ["/main/status", "main", "/main/pages/status.js"],
            ["/main/tools/help", "tools", "/main/tools/pages/help.js"],
            ["/main-tools/help", "standalone", "/main-tools/pages/standalone.js"],
            ["/main-tools-extra/help", "root", "/pages/extra-tools.js"]
        ]) {
            assert.equal(areas.resolveAreaId(path), owner);
            const item = menus.resolvePath(path);
            assert.equal(item?.area, owner);
            assert.equal(item?.href, href);
        }
        assert.equal(menus.resolvePath("/main/tools/overview"), null);
        assert.equal(menus.resolvePath("/main/tools/help/"), null);
        assert.equal(menus.resolvePath("/global/help"), null);
        assert.equal(getAreas.mock.callCount(), 0);
    }
});

for (const nestedMenu of [true, false]) {
    test(`a parent alias fails ownership validation ${nestedMenu ? "with" : "without"} a matching nested alias`, () => {
        const { menus } = context({
            parent: { items: [{ label: "Group", children: [{ label: "Parent help", path: "tools/help", href: "/pages/parent.js" }] }] },
            nested: { items: [{ label: "Nested help", path: "help", href: "/pages/nested.js" }] }
        }, {
            tools: { prefix: "/main/tools", ...(nestedMenu ? { menus: { navigation: "nested" } } : {}) },
            main: { prefix: "/main", menus: { navigation: "parent" } }
        });
        assert.throws(() => menus.init(), /Area 'main' menu slot 'navigation' exposes path '\/main\/tools\/help', which belongs to Area 'tools'/);
        assert.equal(menus.getMenu("navigation", "tools"), null);
        assert.equal(menus.getMenu("navigation", "main"), null);
    });
}

test("a root Area cannot expose aliases owned by a more specific Area or reserved for global navigation", () => {
    const selections = { root: { prefix: "", menus: { navigation: "root" } }, main: { prefix: "/main" } };
    for (const [path, error] of [
        ["/main/help", /Area 'root' menu slot 'navigation' exposes path '\/main\/help', which belongs to Area 'main'/],
        ["/global/help", /Area 'root' menu slot 'navigation' exposes path '\/global\/help', which does not belong to any Area/]
    ]) {
        const { menus } = context({ root: { items: [{ label: "Help", path, href: "/pages/help.js" }] } }, selections);
        assert.throws(() => menus.init(), error);
    }
});

test("a registered root source cannot expose an alias owned by another Area at startup", () => {
    const { menus } = context({ local: { sources: [{ source: "live" }] } }, {
        main: { prefix: "/main", menus: { navigation: "local" } },
        tools: { prefix: "/main/tools" }
    });
    menus.registerSource("live", { resolve: () => [{ label: "Help", path: "tools/help", href: "/pages/help.js" }] });
    assert.throws(() => menus.init(), /Area 'main' menu slot 'navigation' exposes path '\/main\/tools\/help', which belongs to Area 'tools'/);
});

test("a child source refresh that crosses an Area boundary preserves all snapshots and can be retried", () => {
    const { bus, menus } = context({
        live: { items: [{ label: "Group", childrenSource: "live" }] },
        tools: { items: [{ label: "Help", path: "help", href: "/pages/help.js" }] }
    }, {
        main: { prefix: "/main", menus: { navigation: "live" } },
        lab: { prefix: "/lab", menus: { navigation: "live" } },
        tools: { prefix: "/lab/tools", menus: { navigation: "tools" } }
    });
    let children = [{ label: "Status", path: "status", href: "/pages/status.js" }];
    const source = { resolve: () => children };
    menus.registerSource("live", source);
    let changes = 0;
    bus.addEventListener("xshell:menus:change", () => changes++);
    menus.init();
    const published = ["main", "lab", "tools"].map(id => menus.getMenu("navigation", id));
    const snapshots = published.map(menu => menu.items);

    // Main can accept this candidate, but Lab's projection would enter the nested Area.
    children = [{ label: "Other help", path: "tools/help", href: "/pages/other.js" }];
    assert.throws(() => source.refresh(), /Area 'lab' menu slot 'navigation' exposes path '\/lab\/tools\/help', which belongs to Area 'tools'/);
    published.forEach((menu, index) => assert.equal(menu.items, snapshots[index]));
    assert.equal(menus.resolvePath("/main/status"), snapshots[0][0].children[0]);
    assert.equal(menus.resolvePath("/lab/status"), snapshots[1][0].children[0]);
    assert.equal(menus.resolvePath("/lab/tools/help"), snapshots[2][0]);
    assert.equal(menus.resolvePath("/main/tools/help"), null);
    assert.equal(changes, 0);

    children = [{ label: "New status", path: "new-status", href: "/pages/status.js" }];
    assert.equal(source.refresh(), true);
    assert.equal(changes, 1);
    assert.equal(menus.resolvePath("/main/new-status"), published[0].items[0].children[0]);
    assert.equal(menus.resolvePath("/lab/new-status"), published[1].items[0].children[0]);
    assert.equal(menus.resolvePath("/lab/status"), null);
    assert.equal(menus.resolvePath("/lab/tools/help"), snapshots[2][0]);
});

test("a named source alias can collide with a nested static item in another slot", () => {
    const { menus } = context({
        local: { items: [{ label: "Group", children: [{ label: "Help", path: "help", href: "/pages/help.js?view=full" }] }] },
        tools: { sources: [{ source: "live" }] }
    }, {
        first: { prefix: "first", menus: { navigation: "local" } },
        main: { prefix: "main", menus: { navigation: "local", tools: "tools" } }
    });
    menus.registerSource("live", { resolve: () => [{ label: "Other help", path: "/help", href: "/pages/help.js?view=compact" }] });
    assert.throws(() => menus.init(), /Area 'main'.*'\/main\/help'.*'navigation'.*view=full.*'tools'.*view=compact/);
    assert.equal(menus.getMenu("navigation", "first"), null);
});

test("a child source collision preserves every previous snapshot and can be retried", () => {
    const { bus, menus } = context({
        local: { items: [{ label: "Group", childrenSource: "live" }] },
        tools: { items: [{ label: "Help", path: "help", href: "/pages/help.js" }] }
    }, {
        main: { prefix: "main", menus: { navigation: "local" } },
        lab: { prefix: "lab", menus: { navigation: "local", tools: "tools" } }
    });
    let children = [{ label: "Status", path: "status", href: "/pages/status.js" }];
    const source = { resolve: () => children };
    menus.registerSource("live", source);
    let changes = 0;
    bus.addEventListener("xshell:menus:change", () => changes++);
    menus.init();
    const main = menus.getMenu("navigation", "main");
    const lab = menus.getMenu("navigation", "lab");
    const mainItems = main.items;
    const labItems = lab.items;

    children = [{ label: "Other help", path: "help", href: "/pages/other.js" }];
    assert.throws(() => source.refresh(), /Area 'lab'.*'\/lab\/help'.*'navigation'.*other\.js.*'tools'.*help\.js/);
    assert.equal(main.items, mainItems);
    assert.equal(lab.items, labItems);
    assert.equal(menus.resolvePath("/main/status"), mainItems[0].children[0]);
    assert.equal(menus.resolvePath("/main/help"), null);
    assert.equal(menus.resolvePath("/lab/help"), menus.getMenu("tools", "lab").items[0]);
    assert.equal(changes, 0);

    children = [{ label: "Shared help", path: "help", href: "/pages/help.js" }];
    assert.equal(source.refresh(), true);
    assert.equal(changes, 1);
    assert.equal(menus.resolvePath("/main/help").href, "/main/pages/help.js");
    assert.equal(menus.resolvePath("/lab/help"), lab.items[0].children[0]);
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
