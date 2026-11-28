import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import WorkspacePage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/workspace.js";
import AreasSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-areas.js";
import Menus from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/menus.js";
import { fillResolverRules, mergeManifests, normalizeManifest } from "./helpers/manifest-composition.mjs";
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/resolver.js";

const href = "/_assets/reports/first-generation/pages/overview.js";
const reports = { scope: "global", label: "Reports", description: "Review the latest results.", icon: "x-chart",
    items: [
        { label: "-" },
        { label: "Refresh", command: "refresh" },
        { label: "Group", children: [{ id: "overview", label: "Overview", href }] },
        { id: "other", label: "Other", href: "/pages/other.js" }
    ] };

function createMenus(definitions, areasOptions = {}) {
    const config = { modules: {}, xshell: { assets: { basePath: "/_assets" } } };
    const bus = new EventTarget();
    const areas = new Areas({ config, bus }, { default: Object.keys(areasOptions)[0] ?? null, definitions: areasOptions });
    const menus = new Menus({ areas, bus, config }, { definitions });
    menus.init();
    return menus;
}

function createPage(menuName, item = null, menus = createMenus({ reports, empty: { scope: "global" } }), src) {
    const state = { ...structuredClone(WorkspacePage.state), menuName, item };
    const page = src ? { src } : {};
    const navigations = [];
    const navigation = { navigate: request => navigations.push(request) };
    const pending = [];
    const bus = new EventTarget();
    const controller = WorkspacePage.controller({
        state, menus, page, navigation, query: new URLSearchParams(), postRender: method => pending.push(method),
        bus, events: { on: (target, type, listener) => target.addEventListener(type, listener) }
    });
    controller.load();
    controller.mount();
    assert.equal(navigations.length, 0);
    for (const method of pending) controller[method]();
    return { state, page, controller, menus, navigations, bus };
}

test("Workspace uses global menu metadata and defaults to the first nested Page", () => {
    const { state, page, menus, navigations } = createPage("reports");
    assert.deepEqual(page, { label: reports.label, description: reports.description, icon: reports.icon });
    assert.equal(state.menu, menus.getMenu("reports").items);
    assert.equal(state.item, "overview");
    assert.deepEqual(navigations, [{ href, page, open: "embed", outlet: "content" }]);
});

test("Workspace resolves an Area item's friendly path via Navigation", () => {
    const localReports = { ...reports, scope: "area", items: [{ id: "overview", label: "Overview", href, path: "/overview" }] };
    const menus = createMenus({ reports: localReports }, { main: { prefix: "/main", menus: { reports: "reports" } } });
    const { state, page, navigations } = createPage("reports", "overview", menus);
    assert.equal(state.menu, menus.getMenu("reports").items);
    assert.equal(state.menu[0].href, "/main" + href);
    assert.deepEqual(navigations, [{ href: "/main/overview", page, open: "embed", outlet: "content" }]);
});

test("A global Workspace reads the retained Area's effective menu", () => {
    const localReports = { ...reports, scope: "area", items: [{ id: "overview", label: "Overview", href, path: "/overview" }] };
    const menus = createMenus({ reports: localReports }, { main: { prefix: "/main", menus: { reports: "reports" } } });
    const { page, state, navigations } = createPage("reports", null, menus, "/global/_assets/x/0.9.0.dev/pages/workspace.js");
    assert.equal(Object.hasOwn(WorkspacePage.contract.properties, "areaName"), false);
    assert.equal(state.item, "overview");
    assert.deepEqual(navigations, [{ href: "/main/overview", page, open: "embed", outlet: "content" }]);
});

test("Workspace resolves explicit IDs and falls back for unknown values", () => {
    const explicit = createPage("reports", "other");
    assert.equal(explicit.state.item, "other");
    assert.equal(explicit.navigations[0].href, "/pages/other.js");

    const unknown = createPage("reports", "/pages/untrusted.js");
    assert.equal(unknown.state.item, "overview");
    assert.equal(unknown.navigations[0].href, href);
});

test("Workspace leaves browser-target links out of its embedded selection", () => {
    const help = {id: "help", label: "Help", href: "/pages/help.js", target: "_blank"};
    const menus = createMenus({reports: {...reports, items: [help, ...reports.items]}});
    const {state, page, navigations} = createPage("reports", "help", menus);
    assert.equal(state.menu[0].target, "_blank");
    assert.equal(state.item, "overview");
    assert.deepEqual(navigations, [{href, page, open: "embed", outlet: "content"}]);
});

test("Workspace leaves missing and empty menus without embedded navigation", () => {
    for (const name of ["unknown", "empty"]) {
        const { state, navigations } = createPage(name, "overview");
        assert.deepEqual(state.menu, []);
        assert.equal(state.item, null);
        assert.equal(state.src, null);
        assert.deepEqual(navigations, []);
    }
});

test("Workspace refreshes effective items without reopening the selected Page", () => {
    let items = reports.items;
    const menu = { ...reports, get items() { return items; } };
    const { state, bus, navigations } = createPage("reports", "overview", { getMenu: () => menu });
    items = [...items, { id: "status", label: "Status", href: "/pages/status.js" }];
    bus.dispatchEvent(new Event("xshell:menus:change"));
    assert.equal(state.menu, items);
    assert.equal(state.item, "overview");
    assert.equal(navigations.length, 1);
});

test("Workspace validates duplicate IDs across branches and resolves unique sibling IDs", () => {
    const duplicate = { ...reports, items: [...reports.items, { label: "Another group", children: [{ id: "overview", label: "Duplicate", href }] }] };
    const updated = { ...reports, items: reports.items.map(item => item.id === "other" ? { ...item, label: "Updated" } : item) };
    const menus = createMenus({ duplicate, reports: updated });
    assert.throws(() => createPage("duplicate", "other", menus), /Workspace menu 'duplicate' has duplicate navigable item ID 'overview'/);
    const merged = createPage("reports", "other", menus);
    assert.equal(merged.state.menu.filter(item => item.id === "other").length, 1);
    assert.equal(merged.state.menu.find(item => item.id === "other").label, "Updated");
    assert.equal(merged.navigations[0].href, "/pages/other.js");
});


test("bundled manifests select named Area navigation menus and compose global shortcuts", async () => {
    const resources = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);
    const readManifest = id => JSON.parse(readFileSync(new URL(`${id}/manifest.jsonc`, resources), "utf8")
        .replace(/^\s*\/\/[^\r\n]*/gm, "").replace(/,(?=\s*[}\]])/g, ""));
    const ids = ["xshell", "x", "x-filesystem", "xshell-diagnostics", "xshell-docs", "x-home", "x-demo"];
    const diagnostics = [
        ["application", "Application", ["app", "config", "modules"]],
        ["runtime", "Runtime", ["runtime", "errors", "bus", "tasks"]],
        ["resources", "Resources", ["resolver", "loader", "schemas"]],
        ["ui", "UI", ["components", "pages", "navigation", "icons", "i18n"]],
        ["apis", "APIs", ["services", "contracts", "commands", "queries"]],
        ["browser", "Browser", ["storage", "service-worker"]]
    ];
    const diagnosticPages = diagnostics.flatMap(([group, , pages]) => pages.map(id => `/pages/${group}/${id}.js`));
    const detailPages = ["contract-detail", "service-inspector", "tasks-detail"];
    const modules = ids.map(name => {
        const manifest = readManifest(name);
        const assetsPath = "/_assets/" + name + "/0.9.0.dev";
        const module = { name, assetsPath, manifestUrl: "https://example.test/" + name + "/manifest.json" };
        const definition = manifest.modules?.[name];
        if (definition) definition.files = [{ path: name === "xshell-docs" ? "/pages/index.md" : "/pages/index.js" }];
        if (name === "xshell-diagnostics") {
            const pages = [...diagnosticPages, ...detailPages.map(id => `/pages/detail/${id}.js`)];
            definition.files.push(...pages.map(path => ({ path, resource: { type: "page" } })));
        }
        module.dependencies = Object.fromEntries(Object.keys(definition?.dependencies ?? {}).filter(id => ids.includes(id)).map(id => [id, "0.9.0"]));
        module.manifest = normalizeManifest(manifest, module);
        return module;
    });
    const config = mergeManifests(modules, modules.at(-1));
    config.app = { baseUrl: "https://example.test/" };
    config.xshell.assets.basePath = "/_assets";
    fillResolverRules(config);
    const resolver = new Resolver({ config });
    const bus = new EventTarget();
    const areas = new Areas({ config, bus }, config.xshell.services.areas.options);
    const menus = new Menus({ areas, bus, config }, config.xshell.services.menus.options);
    menus.init();
    areas.init({ menus });

    for (const [areaId, name, home] of [
        ["cookbook", "cookbook", "/cookbook/"],
        ["launcher", "home", "/launcher/home"],
        ["xshell-diagnostics", "diagnostics", "/xshell-diagnostics/"],
        ["xshell-docs", "documentation", "/xshell-docs/"]
    ]) {
        assert.equal(areas.getArea(areaId).menus.navigation, name);
        assert.equal(areas.getArea(areaId).home, home);
        assert.equal(menus.getMenu("navigation", areaId).scope, "area");
    }

    const menu = menus.getMenu("preferences");
    assert.deepEqual([menu.name, menu.scope, menu.label, menu.description, menu.icon],
        ["preferences", "global", "Preferences", "Manage application preferences.", "x-settings"]);
    assert.equal(menu.items[0].href, "/_assets/x/0.9.0.dev/pages/preferences/appearance.js");
    assert.deepEqual(menu.items.filter(item => item.href).map(item => item.id).sort(),
        ["about", "appearance", "browser-permissions", "filesystems", "i18n", "modules", "secrets"]);
    assert.equal(createPage("preferences", "filesystems", menus).navigations[0].href, "/_assets/x-filesystem/0.9.0.dev/pages/preferences/filesystems.js");
    const workspaceSrc = "/_assets/x/0.9.0.dev/pages/workspace.js?menu-name=preferences";
    assert.equal(config.xshell.services.preferences.options.page, workspaceSrc);
    const settings = menus.getMenu("global").items.filter(item => item.id === "root");
    assert.equal(settings.length, 1);
    assert.deepEqual([settings[0].label, settings[0].icon, settings[0].class], ["Settings", "x-admin", "top right"]);
    const shortcuts = settings[0].children;
    assert.equal(shortcuts.find(item => item.label === "Preferences").href, workspaceSrc);
    assert.ok(shortcuts.some(item => item.label === "About"));
    const dock = shortcuts.find(item => item.label === "Diagnostics console");
    assert.deepEqual([dock.module, dock.open, dock.href],
        ["xshell-diagnostics", "dock", "/_assets/xshell-diagnostics/0.9.0.dev/pages/index.js"]);

    // Check the composed hierarchy, friendly aliases and actual relocated resources.
    const [consoleItem, details] = menus.getMenu("navigation", "xshell-diagnostics").items;
    assert.equal(menus.resolvePath("/xshell-diagnostics/"), consoleItem);
    assert.deepEqual(consoleItem.children.map(group => [group.id, group.label, group.children.map(item => item.id)]), diagnostics);
    const tabs = consoleItem.children.flatMap(group => group.children);
    assert.equal(new Set(tabs.map(item => item.href)).size, 21);
    const assetRoot = "/_assets/xshell-diagnostics/0.9.0.dev";
    for (const [index, tab] of tabs.entries()) {
        const path = diagnosticPages[index];
        const { default: definition } = await import(new URL("xshell-diagnostics" + path, resources));
        assert.equal(tab.label, definition.meta.title);
        assert.equal(tab.module, "xshell-diagnostics");
        assert.equal(tab.href, "/xshell-diagnostics" + assetRoot + path);
        assert.equal(menus.resolvePath("/xshell-diagnostics/" + tab.id), tab);
        const resolved = resolver.resolve("page:xshell-diagnostics:" + path);
        assert.equal(resolved.path, assetRoot + path);
        assert.equal(resolved.definition.loader, "page-js");
    }
    assert.deepEqual(details.children.map(item => item.id), detailPages);
    for (const id of detailPages) {
        assert.equal(menus.resolvePath(`/xshell-diagnostics/detail/${id}`).href, `/xshell-diagnostics${assetRoot}/pages/detail/${id}.js`);
    }
    const search = new AreasSearchProvider({ areas, menus, config });
    assert.ok((await search.query("modules", {})).some(item => item.type === "page" && item.href === "/xshell-diagnostics/modules"));
    assert.ok((await search.query("service inspector", {})).some(item => item.type === "page" && item.href === "/xshell-diagnostics/detail/service-inspector"));
    assert.equal(menus.getMenu("global", "cookbook").scope, "global");
    const embeddedItems = config.xshell.services.menus.options.definitions.global.items.flatMap(item => item.children || []).filter(item => item.open === "embed");
    assert.equal(embeddedItems.length, 3);
    assert.ok(embeddedItems.every(item => item.outlet === "self" && !Object.hasOwn(item, "embedded")));
    const [filesystemShortcut] = config.xshell.services.menus.options.definitions.global.items.find(item => item.label === "Filesystems").children;
    assert.deepEqual([filesystemShortcut.href, filesystemShortcut.open, filesystemShortcut.outlet], ["/_assets/x-filesystem/0.9.0.dev/pages/global/filesystems.js", "embed", "self"]);
    assert.ok(!Object.hasOwn(filesystemShortcut, "embedded"));
});
