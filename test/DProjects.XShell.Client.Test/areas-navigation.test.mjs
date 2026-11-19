import assert from "node:assert/strict";
import test from "node:test";

import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Loader from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/loader.js";
import Navigation from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/navigation.js";
import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/resolver.js";
import moduleSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/module.schema.json" with { type: "json" };

test("Areas construction rejects an unknown configured module", () => {
    const config = { modules: {}, xshell: { assets: { basePath: "/_assets" } } };
    const options = { default: "admin", global: [], definitions: { admin: { modules: ["missing"] } } };

    assert.throws(() => new Areas({ config, bus: { addEventListener() {} } }, options), /Area 'admin' references unknown module 'missing'/);
});

test("documentation inventory menus keep Markdown page and index destinations", () => {
    const areas = new Areas({ config: { modules: {}, xshell: { assets: { basePath: "/_assets" } } }, bus: { addEventListener() {} } }, { default: null, definitions: {}, global: [] });
    const root = "/_assets/xshell-docs/pages";
    const files = ["index.md", "10-architecture/index.md", "10-architecture/100-services.md"].map(path => ({ path: `${root}/${path}` }));
    const menu = areas._createMenuFromModuleFiles(files, root, "Docs", [".js", ".html", ".md"], true);
    assert.equal(menu[0].href, `${root}/index.md`);
    assert.equal(menu[0].children[0].href, `${root}/10-architecture/index.md`);
    assert.equal(menu[0].children[0].children[0].href, `${root}/10-architecture/100-services.md`);
});

test("Areas identifies modules under a normalized multi-segment assets.basePath", () => {
    const config = { modules: {}, xshell: { assets: { basePath: "/virtual/assets" } } };
    const areas = new Areas({ config, bus: { addEventListener() {} } }, { default: null, definitions: {}, global: [] });
    assert.equal(areas.getModuleId("/demo/virtual/assets/x/pages/index.js"), "x");
    assert.equal(areas.getModuleId("/demo/virtual/assets/orders/1.4.0.a82c31f943e01abc/pages/index.js"), "orders");
    assert.equal(areas.getModuleId("/demo/_assets/x/pages/index.js"), null);
});

test("Areas preserve tooltip and embedded across effective menu projections", () => {
    const bus = { addEventListener() {}, emit() {} };
    const globalItem = {
        label: "Global",
        href: "/_assets/menu/pages/global.js",
        tooltip: "Global tooltip",
        embedded: true,
        children: [{ label: "Global child", href: "/_assets/menu/pages/global-child.js", tooltip: "Global child tooltip", embedded: true }]
    };
    const config = {
        modules: { menu: { menus: { shortcuts: [globalItem] } } },
        xshell: { assets: { basePath: "/_assets" } }
    };
    const module = {
        id: "menu",
        routes: {},
        config: {
            menus: {
                navigation: [{
                    label: "Reports",
                    href: "/_assets/menu/pages/reports.js",
                    tooltip: "Reports tooltip",
                    embedded: true,
                    children: [{ label: "Detail", href: "/_assets/menu/pages/detail.js", tooltip: "Detail tooltip", embedded: true }]
                }],
                dynamic: [{ label: "Dynamic parent", childrenSource: "dynamic-children" }]
            }
        }
    };
    const dynamicItems = [{ label: "Dynamic child", href: "/_assets/menu/pages/dynamic.js", tooltip: "Dynamic tooltip", embedded: true }];
    const areas = new Areas({ config, bus }, { default: "main", global: ["shortcuts"], definitions: { main: { prefix: "/main", modules: ["menu"] } } });
    areas.registerSource("dynamic-children", { resolve() { return dynamicItems; } });
    areas.init({ modules: { getModuleById(id) { return id === module.id ? module : null; } } });

    const report = areas.getMenu("navigation", "main")[0];
    assert.equal(report.tooltip, "Reports tooltip");
    assert.equal(report.embedded, true);
    assert.equal(report.children[0].tooltip, "Detail tooltip");
    assert.equal(report.children[0].embedded, true);

    const dynamic = areas.getMenu("dynamic", "main")[0].children[0];
    assert.equal(dynamic.tooltip, "Dynamic tooltip");
    assert.equal(dynamic.embedded, true);

    const global = areas.getGlobalMenu("shortcuts")[0];
    assert.equal(global.tooltip, "Global tooltip");
    assert.equal(global.embedded, true);
    assert.equal(global.children[0].tooltip, "Global child tooltip");
    assert.equal(global.children[0].embedded, true);

    const breadcrumb = areas.getMenuitemBreadcrumb("/main/_assets/menu/pages/detail.js", "main");
    assert.deepEqual(breadcrumb.map(item => item.embedded), [true, true]);
});

function createMenuContext(modules, { global = [], moduleOrder = Object.keys(modules) } = {}) {
    const bus = new EventTarget();
    bus.emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
    const config = { modules, xshell: { assets: { basePath: "/_assets" } } };
    const areas = new Areas({ config, bus }, { global, default: "main", definitions: { main: { prefix: "/main/", modules: moduleOrder } } });
    const init = () => areas.init({ modules: { getModuleById: id => ({ id, config: modules[id] }) } });
    return { areas, bus, init };
}

test("global menus merge raw sibling definitions in configuration order and keep the first positions", () => {
    const base = Object.freeze([
        Object.freeze({ id: "settings", label: "Settings", icon: "x-settings", href: "/_assets/base/settings.js" }),
        { label: "One" },
        { id: "", label: "Empty one" },
        { id: "actions", label: "Actions", tooltip: "Old", embedded: true, default: true, open: "dock", class: "old", command: "old" }
    ]);
    const override = [
        { id: "settings", label: "Preferences" },
        { id: "actions", tooltip: null, embedded: false, default: false, open: null, class: "", command: "" },
        { id: "new", label: "New" },
        { label: "Two" },
        { id: "", label: "Empty two" },
        { id: "new", label: "Newest", href: "/_assets/addon/new.js" }
    ];
    const { areas } = createMenuContext({ base: { menus: { shortcuts: base } }, addon: { menus: { shortcuts: override } } },
        { global: ["shortcuts"], moduleOrder: ["addon", "base"] });
    const items = areas.getGlobalMenu("shortcuts");
    assert.deepEqual(items.map(item => item.label), ["Preferences", "One", "Empty one", "Actions", "Newest", "Two", "Empty two"]);
    const [settings, , , actions, newest] = items;
    assert.equal(settings.id, "settings");
    assert.equal(settings.icon, "x-settings");
    assert.equal(settings.href, "/_assets/base/settings.js");
    assert.equal(settings.module, "base");
    assert.equal(Object.hasOwn(settings, "area"), false);
    assert.equal(newest.module, "addon");
    assert.deepEqual([actions.tooltip, actions.embedded, actions.default, actions.open, actions.class, actions.command], [null, false, false, null, "", ""]);
    assert.ok(Object.isFrozen(items) && Object.isFrozen(settings) && Object.isFrozen(settings.children));
    assert.equal(base[0].label, "Settings");
    assert.deepEqual(override[0], { id: "settings", label: "Preferences" });
});

test("global and Area menus sort each sibling array stably after merging order overrides", () => {
    const href = "/_assets/base/pages/theme.js";
    const base = Object.freeze([
        { id: "settings", label: "Settings", order: 100, children: Object.freeze([
            { id: "theme", label: "Theme", order: 3, path: "theme", href, children: Object.freeze([
                { label: "Last", order: 7 }, { label: "First", order: -1 }
            ]) },
            { id: "language", label: "Language", order: -2 },
            { label: "Default child order" }
        ]) },
        { label: "Zulu unordered" }, { label: "Last top-level item", order: 20 }
    ]);
    const addon = [
        { id: "settings", order: 0.5, children: [{ id: "theme", order: 0 }, { id: "language", icon: "language" }] },
        { label: "Alpha zero", order: 0 }, { label: "Alpha fractional", order: 0.5 }, { label: "Negative", order: -10 }
    ];
    const originals = structuredClone([base, addon]);
    const { areas, init } = createMenuContext({ base: { menus: { preferences: base } }, addon: { menus: { preferences: addon } } },
        { global: ["preferences"] });
    init();

    // Check sibling ordering, ties across contributions, and the normalized values.
    for (const items of [areas.getGlobalMenu("preferences"), areas.getMenu("preferences")]) {
        assert.deepEqual(items.map(item => item.label), ["Negative", "Zulu unordered", "Alpha zero", "Settings", "Alpha fractional", "Last top-level item"]);
        assert.deepEqual(items.map(item => item.order), [-10, 0, 0, 0.5, 0.5, 20]);
        const { children } = items[3];
        assert.deepEqual(children.map(item => item.label), ["Language", "Theme", "Default child order"]);
        assert.deepEqual(children.map(item => item.order), [-2, 0, 0]);
        assert.deepEqual(children[1].children.map(item => item.label), ["First", "Last"]);
        assert.ok(Object.isFrozen(items) && Object.isFrozen(items[3]) && Object.isFrozen(children));
    }
    assert.deepEqual([base, addon], originals);
    assert.equal(areas.resolvePath("/main/theme").href, "/main" + href);
    assert.deepEqual(areas.getMenuitemBreadcrumb("/main" + href).map(item => item.label), ["Settings", "Theme"]);
});

test("Area menu ordering includes inventory and named source contributions", () => {
    const root = "/_assets/docs/pages";
    const { areas, init } = createMenuContext({
        links: { menus: { navigation: [{ label: "Last", order: 2 }] } },
        docs: { label: "Docs", menus: { navigation: root }, files: ["20-alpha.md", "zulu.md", "01-beta.md"].map(path => ({ path: `${root}/${path}` })) },
        runtime: { menus: { navigation: "runtime-links" } }
    });
    areas.registerSource("runtime-links", { resolve: () => [{ label: "Middle", order: 1 }, { label: "First", order: -1 }] });
    init();

    const items = areas.getMenu("navigation");
    assert.deepEqual(items.map(item => item.label), ["First", "Docs", "Middle", "Last"]);
    assert.deepEqual(items[1].children.map(item => item.label), ["Beta", "Alpha", "Zulu"]);
});

test("menu definitions merge objects and other arrays recursively before projection", () => {
    const { areas } = createMenuContext({});
    const items = areas._mergeMenuitems([], [
        { id: "item", options: { count: 1, enabled: true, tags: ["first"], entries: [{ id: "entry", label: "First", value: 10 }] } },
        { id: "item", options: { count: 2, tags: ["second"], entries: ["unnamed", { id: "entry", label: "Last" }] } }
    ]);
    assert.deepEqual(items, [{ id: "item", options: {
        count: 2, enabled: true, tags: ["first", "second"], entries: [{ id: "entry", label: "Last", value: 10 }, "unnamed"]
    } }]);
});

test("Area menus merge descendants within each parent and resolve the winning canonical target", () => {
    const oldHref = "/_assets/base/pages/theme.js";
    const newHref = "/_assets/addon/pages/theme.js";
    const menus = {
        base: { navigation: [
            { id: "settings", label: "Settings", icon: "x-settings", children: [
                { id: "appearance", label: "Appearance", path: "appearance", href: oldHref, default: true,
                    children: [{ id: "contrast", label: "Contrast", icon: "contrast" }] },
                { id: "language", label: "Language", href: "/_assets/base/pages/language.js" }
            ] },
            { id: "other", label: "Other", children: [{ id: "appearance", label: "Other appearance" }] }
        ], shortcuts: [{ id: "settings", label: "Settings shortcut" }] },
        addon: { navigation: [
            { id: "settings", label: "Application settings", children: [
                { id: "appearance", label: "Theme", path: "theme", href: newHref, open: "dock", children: [{ id: "contrast", label: "High contrast" }] },
                { id: "advanced", label: "Advanced" }
            ] },
            { id: "settings", tooltip: "Application settings" }
        ] }
    };
    const originals = structuredClone(menus);
    Object.freeze(menus.base.navigation[0].children[0].children[0]);
    Object.freeze(menus.base.navigation[0].children);
    const { areas, init } = createMenuContext({ addon: { menus: menus.addon }, base: { menus: menus.base } }, { moduleOrder: ["base", "addon"] });
    init();
    const [settings, other] = areas.getMenu("navigation");
    assert.deepEqual([settings.label, settings.icon, settings.tooltip], ["Application settings", "x-settings", "Application settings"]);
    assert.deepEqual(settings.children.map(item => item.label), ["Theme", "Language", "Advanced"]);
    const [theme, language] = settings.children;
    assert.equal(theme.children[0].label, "High contrast");
    assert.equal(theme.children[0].icon, "contrast");
    assert.equal(other.children[0].label, "Other appearance");
    assert.equal(areas.getMenu("shortcuts")[0].label, "Settings shortcut");
    assert.equal(theme.open, "dock");
    assert.equal(theme.module, "addon");
    assert.equal(language.module, "base");
    assert.equal(theme.area, "main");
    assert.equal(areas.getArea("main").home, "/main/theme");
    assert.equal(areas.resolvePath("/main/appearance"), null);
    assert.equal(areas.resolvePath("/main/theme"), theme);
    assert.equal(areas.resolveHref(oldHref), null);
    assert.equal(areas.resolveHref(newHref + "?view=compact#top"), theme);
    assert.deepEqual(areas.getMenuitemBreadcrumb("/main" + newHref).map(item => item.label), ["Application settings", "Theme"]);
    const navigation = createNavigation({ areas });
    assert.equal(navigation.buildUrlAbsolute({ href: newHref }), "/main/theme");
    assert.equal(navigation._buildUrlFinal(navigation.parseUrl("/main/theme")), "/main" + newHref);
    assert.deepEqual(menus, originals);
});

test("refresh merges live children into the static baseline and updates nested source registrations", () => {
    const { areas, bus, init } = createMenuContext({
        base: { menus: { navigation: [{ id: "settings", label: "Settings", href: "/_assets/base/settings.js", childrenSource: "obsolete",
            children: [
                { id: "theme", label: "Theme", order: 0.5, href: "/_assets/base/theme.js",
                    children: [{ id: "details", label: "Details", order: 2 }, { label: "Overview" }] },
                { label: "Static", childrenSource: "persistent" }
            ] }] } },
        addon: { menus: { navigation: [{ id: "settings", childrenSource: "settings-children" }] } },
        extra: { menus: { navigation: "named-menu" } }
    });
    let dynamic = [
        { id: "theme", label: "Live theme", order: -2, href: "/_assets/addon/live-theme.js" },
        { id: "live", label: "Live", order: -1 },
        { id: "live", icon: "live-icon", childrenSource: "nested" }
    ];
    let nested = [{ label: "First nested" }];
    let persistent = [{ label: "Persistent" }];
    const source = { dependsOn: ["settings:refresh"], resolve: () => dynamic };
    const nestedSource = { resolve: () => nested };
    const persistentSource = { resolve: () => persistent };
    const namedSource = { resolve: () => [{ id: "settings", icon: "x-settings" }] };
    areas.registerSource("settings-children", source);
    areas.registerSource("nested", nestedSource);
    areas.registerSource("persistent", persistentSource);
    areas.registerSource("named-menu", namedSource);
    let changes = 0;
    bus.addEventListener("xshell:menus:change", () => changes++);
    init();

    const [settings] = areas.getMenu("navigation");
    const children = settings.children;
    assert.equal(settings.module, "base");
    assert.equal(settings.icon, "x-settings");
    assert.ok(Object.isFrozen(settings) && !Object.isFrozen(children) && Object.isFrozen(children[0]));
    assert.deepEqual(children.map(item => item.label), ["Live theme", "Live", "Static"]);
    const [liveTheme, live, staticItem] = children;
    assert.equal(liveTheme.module, "addon");
    assert.deepEqual(liveTheme.children.map(item => item.label), ["Overview", "Details"]);
    assert.equal(areas.resolveHref("/_assets/addon/live-theme.js"), liveTheme);
    assert.equal(live.children[0].module, "addon");
    assert.equal(live.icon, "live-icon");
    assert.equal(source.refresh(), false);
    nested = [{ label: "Second nested" }];
    assert.equal(nestedSource.refresh(), true);
    assert.equal(live.children[0].label, "Second nested");
    assert.equal(namedSource.refresh(), false);

    dynamic = [];
    bus.emit("settings:refresh");
    assert.equal(changes, 1);
    assert.equal(settings.children, children);
    assert.deepEqual(children.map(item => item.label), ["Static", "Theme"]);
    assert.equal(children[0], staticItem);
    assert.equal(children[1].module, "base");
    assert.equal(children[1].order, 0.5);
    assert.equal(areas.resolveHref("/_assets/addon/live-theme.js"), null);
    assert.equal(areas.resolveHref("/_assets/base/theme.js"), children[1]);
    assert.equal(liveTheme.label, "Live theme");
    assert.equal(liveTheme.module, "addon");
    assert.equal(liveTheme.order, -2);
    nested = [{ label: "Detached" }];
    assert.equal(nestedSource.refresh(), false);
    bus.emit("settings:refresh");
    assert.equal(changes, 1);

    // Restore an override and make a nested tie use the original static declaration order.
    dynamic = [{ id: "theme", order: -1, children: [{ id: "details", order: 0 }] }];
    bus.emit("settings:refresh");
    assert.equal(changes, 2);
    assert.deepEqual(children.map(item => item.label), ["Theme", "Static"]);
    assert.deepEqual(children[0].children.map(item => item.label), ["Details", "Overview"]);
    assert.equal(children[1], staticItem);
    persistent = [{ label: "Later", order: 1 }, { label: "Earlier", order: -1 }];
    assert.equal(persistentSource.refresh(), true);
    assert.deepEqual(staticItem.children.map(item => item.label), ["Earlier", "Later"]);
    bus.emit("settings:refresh");
    assert.equal(changes, 2);
});

test("menu schema permits identified partial contributions and composition requires effective labels", () => {
    const validator = new JsonValidator();
    const schema = { $ref: "#/$defs/menuItem", $defs: { menuItem: moduleSchema.$defs.menuItem } };
    const group = { id: "root", children: [{ label: "Diagnostics", open: "dock" }] };
    const partial = { id: "settings", icon: "new-icon", open: null };
    assert.equal(validator.validate(partial, schema).valid, true);
    assert.equal(validator.validate(group, schema).valid, true);
    assert.equal(validator.validate({ icon: "new-icon" }, schema).valid, false);
    assert.equal(validator.validate({ ...partial, id: "" }, schema).valid, false);
    assert.equal(validator.validate({ ...partial, label: null }, schema).valid, false);
    assert.equal(validator.validate({ ...partial, description: "Unsupported" }, schema).valid, false);
    for (const order of [10, 0, -5, 0.5]) {
        assert.equal(validator.validate({ ...partial, order }, schema).valid, true);
    }
    for (const order of ["10", true, null]) {
        assert.equal(validator.validate({ ...partial, order }, schema).valid, false);
        assert.equal(validator.validate({ ...group, children: [{ label: "Invalid order", order }] }, schema).valid, false);
    }

    const builtin = { menus: { shortcuts: [{ id: "root", label: "", icon: "x-more-vert", children: [{ label: "Preferences" }] }] } };
    const addon = { menus: { shortcuts: [group] } };
    const { areas, init } = createMenuContext({ builtin, addon }, { global: ["shortcuts"], moduleOrder: ["addon"] });
    init();
    const [global] = areas.getGlobalMenu("shortcuts");
    assert.equal(global.icon, "x-more-vert");
    assert.deepEqual(global.children.map(item => item.label), ["Preferences", "Diagnostics"]);
    assert.equal(areas.getMenu("shortcuts")[0].label, "");

    const invalid = { menus: { shortcuts: [partial] } };
    assert.throws(() => createMenuContext({ invalid }, { global: ["shortcuts"] }), /Global menu item 'settings'.*requires a string label/);
    assert.throws(() => createMenuContext({ invalid }).init(), /Area 'main' item 'settings'.*requires a string label/);
});

function createAreas() {
    const bus = {
        addEventListener() {},
        emit() {}
    };
    const config = { modules: { customer: {}, shell: {}, "x-demo": {} }, xshell: { assets: { basePath: "/_assets" } } };
    const options = {
        default: "sales",
        global: [],
        definitions: {
            sales: { prefix: "/sales", modules: ["customer"] },
            admin: { prefix: "/admin", modules: ["customer"] },
            main: { prefix: "/main", modules: ["shell"] },
            demo: { prefix: "/demo", modules: ["x-demo"] }
        }
    };
    const module = {
        id: "customer",
        routes: {
            "/customer/{customerId}": "/_assets/customer/pages/detail.js",
            "/customer-route/{customerId}": "/_assets/customer/pages/route-detail.js"
        },
        config: {
            menus: {
                navigation: [{
                    label: "Customers",
                    children: [{ label: "Detail", path: "/detail", href: "/_assets/customer/pages/detail.js" }]
                }],
                tools: [{ label: "Tool detail", path: "/tool-detail", href: "/_assets/customer/pages/tool-detail.js" }],
                canonical: [{ label: "Canonical only", href: "/_assets/customer/pages/canonical.js" }]
            }
        }
    };
    const demoModule = {
        id: "x-demo",
        routes: {
            "/something": "/_assets/x-demo/pages/about.js",
            "/repository/{repositoryId}": "/_assets/x-demo/pages/repository.js?mode=list",
            "/repository/{repositoryId}/projects/{projectId}/items": "/_assets/x-demo/pages/items.js",
            "/repository/{repositoryId}/items": "/_assets/x-demo/pages/items.js",
            "/navigation": "/_assets/x-demo/pages/route-navigation.js",
            "/navigation-route": "/_assets/x-demo/pages/03-navigation/index.js"
        },
        config: { menus: { navigation: "demo-runtime-menu-source" } }
    };
    const shellModule = { id: "shell", config: { menus: {} } };
    const areas = new Areas({ config, bus }, options);
    areas.registerSource("demo-runtime-menu-source", {
        resolve() {
            return [{
                label: "Demo",
                path: "/",
                href: "/_assets/x-demo/pages/index.js",
                children: [{ label: "Navigation", path: "/navigation", href: "/_assets/x-demo/pages/03-navigation/index.js" }]
            }];
        }
    });
    const modules = new Map([[module.id, module], [demoModule.id, demoModule], [shellModule.id, shellModule]]);
    areas.init({ modules: { getModuleById(id) { return modules.get(id) || null; } } });
    return areas;
}

function createNavigation({ areas = createAreas(), mode = "path", basePath = "", baseUrl = "https://example.test/",
    resolver = null, assetsBasePath = "/_assets" } = {}) {
    return new Navigation({
        areas,
        bus: { emit() {} },
        config: {
            app: { basePath, baseUrl },
            xshell: { assets: { basePath: assetsBasePath } }
        },
        resolver
    }, { mode }, { container: { querySelectorAll() { return []; } } });
}

function createPageResolver() {
    return new Resolver({ config: {
        app: { basePath: "/app", baseUrl: "https://example.test/app/" },
        xshell: { resolver: { page: {
            "x-demo:/{path}": { src: "/_assets/x-demo/{path}", loader: "page-js" },
            "x:/{path}": { src: "/_assets/x/{path}", loader: "page-js" }
        } } }
    }});
}

function createEmbedPage(src) {
    // Capture src assignments to the named outlet.
    const outlet = { setAttribute(name, value) { this[name] = value; } };
    const host = {
        setAttribute(name, value) { this[name] = value; },
        querySelector(selector) { return selector === 'x-page[outlet="content"]' ? outlet : null; }
    };
    return { page: { src, host }, outlet };
}

test("Navigation resolves Page resources through Resolver into public URLs in path and hash modes", () => {
    const href = "page:x-demo:/pages/items.js?repositoryId=12#details";
    const page = { src: "/demo/_assets/x-demo/pages/origin.js" };
    for (const mode of ["path", "hash"]) {
        const navigation = createNavigation({ mode, basePath: "/app", resolver: createPageResolver() });
        const prefix = mode === "hash" ? "/app/#!" : "/app";
        assert.equal(navigation._resolveCanonicalHref(href, page), "/demo/_assets/x-demo/pages/items.js?repositoryId=12#details");
        assert.equal(navigation.buildUrlAbsolute({ href, page, params: { sort: "name" } }), `${prefix}/demo/repository/12/items?sort=name#details`);
        assert.equal(navigation.buildUrlAbsolute({ href: "page:x-demo:/pages/about.js", page }), `${prefix}/demo/something`);
        assert.equal(navigation.buildUrlAbsolute({ href: "page:x:/pages/secrets-manager.js", page }), `${prefix}/demo/_assets/x/pages/secrets-manager.js`);
        assert.equal(navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/about.js", page }), `${prefix}/demo/something`);
        assert.equal(navigation.buildUrlAbsolute({ href: "relative.js", page }), `${prefix}/demo/_assets/x-demo/pages/relative.js`);
        for (const external of ["https://example.com", "mailto:user@example.com", "tel:+123456789", "custom:outside"]) {
            assert.equal(navigation.buildUrlAbsolute({ href: external, page }), external);
        }
    }
});

test("Navigation rejects unresolved Page references before generating a browser URL", () => {
    const navigation = createNavigation({ resolver: createPageResolver() });
    assert.throws(() => navigation.buildUrlAbsolute({ href: "page:missing:/pages/index.js" }), /unable to resolve Page reference/);
    assert.throws(() => navigation.buildUrlAbsolute({ href: "page:x-demo:/../index.js" }), /unable to resolve Page reference/);
});

test("Navigation opens resolved Page resources in stack and dialog modes", async () => {
    const navigation = createNavigation({ resolver: createPageResolver() });
    const page = { src: "/demo/_assets/x-demo/pages/origin.js" };
    let stack;
    let dialog;
    navigation._stackToBrowser = async value => { stack = value; };
    navigation._showDialog = async value => { dialog = value; };
    await navigation.navigate({ href: "page:x-demo:/pages/items.js", params: { repositoryId: "12" }, page, open: "stack" });
    assert.deepEqual(stack[0].params, { repositoryId: "12" });
    assert.equal(stack[0].href, "/demo/_assets/x-demo/pages/items.js");
    await navigation.navigate({ href: "page:x-demo:/pages/about.js", page, open: "dialog" });
    assert.equal(dialog.href, "/demo/_assets/x-demo/pages/about.js");
});

test("Navigation embeds explicit asset and Page references while retaining relative, menu and route destinations", async () => {
    const asset = "/_assets/x/0.9.0.dev/pages/about.js";
    const { page, outlet } = createEmbedPage("/main/_assets/shell/0.9.0.dev/pages/origin.js");
    const { page: unprefixedPage, outlet: unprefixedOutlet } = createEmbedPage("/_assets/x-demo/pages/03-navigation/origin.js");
    for (const mode of ["path", "hash"]) {
        for (const basePath of ["/", "/app"]) {
            const navigation = createNavigation({ mode, basePath, resolver: createPageResolver() });
            const appPrefix = basePath === "/" ? "" : basePath;
            const browserPrefix = appPrefix + (mode === "hash" ? "/#!" : "");
            const suffix = "?filter=all%20items#summary";
            const cases = [
                [asset, asset],
                [`/main${asset}`, `/main${asset}`],
                [`#!${asset}#summary`, `${asset}#summary`],
                [`${appPrefix}${asset}${suffix}`, `${asset}?filter=all%20items&sort=name#summary`, { sort: "name" }],
                [`${appPrefix}/main${asset}${suffix}`, `/main${asset}${suffix}`],
                ["page:x-demo:/pages/about.js?filter=all#summary", "/_assets/x-demo/pages/about.js?filter=all#summary"],
                ["relative.js?filter=all#summary", "/main/_assets/shell/0.9.0.dev/pages/relative.js?filter=all#summary"],
                ["/demo/navigation", "/demo/_assets/x-demo/pages/03-navigation/index.js"],
                ["/demo/repository/12?sort=name#summary", "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12&sort=name#summary"]
            ];
            for (const [href, expected, params] of cases) {
                outlet.src = null;
                await navigation.navigate({ href, params, page, open: "embed", outlet: "content" });
                assert.equal(outlet.src, expected, `${mode} ${basePath} ${href}`);
            }

            // Relative destinations continue to find an Area through the menu of an unprefixed originating Page.
            await navigation.navigate({ href: "index.js", page: unprefixedPage, open: "embed", outlet: "content" });
            assert.equal(unprefixedOutlet.src, "/demo/_assets/x-demo/pages/03-navigation/index.js");
            assert.deepEqual(navigation.stack, []);
            assert.equal(navigation.buildUrlAbsolute({ href: asset, page, open: "embed" }), `${browserPrefix}/main${asset}`);
            assert.equal(navigation.buildUrlAbsolute({ href: "page:x-demo:/pages/about.js", page, open: "embed" }), `${browserPrefix}/demo/something`);
        }
    }
});

test("Navigation keeps canonical asset destinations Area-aware in top, stack, auto and dialog modes", async () => {
    const navigation = createNavigation();
    const href = "/_assets/x/0.9.0.dev/pages/about.js?view=all#summary";
    const { page } = createEmbedPage("/main/_assets/shell/0.9.0.dev/pages/origin.js");
    const expected = "/main" + href;
    navigation._stack = [navigation.parseUrl(page.src)];
    navigation._stackToBrowser = async stack => { navigation._stack = stack; };
    navigation._showDialog = async ({ href }) => href;

    await navigation.navigate({ href, page, open: "stack" });
    assert.deepEqual(navigation.stack, [navigation.parseUrl(page.src), navigation.parseUrl(expected)]);
    await navigation.navigate({ href, page, open: "top" });
    assert.deepEqual(navigation.stack, [navigation.parseUrl(expected)]);
    assert.equal(await navigation.navigate({ href, page, open: "dialog" }), expected);
    await navigation.navigate({ href, page });
    assert.equal(page.host.src, expected);
});

test("Embedded x-page loads the same canonical resource with or without an Area prefix", async t => {
    // Supply the DOM operations used by x-page and forward src changes through its attribute callback.
    globalThis.HTMLElement = class extends EventTarget {
        attachShadow() { this.shadowRoot = { appendChild(node) { this.firstChild = node; } }; }
        setAttribute(name, value) { if (name === "src") this.attributeChangedCallback(name, null, value); }
    };
    globalThis.CSSStyleSheet = class { replaceSync() {} };
    globalThis.customElements = { define() {} };
    globalThis.document = { createElement(localName) { return { localName, setAttribute() {}, removeAttribute() {} }; } };
    t.after(() => {
        for (const key of ["HTMLElement", "CSSStyleSheet", "customElements", "document"]) delete globalThis[key];
    });
    const { default: XPage } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/x-page.js");
    const { default: xshell } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/xshell.js");

    // Resolve real resource URLs and replace only the concrete layout and Page implementations.
    const asset = "/_assets/customer/pages/detail.js";
    const loader = `data:text/javascript,${encodeURIComponent("export default class { async load() { return class { async load() {} async mount() {} }; } }")}`;
    const config = {
        app: { basePath: "/app", baseUrl: "https://example.test/app/" },
        xshell: {
            ui: { layouts: { embed: "test-layout" } },
            resolver: {
                layout: { "test-layout": { src: "/layout.js", loader } },
                page: { [asset]: { src: asset, loader } }
            }
        }
    };
    const bus = { emit() {} };
    const areas = createAreas();
    const resolver = new Resolver({ config });
    const navigation = createNavigation({ areas, resolver, basePath: config.app.basePath });
    const resourceLoader = new Loader({ bus, resolver }, {});
    const services = { areas, navigation, modules: { resolveModuleId: href => areas.getModuleId(href) } };
    Object.assign(xshell, { _config: config, _bus: bus, _loader: resourceLoader, _services: { resolve: name => services[name] } });

    for (const [prefix, breadcrumbPath] of [["", null], ["/sales", "/sales/detail"]]) {
        const outlet = new XPage();
        const page = { src: "/sales/_assets/customer/pages/origin.js", host: { querySelector() { return outlet; } } };
        const href = `${prefix}${asset}?view=all#summary`;
        await navigation.navigate({ href, page, open: "embed", outlet: "content" });
        assert.equal(outlet.src, href);
        await outlet.load();
        assert.equal(outlet.status, "loaded");
        assert.equal(outlet.breadcrumb?.at(-1)?.path ?? null, breadcrumbPath);
        const { resource, path, url, status } = resourceLoader.registry.at(-1);
        assert.deepEqual({ resource, path, url, status }, {
            resource: `page:${asset}?view=all#summary`, path: asset, url: `https://example.test/app${asset}`, status: "loaded"
        });
    }
});

test("Navigation.init preserves path-mode fragments on load and popstate without changing root home selection", async (t) => {
    const areas = createAreas();
    const location = { pathname: "/app/demo/repository/12", search: "?sort=name", hash: "#summary" };
    const pushedUrls = [];
    let onPopstate;
    globalThis.document = { location };
    globalThis.window = { addEventListener(type, listener) { if (type === "popstate") onPopstate = listener; } };
    globalThis.history = { pushState(state, title, url) { pushedUrls.push(url); } };
    t.after(() => {
        delete globalThis.document;
        delete globalThis.window;
        delete globalThis.history;
    });

    const navigation = createNavigation({ areas, basePath: "/app" });
    navigation._stackToDom = async () => {};
    await navigation.init();
    assert.equal(navigation.stack[0].href, "/demo/repository/12#summary");
    assert.deepEqual(navigation.stack[0].params, { sort: "name" });
    assert.equal(navigation._buildUrlFinal(navigation.stack[0]), "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12&sort=name#summary");

    location.pathname = "/app/sales/detail";
    location.search = "?customer=42";
    location.hash = "#actions";
    await onPopstate();
    assert.equal(navigation.stack[0].href, "/sales/detail#actions");
    assert.deepEqual(navigation.stack[0].params, { customer: "42" });
    assert.equal(navigation._buildUrlFinal(navigation.stack[0]), "/sales/_assets/customer/pages/detail.js?customer=42#actions");

    for (const pathname of ["/app", "/app/"]) {
        location.pathname = pathname;
        location.search = "";
        location.hash = "#section";
        const rootNavigation = createNavigation({ areas, basePath: "/app" });
        rootNavigation._stackToDom = async () => {};
        await rootNavigation.init();
        assert.equal(rootNavigation.stack[0].href, areas.getDefaultArea().home);
    }
    assert.equal(pushedUrls.length, 2);
});

function createSharedRouteContext({ definitions, defaultArea, mode = "path", basePath = "", baseUrl = "https://example.test/", assetsBasePath = "/_assets",
    routes = { "/repository/{repositoryId}/items": "/_assets/shared/pages/items.js" } }) {
    const config = { modules: { shared: {} }, xshell: { assets: { basePath: assetsBasePath } } };
    const module = {
        id: "shared",
        routes,
        config: { menus: {} }
    };
    const areas = new Areas({ config, bus: { addEventListener() {}, emit() {} } }, { default: defaultArea, global: [], definitions });
    areas.init({ modules: { getModuleById(id) { return id === module.id ? module : null; } } });
    return { areas, navigation: createNavigation({ areas, mode, basePath, baseUrl, assetsBasePath }), module };
}

test("Navigation embeds explicit asset paths even when a route matches the configured asset namespace", async () => {
    const { navigation } = createSharedRouteContext({
        defaultArea: "main",
        definitions: { main: { prefix: "/main", modules: ["shared"] }, root: { prefix: "/", modules: ["shared"] } },
        assetsBasePath: "/resources/assets",
        routes: { "/resources/{section}/{module}/{folder}/{file}": "/resources/assets/shared/pages/fallback.js" }
    });
    const href = "/resources/assets/shared/pages/about.js";
    const { page, outlet } = createEmbedPage("/main/resources/assets/shared/pages/origin.js");

    for (const prefix of ["", "/main"]) {
        const target = prefix + href;
        assert.equal(navigation.resolveRoute(target).target, "/resources/assets/shared/pages/fallback.js");
        await navigation.navigate({ href: target, page, open: "embed", outlet: "content" });
        assert.equal(outlet.src, target);
    }

    await navigation.navigate({ href: href.replace("/assets/", "/assets-other/"), page, open: "embed", outlet: "content" });
    assert.equal(outlet.src, "/main/resources/assets/shared/pages/fallback.js?section=assets-other&module=shared&folder=pages&file=about.js");
});

function createNoRouteContext() {
    const config = { modules: { empty: {} }, xshell: { assets: { basePath: "/_assets" } } };
    const module = { id: "empty", config: { menus: {} } };
    const areas = new Areas({ config, bus: { addEventListener() {}, emit() {} } }, {
        default: "empty", global: [], definitions: { empty: { prefix: "/empty", modules: ["empty"] } }
    });
    areas.init({ modules: { getModuleById(id) { return id === module.id ? module : null; } } });
    return { areas, navigation: createNavigation({ areas }) };
}

test("Areas.resolveHref searches recursively across selected Area menus and ignores query and fragment", () => {
    const areas = createAreas();

    assert.equal(areas.resolveHref("/sales/_assets/customer/pages/detail.js?customer=42#summary", "sales")?.path, "/sales/detail");
    assert.equal(areas.resolveHref("/sales/_assets/customer/pages/tool-detail.js#actions", "sales")?.path, "/sales/tool-detail");
    assert.equal(areas.resolveHref("/sales/_assets/customer/pages/missing.js", "sales"), null);
});

test("Areas compose route descriptors in Area module and declaration order", () => {
    const areas = createRouteAreas();

    assert.deepEqual(areas.getArea("combined").routes, [
        { path: "/items", href: "/_assets/first/pages/items.js", module: "first" },
        { path: "/repository/{repositoryId}", href: "/_assets/first/pages/repository.js", module: "first" },
        { path: "/items", href: "/_assets/second/pages/items.js", module: "second" },
        { path: "/settings", href: "/_assets/second/pages/settings.js", module: "second" }
    ]);
});

test("Areas preserve route ownership and participation across multiple Areas", () => {
    const areas = createRouteAreas();

    assert.deepEqual(areas.getArea("first-only").routes, [
        { path: "/items", href: "/_assets/first/pages/items.js", module: "first" },
        { path: "/repository/{repositoryId}", href: "/_assets/first/pages/repository.js", module: "first" }
    ]);
    assert.deepEqual(areas.getArea("outsider-only").routes, [
        { path: "/outsider", href: "/_assets/outsider/pages/index.js", module: "outsider" }
    ]);
    assert.equal(areas.getArea("combined").routes.some(route => route.module === "outsider"), false);
});

test("Area routes are immutable and do not apply the Area prefix", () => {
    const areas = createRouteAreas();
    const area = areas.getArea("combined");

    assert.equal(Object.isFrozen(area.routes), true);
    assert.equal(Object.isFrozen(area.routes[0]), true);
    assert.equal(area.routes[0].path, "/items");
    assert.equal(area.routes[0].href, "/_assets/first/pages/items.js");
});

test("Navigation forward ambiguity follows composed Area module and route declaration order", () => {
    const areas = createRouteAreas();
    const navigation = createNavigation({ areas });

    assert.equal(
        navigation._buildUrlFinal(navigation.parseUrl("/demo/items")),
        "/demo/_assets/first/pages/items.js"
    );
});

test("Areas.resolveHref keeps ambiguous canonical Pages scoped to the selected Area", () => {
    const areas = createAreas();

    assert.equal(areas.resolveHref("/sales/_assets/customer/pages/detail.js", "sales")?.path, "/sales/detail");
    assert.equal(areas.resolveHref("/admin/_assets/customer/pages/detail.js", "admin")?.path, "/admin/detail");
    assert.equal(areas.resolveHref("/admin/_assets/customer/pages/detail.js", "sales"), null);
});

test("Areas.resolveHref discovers named dynamic menus through module-associated Areas", () => {
    const areas = createAreas();

    assert.equal(areas.resolveHref("/_assets/x-demo/pages/03-navigation/index.js")?.path, "/demo/navigation");
    assert.equal(areas.resolveHref("/_assets/x-demo/pages/03-navigation/index.js", "main"), null);
    assert.equal(areas.resolveHref("/_assets/x-demo/pages/index.js")?.path, "/demo/");
});

test("Areas.resolvePath retains its existing global exact-match behavior", () => {
    const areas = createAreas();

    assert.equal(areas.resolvePath("/sales/detail")?.href, "/sales/_assets/customer/pages/detail.js");
    assert.equal(areas.resolvePath("/sales/detail?customer=42"), null);
});

test("Navigation exposes a friendly path while preserving canonical lookup suffixes", () => {
    const navigation = createNavigation();
    const page = { src: "/sales/_assets/customer/pages/origin.js" };

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/customer/pages/detail.js?customer=42#summary", page }),
        "/sales/detail?customer=42#summary"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/customer/pages/detail.js#summary", params: { customer: 42 }, page }),
        "/sales/detail?customer=42#summary"
    );
});

function createRouteAreas() {
    const bus = {
        addEventListener() {},
        emit() {}
    };
    const config = { modules: { first: {}, second: {}, outsider: {} }, xshell: { assets: { basePath: "/_assets" } } };
    const options = {
        default: "combined",
        global: [],
        definitions: {
            combined: { prefix: "/demo", modules: ["first", "second"] },
            "first-only": { prefix: "/first", modules: ["first"] },
            "outsider-only": { prefix: "/outsider", modules: ["outsider"] }
        }
    };
    const modules = new Map([
        ["first", { id: "first", routes: {
            "/items": "/_assets/first/pages/items.js",
            "/repository/{repositoryId}": "/_assets/first/pages/repository.js"
        }, config: { menus: {} } }],
        ["second", { id: "second", routes: {
            "/items": "/_assets/second/pages/items.js",
            "/settings": "/_assets/second/pages/settings.js"
        }, config: { menus: {} } }],
        ["outsider", { id: "outsider", routes: { "/outsider": "/_assets/outsider/pages/index.js" }, config: { menus: {} } }]
    ]);
    const areas = new Areas({ config, bus }, options);
    areas.init({ modules: { getModuleById(id) { return modules.get(id) || null; } } });
    return areas;
}

test("Navigation falls back to Area-aware canonical hrefs and preserves items without paths", () => {
    const navigation = createNavigation();
    const page = { src: "/sales/_assets/customer/pages/origin.js" };

    assert.equal(navigation.buildUrlAbsolute({ href: "/_assets/customer/pages/missing.js", page }), "/sales/_assets/customer/pages/missing.js");
    assert.equal(navigation.buildUrlAbsolute({ href: "/_assets/customer/pages/canonical.js", page }), "/sales/_assets/customer/pages/canonical.js");
});

test("Navigation uses the originating Page Area instead of the current Area", () => {
    const navigation = createNavigation();
    const page = { src: "/admin/_assets/customer/pages/origin.js" };

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/customer/pages/detail.js", page }),
        "/admin/detail"
    );
    assert.equal(
        navigation._resolveCanonicalHref("/_assets/customer/pages/detail.js?customer=42#summary", page),
        "/admin/_assets/customer/pages/detail.js?customer=42#summary"
    );
    assert.equal(navigation.buildUrlAbsolute({ href: "/sales/_assets/customer/pages/detail.js", page }), "/sales/detail");
});

test("Navigation discovers a target module's Area when the originating Page belongs to another Area", () => {
    const navigation = createNavigation();
    const page = { src: "/main/_assets/shell/pages/origin.js" };

    assert.equal(navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/03-navigation/index.js", page }), "/demo/navigation");
    assert.equal(
        navigation._resolveCanonicalHref("/_assets/x-demo/pages/03-navigation/index.js", page),
        "/demo/_assets/x-demo/pages/03-navigation/index.js"
    );
});

test("Navigation formats friendly URLs through existing path and hash modes with AppBasePath", () => {
    const page = { src: "/sales/_assets/customer/pages/origin.js" };
    const pathNavigation = createNavigation({ mode: "path", basePath: "/app", baseUrl: "https://example.test/app/" });
    const hashNavigation = createNavigation({ mode: "hash", basePath: "/app", baseUrl: "https://example.test/app/" });

    assert.equal(pathNavigation.buildUrlAbsolute({ href: "/_assets/customer/pages/detail.js", page }), "/app/sales/detail");
    assert.equal(hashNavigation.buildUrlAbsolute({ href: "/_assets/customer/pages/detail.js", page }), "/app/#!/sales/detail");
});

test("Navigation removes AppBasePath from already resolved asset targets before applying an Area", () => {
    const page = { src: "/demo/_assets/x-demo/1.0.0.dev/pages/01-components/01-basics.js" };
    const assetHref = "/_assets/x-demo/1.0.0.dev/pages/01-components/02-forms.js?view=all#examples";

    for (const mode of ["path", "hash"]) {
        for (const basePath of ["", "/prefix", "/prefix/demo"]) {
            const navigation = createNavigation({
                mode,
                basePath,
                baseUrl: `https://example.test${basePath}/`
            });
            const renderedHref = basePath + assetHref;
            const canonicalHref = "/demo" + assetHref;
            const renderedCanonicalHref = basePath + canonicalHref;
            const browserHref = basePath + (mode === "hash" ? "/#!" : "") + canonicalHref;

            assert.equal(navigation._resolveCanonicalHref(renderedHref, page), canonicalHref);
            assert.equal(navigation._resolveCanonicalHref(canonicalHref, page), canonicalHref);
            assert.equal(navigation._resolveCanonicalHref(renderedCanonicalHref, page), canonicalHref);
            assert.equal(navigation.buildUrlAbsolute({ href: renderedHref, page }), browserHref);
            assert.equal(navigation.buildUrlAbsolute({ href: canonicalHref, page }), browserHref);
            assert.equal(navigation.buildUrlAbsolute({ href: renderedCanonicalHref, page }), browserHref);
            if (basePath) assert.equal(browserHref.includes(basePath + "/demo" + basePath), false);
        }
    }
});

test("Navigation does not strip AppBasePath from non-asset logical paths", () => {
    const navigation = createNavigation({ basePath: "/prefix", baseUrl: "https://example.test/prefix/" });
    const page = { src: "/demo/_assets/x-demo/pages/origin.js" };

    assert.equal(navigation._resolveCanonicalHref("/prefix/reports?view=all#summary", page), "/demo/prefix/reports?view=all#summary");
});

test("Navigation still resolves incoming friendly paths to canonical Page hrefs", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation._buildUrlFinal(navigation.parseUrl("/sales/detail?customer=42#summary")),
        "/sales/_assets/customer/pages/detail.js?customer=42#summary"
    );
});

test("Navigation resolves Area routes to canonical Page hrefs with path parameters", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation._buildUrlFinal(navigation.parseUrl("/demo/repository/12/projects/7/items")),
        "/demo/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7"
    );
});

test("Navigation preserves target query, incoming query, and fragment with route parameters authoritative", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation._buildUrlFinal(navigation.parseUrl("/demo/repository/12?repositoryId=999&sort=name&page=3#details")),
        "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12&sort=name&page=3#details"
    );
});

test("Navigation safely serializes decoded route parameter values", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation._buildUrlFinal(navigation.parseUrl("/demo/repository/hello%20world")),
        "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=hello%20world"
    );
    assert.equal(
        navigation._buildUrlFinal(navigation.parseUrl("/demo/repository/abc%2Fdef")),
        "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=abc%2Fdef"
    );
});

test("Navigation matches only the resolved Area routes", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation._buildUrlFinal(navigation.parseUrl("/sales/customer/12")),
        "/sales/_assets/customer/pages/detail.js?customerId=12"
    );
    assert.equal(navigation._buildUrlFinal(navigation.parseUrl("/demo/customer/12")), "/demo/customer/12");
});

test("Navigation gives exact menu paths precedence over matching routes", () => {
    const navigation = createNavigation();

    assert.equal(navigation.resolveRoute("/demo/navigation").href, "/demo/_assets/x-demo/pages/route-navigation.js");
    assert.equal(
        navigation._buildUrlFinal(navigation.parseUrl("/demo/navigation")),
        "/demo/_assets/x-demo/pages/03-navigation/index.js"
    );
});

test("Navigation.resolveRoute reports a literal match and keeps composed declaration order", () => {
    const navigation = createNavigation({ areas: createRouteAreas() });

    assert.deepEqual(navigation.resolveRoute("/demo/items"), {
        areaId: "combined",
        areaPrefix: "/demo",
        moduleId: "first",
        route: "/items",
        target: "/_assets/first/pages/items.js",
        params: {},
        href: "/demo/_assets/first/pages/items.js"
    });
});

test("Navigation.resolveRoute decodes path parameters and shares forward href construction in both modes", () => {
    const path = "/demo/repository/a%2Fb%2520?repositoryId=ignored&mode=grid&sort=by+name#details";
    const result = {
        areaId: "demo",
        areaPrefix: "/demo",
        moduleId: "x-demo",
        route: "/repository/{repositoryId}",
        target: "/_assets/x-demo/pages/repository.js?mode=list",
        params: { repositoryId: "a/b%20" },
        href: "/demo/_assets/x-demo/pages/repository.js?mode=grid&repositoryId=a%2Fb%2520&sort=by%20name#details"
    };
    for (const mode of ["path", "hash"]) {
        const navigation = createNavigation({ mode, basePath: "/app" });
        assert.deepEqual(navigation.resolveRoute(path), result);
        assert.equal(result.href, navigation._buildUrlFinal(navigation.parseUrl(path)));
    }
});

test("Navigation.resolveRoute selects the longest Area prefix, including an empty root prefix", () => {
    const { navigation } = createSharedRouteContext({
        defaultArea: "root",
        definitions: {
            root: { prefix: "/", modules: ["shared"] },
            shop: { prefix: "/shop", modules: ["shared"] },
            detail: { prefix: "/shop/detail", modules: ["shared"] },
            empty: { prefix: "/shop/empty", modules: [] }
        }
    });
    const path = "/repository/12/items";

    assert.deepEqual(navigation.resolveRoute(path), {
        areaId: "root",
        areaPrefix: "",
        moduleId: "shared",
        route: "/repository/{repositoryId}/items",
        target: "/_assets/shared/pages/items.js",
        params: { repositoryId: "12" },
        href: "/_assets/shared/pages/items.js?repositoryId=12"
    });
    assert.equal(navigation.resolveRoute("/shop" + path).href, "/shop/_assets/shared/pages/items.js?repositoryId=12");
    const detail = navigation.resolveRoute("/shop/detail" + path);
    assert.equal(detail.areaId, "detail");
    assert.equal(detail.areaPrefix, "/shop/detail");
    assert.equal(detail.href, "/shop/detail/_assets/shared/pages/items.js?repositoryId=12");
    assert.equal(navigation.resolveRoute("/shop/empty" + path), null);
});

test("Navigation.resolveRoute preserves an existing destination Area prefix and a target fragment", () => {
    const { navigation } = createSharedRouteContext({
        defaultArea: "shop",
        definitions: { shop: { prefix: "/shop", modules: ["shared"] } },
        routes: { "/": "/shop/_assets/shared/pages/index.js?mode=compact#summary" }
    });

    assert.equal(navigation.resolveRoute("/shop").href, "/shop/_assets/shared/pages/index.js?mode=compact#summary");
    assert.equal(navigation.resolveRoute("/shop/?filter=new#top").href, "/shop/_assets/shared/pages/index.js?mode=compact&filter=new#top");
});

test("Navigation.resolveRoute distinguishes missing matches from invalid inputs", () => {
    const navigation = createNavigation();

    for (const path of ["/missing", "/demo/missing?query=1#fragment", "/main/repository/12", "/demo/repository"]) {
        assert.equal(navigation.resolveRoute(path), null);
    }
    for (const path of [undefined, null, 42, "", "   "]) {
        assert.throws(() => navigation.resolveRoute(path), /path must be a non-empty string/);
    }
    for (const path of ["relative/path", "?query=1", "#fragment", "#!/demo/something", "//example.test/path", "https://example.test/path"]) {
        assert.throws(() => navigation.resolveRoute(path), /path must start with a single/);
    }
    assert.throws(() => navigation.resolveRoute("/demo/repository/%E0%A4%A"), /Invalid encoded route parameter/);
});

test("Navigation.resolveRoute leaves browser history, mounted Pages, and the Navigation stack untouched", (t) => {
    const navigation = createNavigation();
    const mounted = Object.freeze([Object.freeze({ src: "/sales/_assets/customer/pages/detail.js?customer=42" })]);
    navigation._container = { querySelectorAll: () => mounted };
    navigation._stack = [navigation.parseUrl("/sales/detail?customer=42")];
    const before = structuredClone(navigation.stack);
    const currentArea = navigation._areas.getCurrentArea();
    const location = Object.freeze({ href: "https://example.test/sales/detail?customer=42" });
    const writeHistory = () => assert.fail("Route inspection must not write history");
    const history = { pushState: writeHistory, replaceState: writeHistory };
    Object.assign(globalThis, { location, history });
    t.after(() => {
        delete globalThis.location;
        delete globalThis.history;
    });
    t.mock.method(navigation._bus, "emit", () => assert.fail("Route inspection must not emit navigation events"));

    assert.equal(navigation.resolveRoute("/demo/something").areaId, "demo");
    assert.deepEqual(navigation.stack, before);
    assert.equal(navigation.getXPage(), mounted[0]);
    assert.equal(navigation.src, mounted[0].src);
    assert.equal(navigation._areas.getCurrentArea(), currentArea);
    assert.equal(globalThis.location, location);
    assert.equal(globalThis.history, history);
});

test("Navigation route resolution preserves direct canonical and unmatched fallback behavior", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation._buildUrlFinal(navigation.parseUrl("/demo/_assets/x-demo/pages/items.js?repositoryId=12")),
        "/demo/_assets/x-demo/pages/items.js?repositoryId=12"
    );
    assert.equal(navigation._buildUrlFinal(navigation.parseUrl("/demo/not-a-route")), "/demo/not-a-route");
});

test("Navigation preserves fallback and canonical access when a module and Area have no routes", () => {
    const { areas, navigation } = createNoRouteContext();

    assert.deepEqual(areas.getArea("empty").routes, []);
    assert.doesNotThrow(() => navigation._buildUrlFinal(navigation.parseUrl("/empty/not-a-route")));
    assert.equal(navigation._buildUrlFinal(navigation.parseUrl("/empty/not-a-route")), "/empty/not-a-route");
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/empty/pages/index.js?tab=info#details" }),
        "/empty/_assets/empty/pages/index.js?tab=info#details"
    );
    assert.equal(
        navigation._buildUrlFinal(navigation.parseUrl("/empty/_assets/empty/pages/index.js?tab=info#details")),
        "/empty/_assets/empty/pages/index.js?tab=info#details"
    );
});

test("Navigation keeps malformed encoded route parameters distinct from normal no-match fallback", () => {
    const navigation = createNavigation();

    assert.throws(
        () => navigation._buildUrlFinal(navigation.parseUrl("/demo/repository/%E0%A4%A")),
        /Invalid encoded route parameter/
    );
    assert.doesNotThrow(() => navigation._buildUrlFinal(navigation.parseUrl("/demo/not-a-route")));
});

test("Navigation route resolution is mode-independent and keeps browser-facing route URLs", () => {
    const pathNavigation = createNavigation({ mode: "path", basePath: "/app", baseUrl: "https://example.test/app/" });
    const hashNavigation = createNavigation({ mode: "hash", basePath: "/app", baseUrl: "https://example.test/app/" });
    const href = "/demo/repository/12";

    assert.equal(pathNavigation.buildUrlAbsolute({ href }), "/app/demo/repository/12");
    assert.equal(hashNavigation.buildUrlAbsolute({ href }), "/app/#!/demo/repository/12");
    assert.equal(
        pathNavigation._buildUrlFinal(pathNavigation.parseUrl(href)),
        "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12"
    );
    assert.equal(
        hashNavigation._buildUrlFinal(hashNavigation.parseUrl(href)),
        "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12"
    );
});

test("Navigation reverse maps literal and parameterized canonical Page hrefs", () => {
    const navigation = createNavigation();

    assert.equal(navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/about.js" }), "/demo/something");
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12" }),
        "/demo/repository/12"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7" }),
        "/demo/repository/12/projects/7/items"
    );
});

test("Navigation reverse routing consumes route and intrinsic target params while preserving unused query and fragments", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({
            href: "/_assets/x-demo/pages/items.js#summary",
            params: { repositoryId: "12", projectId: "7", sort: "name", page: 3 }
        }),
        "/demo/repository/12/projects/7/items?sort=name&page=3#summary"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12&sort=name#details" }),
        "/demo/repository/12?sort=name#details"
    );
});

test("Navigation reverse routing encodes placeholder values as individual path segments", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/repository.js", params: { mode: "list", repositoryId: "hello world" } }),
        "/demo/repository/hello%20world"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/repository.js", params: { mode: "list", repositoryId: "abc/def" } }),
        "/demo/repository/abc%2Fdef"
    );
});

test("Navigation reverse routing skips candidates with missing parameters and continues in Area order", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/items.js?repositoryId=12" }),
        "/demo/repository/12/items"
    );
    const fallback = navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/items.js?projectId=7" });
    assert.equal(fallback, "/sales/_assets/x-demo/pages/items.js?projectId=7");
    assert.equal(fallback.includes("undefined"), false);
});

test("Navigation reverse routing uses the first applicable route for duplicate targets", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7" }),
        "/demo/repository/12/projects/7/items"
    );
});

test("Navigation reverse ambiguity uses Area order without ranking placeholder counts", () => {
    const navigation = createNavigation();
    const area = {
        prefix: "/demo",
        routes: [
            { path: "/repository/{repositoryId}/items", href: "/_assets/x-demo/pages/items.js", module: "x-demo" },
            { path: "/repository/{repositoryId}/projects/{projectId}/items", href: "/_assets/x-demo/pages/items.js", module: "x-demo" }
        ]
    };

    assert.deepEqual(
        navigation._resolvePublicRouteTarget(
            "/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7",
            {},
            area
        ),
        { href: "/demo/repository/12/items", params: { projectId: "7" } }
    );
});

test("Navigation reverse ambiguity skips an inapplicable first route and uses the next candidate", () => {
    const navigation = createNavigation();
    const area = {
        prefix: "/demo",
        routes: [
            { path: "/repository/{repositoryId}/items", href: "/_assets/x-demo/pages/items.js", module: "x-demo" },
            { path: "/projects/{projectId}/items", href: "/_assets/x-demo/pages/items.js", module: "x-demo" }
        ]
    };

    assert.deepEqual(
        navigation._resolvePublicRouteTarget("/_assets/x-demo/pages/items.js?projectId=7", {}, area),
        { href: "/demo/projects/7/items", params: {} }
    );
});

test("Navigation treats missing, null, undefined, and empty reverse parameters as inapplicable", () => {
    const navigation = createNavigation();
    const area = {
        prefix: "/demo",
        routes: [{ path: "/repository/{repositoryId}/items", href: "/_assets/x-demo/pages/items.js", module: "x-demo" }]
    };

    for (const params of [{}, { repositoryId: null }, { repositoryId: undefined }, { repositoryId: "" }]) {
        assert.doesNotThrow(() => navigation._resolvePublicRouteTarget("/_assets/x-demo/pages/items.js", params, area));
        assert.equal(navigation._resolvePublicRouteTarget("/_assets/x-demo/pages/items.js", params, area), null);
    }
});

test("Navigation reverse routing keeps exact menu aliases ahead of routes", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/03-navigation/index.js" }),
        "/demo/navigation"
    );
});

test("Navigation reverse routing honors originating Area and target-module Area discovery", () => {
    const navigation = createNavigation();
    const page = { src: "/admin/_assets/customer/pages/origin.js" };

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/customer/pages/route-detail.js?customerId=12", page }),
        "/admin/customer-route/12"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/about.js" }),
        "/demo/something"
    );
});

test("Navigation reverse routing applies an existing Area prefix exactly once", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/demo/_assets/x-demo/pages/about.js" }),
        "/demo/something"
    );
});

test("Navigation keeps Area routes relative while applying a non-root Area prefix exactly once in both directions", () => {
    const navigation = createNavigation();
    const publicHref = "/demo/repository/12/projects/7/items?sort=name#details";
    const canonicalHref = "/demo/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7&sort=name#details";

    assert.equal(navigation._buildUrlFinal(navigation.parseUrl(publicHref)), canonicalHref);
    assert.equal(navigation.buildUrlAbsolute({ href: canonicalHref }), publicHref);
    assert.equal(navigation.buildUrlAbsolute({ href: canonicalHref }).includes("/demo/demo/"), false);
    assert.equal(navigation._areas.getArea("demo").routes[2].path, "/repository/{repositoryId}/projects/{projectId}/items");
});

test("Navigation supports forward and reverse routes in an empty-prefix root Area", () => {
    const { areas, navigation, module } = createSharedRouteContext({
        defaultArea: "root",
        definitions: { root: { prefix: "", modules: ["shared"] } }
    });
    const publicHref = "/repository/12/items?sort=name#details";
    const canonicalHref = "/_assets/shared/pages/items.js?repositoryId=12&sort=name#details";

    assert.equal(navigation._buildUrlFinal(navigation.parseUrl(publicHref)), canonicalHref);
    assert.equal(navigation.buildUrlAbsolute({ href: canonicalHref }), publicHref);
    assert.equal(navigation.buildUrlAbsolute({ href: canonicalHref }).startsWith("//"), false);
    assert.deepEqual(module.routes, { "/repository/{repositoryId}/items": "/_assets/shared/pages/items.js" });
    assert.equal(areas.getArea("root").routes[0].path, "/repository/{repositoryId}/items");
});

test("Navigation preserves explicit and originating Area context when one module participates in multiple Areas", () => {
    const { navigation } = createSharedRouteContext({
        defaultArea: "sales",
        definitions: {
            sales: { prefix: "/sales", modules: ["shared"] },
            admin: { prefix: "/admin", modules: ["shared"] }
        }
    });
    const adminPage = { src: "/admin/_assets/shared/pages/origin.js" };

    assert.equal(
        navigation._buildUrlFinal(navigation.parseUrl("/admin/repository/12/items")),
        "/admin/_assets/shared/pages/items.js?repositoryId=12"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/admin/_assets/shared/pages/items.js?repositoryId=12" }),
        "/admin/repository/12/items"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/shared/pages/items.js?repositoryId=12", page: adminPage }),
        "/admin/repository/12/items"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/shared/pages/items.js?repositoryId=12" }),
        "/sales/repository/12/items"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/admin/_assets/shared/pages/items.js" }),
        "/admin/_assets/shared/pages/items.js"
    );
});

test("Navigation wraps root and prefixed route URLs through path and hash AppBasePath modes", () => {
    const definitions = { demo: { prefix: "/demo", modules: ["shared"] } };
    const path = createSharedRouteContext({ definitions, defaultArea: "demo", mode: "path", basePath: "/app", baseUrl: "https://example.test/app/" }).navigation;
    const hash = createSharedRouteContext({ definitions, defaultArea: "demo", mode: "hash", basePath: "/app", baseUrl: "https://example.test/app/" }).navigation;
    const canonicalHref = "/_assets/shared/pages/items.js?repositoryId=12&sort=name#details";

    assert.equal(path.buildUrlAbsolute({ href: canonicalHref }), "/app/demo/repository/12/items?sort=name#details");
    assert.equal(hash.buildUrlAbsolute({ href: canonicalHref }), "/app/#!/demo/repository/12/items?sort=name#details");
});

test("Navigation reverse routing requires intrinsic target query parameters", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/repository.js?mode=grid&repositoryId=12" }),
        "/sales/_assets/x-demo/pages/repository.js?mode=grid&repositoryId=12"
    );
});

test("Navigation reverse routes consistently in path and hash modes with AppBasePath", () => {
    const pathNavigation = createNavigation({ mode: "path", basePath: "/app", baseUrl: "https://example.test/app/" });
    const hashNavigation = createNavigation({ mode: "hash", basePath: "/app", baseUrl: "https://example.test/app/" });
    const href = "/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12";

    assert.equal(pathNavigation.buildUrlAbsolute({ href }), "/app/demo/repository/12");
    assert.equal(hashNavigation.buildUrlAbsolute({ href }), "/app/#!/demo/repository/12");
});

test("Navigation round-trips canonical route identity with unused query and fragment", () => {
    const navigation = createNavigation();
    const canonical = "/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7&sort=name#summary";
    const publicHref = navigation.buildUrlAbsolute({ href: canonical });

    assert.equal(publicHref, "/demo/repository/12/projects/7/items?sort=name#summary");
    assert.equal(
        navigation._buildUrlFinal(navigation.parseUrl(publicHref)),
        "/demo/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7&sort=name#summary"
    );
});

test("Navigation round-trips encoded route segments without changing segment boundaries", () => {
    const navigation = createNavigation();
    const canonical = "/_assets/x-demo/pages/items.js?repositoryId=hello%20world&projectId=abc%2Fdef&sort=name%20asc#details";
    const publicHref = navigation.buildUrlAbsolute({ href: canonical });

    assert.equal(publicHref, "/demo/repository/hello%20world/projects/abc%2Fdef/items?sort=name%20asc#details");
    assert.equal(
        navigation._buildUrlFinal(navigation.parseUrl(publicHref)),
        "/demo/_assets/x-demo/pages/items.js?repositoryId=hello%20world&projectId=abc%2Fdef&sort=name%20asc#details"
    );
});

test("Navigation round-trips routes through an empty-prefix Area", () => {
    const { navigation } = createSharedRouteContext({
        defaultArea: "root",
        definitions: { root: { prefix: "", modules: ["shared"] } }
    });
    const canonical = "/_assets/shared/pages/items.js?repositoryId=12&sort=name#details";
    const publicHref = navigation.buildUrlAbsolute({ href: canonical });

    assert.equal(publicHref, "/repository/12/items?sort=name#details");
    assert.equal(navigation._buildUrlFinal(navigation.parseUrl(publicHref)), canonical);
});

test("Navigation round-trips routes through path and hash modes with AppBasePath", () => {
    const canonical = "/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7&sort=name#summary";
    const expected = "/demo/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7&sort=name#summary";
    const cases = [
        { navigation: createNavigation({ mode: "path", basePath: "/app", baseUrl: "https://example.test/app/" }), browserPrefix: "/app" },
        { navigation: createNavigation({ mode: "hash", basePath: "/app", baseUrl: "https://example.test/app/" }), browserPrefix: "/app/#!" }
    ];

    for (const { navigation, browserPrefix } of cases) {
        const publicHref = navigation.buildUrlAbsolute({ href: canonical });
        const applicationHref = publicHref.substring(browserPrefix.length);

        assert.equal(navigation._buildUrlFinal(navigation.parseUrl(applicationHref)), expected);
    }
});

test("Navigation leaves external URLs untouched", () => {
    const navigation = createNavigation();
    const page = { src: "/sales/_assets/customer/pages/origin.js" };

    for (const href of ["https://example.com/a?b=1#c", "http://example.com", "mailto:user@example.com", "tel:+123456789"]) {
        assert.equal(navigation.buildUrlAbsolute({ href, page }), href);
    }
});

test("Navigation resolves relative Page links with colons in query strings", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrl({ href: "details?time=10:30", page: { src: "/sales/pages/current.js" } }),
        "/sales/pages/details?time=10:30"
    );
});
