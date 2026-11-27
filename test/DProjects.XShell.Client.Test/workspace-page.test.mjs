import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import WorkspacePage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/workspace.js";
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";

const href = "/_assets/reports/first-generation/pages/overview.js";
const reports = { scope: "global", label: "Reports", description: "Review the latest results.", icon: "x-chart",
    items: [
        { label: "-" },
        { label: "Refresh", command: "refresh" },
        { label: "Group", children: [{ id: "overview", label: "Overview", href }] },
        { id: "other", label: "Other", href: "/pages/other.js" }
    ] };

function createAreas(modules, definitions = {}) {
    const config = { modules, xshell: { assets: { basePath: "/_assets" } } };
    const areas = new Areas({ config, bus: new EventTarget() }, { default: Object.keys(definitions)[0] ?? null, definitions });
    areas.init({ modules: { getModuleById: id => ({ id, config: modules[id] }) } });
    return areas;
}

function createPage(menuName, item = null, areas = createAreas({ reports: { menus: { reports, empty: { scope: "global" } } } }), src) {
    const state = { ...structuredClone(WorkspacePage.state), menuName, item };
    const page = src ? { src } : {};
    const navigations = [];
    const navigation = { navigate: request => navigations.push(request) };
    const pending = [];
    const controller = WorkspacePage.controller({
        state, areas, page, navigation, query: new URLSearchParams(), postRender: method => pending.push(method)
    });
    controller.load();
    controller.mount();
    assert.equal(navigations.length, 0);
    for (const method of pending) controller[method]();
    return { state, page, controller, areas, navigations };
}

test("Workspace uses global menu metadata and defaults to the first nested Page", () => {
    const { state, page, areas, navigations } = createPage("reports");
    assert.deepEqual(page, { label: reports.label, description: reports.description, icon: reports.icon });
    assert.equal(state.menu, areas.getMenu("reports").items);
    assert.equal(state.item, "overview");
    assert.deepEqual(navigations, [{ href, page, open: "embed", outlet: "content" }]);
});

test("Workspace resolves an Area item's friendly path via Navigation", () => {
    const localReports = { ...reports, scope: "area", items: [{ id: "overview", label: "Overview", href, path: "/overview" }] };
    const areas = createAreas({ reports: { menus: { reports: localReports } } }, { main: { prefix: "/main", modules: ["reports"] } });
    const { state, page, navigations } = createPage("reports", "overview", areas);
    assert.equal(state.menu, areas.getMenu("reports").items);
    assert.equal(state.menu[0].href, "/main" + href);
    assert.deepEqual(navigations, [{ href: "/main/overview", page, open: "embed", outlet: "content" }]);
});

test("A global Workspace reads the retained Area's effective menu", () => {
    const localReports = { ...reports, scope: "area", items: [{ id: "overview", label: "Overview", href, path: "/overview" }] };
    const areas = createAreas({ reports: { menus: { reports: localReports } } }, { main: { prefix: "/main", modules: ["reports"] } });
    const { page, state, navigations } = createPage("reports", null, areas, "/global/_assets/x/0.9.0.dev/pages/workspace.js");
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
    const areas = createAreas({reports: {menus: {reports: {...reports, items: [help, ...reports.items]}}}});
    const {state, page, navigations} = createPage("reports", "help", areas);
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

test("Workspace validates duplicate IDs across branches and allows merged sibling contributions", () => {
    const duplicate = { ...reports, items: [...reports.items, { label: "Another group", children: [{ id: "overview", label: "Duplicate", href }] }] };
    const areas = createAreas({ reports: { menus: { duplicate, reports } }, extra: { menus: {
        reports: { items: [{ id: "other", label: "Updated" }] }
    } } });
    assert.throws(() => createPage("duplicate", "other", areas), /Workspace menu 'duplicate' has duplicate navigable item ID 'overview'/);
    const merged = createPage("reports", "other", areas);
    assert.equal(merged.state.menu.filter(item => item.id === "other").length, 1);
    assert.equal(merged.state.menu.find(item => item.id === "other").label, "Updated");
    assert.equal(merged.navigations[0].href, "/pages/other.js");
});


test("bundled manifests compose Preferences and Diagnostics shortcuts as global menus", () => {
    const resources = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);
    const readManifest = id => JSON.parse(readFileSync(new URL(`${id}/manifest.jsonc`, resources), "utf8")
        .replace(/^\s*\/\/[^\r\n]*/gm, "").replace(/,(?=\s*[}\]])/g, ""));
    const framework = readManifest("xshell");
    const x = readManifest("x");
    const filesystem = readManifest("x-filesystem");
    const diagnostics = readManifest("xshell-diagnostics");
    const config = { modules: { ...x.modules, ...filesystem.modules, ...diagnostics.modules }, xshell: { assets: { basePath: "/_assets" } } };
    const options = { ...framework.xshell.services.areas.options, ...diagnostics.xshell.services.areas.options };
    options.definitions.main = { modules: ["x", "xshell-diagnostics"] };
    config.modules["xshell-diagnostics"].files = [{ path: "/pages/index.js" }];
    const areas = new Areas({ config, bus: new EventTarget() }, options);
    areas.init({ modules: { getModuleById: id => ({ id, config: config.modules[id] }) } });

    const menu = areas.getMenu("preferences");
    assert.deepEqual([menu.name, menu.scope, menu.label, menu.description, menu.icon],
        ["preferences", "global", "Preferences", "Manage application preferences.", "x-settings"]);
    assert.equal(menu.items[0].href, "/pages/preferences/appearance.js");
    assert.deepEqual(menu.items.filter(item => item.href).map(item => item.id).sort(),
        ["about", "appearance", "browser-permissions", "filesystems", "i18n", "modules", "secrets"]);
    assert.equal(createPage("preferences", "filesystems", areas).navigations[0].href, "/pages/preferences/filesystems.js");
    const workspaceSrc = "/pages/workspace.js?menu-name=preferences";
    assert.equal(x.xshell.services.preferences.options.page, workspaceSrc);
    const shortcuts = areas.getMenu("global").items.find(item => item.id === "root").children;
    assert.equal(shortcuts.find(item => item.label === "Preferences").href, workspaceSrc);
    assert.equal(shortcuts.find(item => item.label === "Diagnostics console").module, "xshell-diagnostics");
    assert.equal(areas.getMenu("global", "main").scope, "global");
    assert.equal(areas.getMenu("navigation", "main").scope, "area");
    const embeddedItems = x.modules.x.menus.global.items.flatMap(item => item.children || []).filter(item => item.open === "embed");
    assert.equal(embeddedItems.length, 2);
    assert.ok(embeddedItems.every(item => item.outlet === "self" && !Object.hasOwn(item, "embedded")));
    const [filesystemShortcut] = filesystem.modules["x-filesystem"].menus.global.items[0].children;
    assert.deepEqual([filesystemShortcut.href, filesystemShortcut.open, filesystemShortcut.outlet], ["/pages/global/filesystems.js", "embed", "self"]);
    assert.ok(!Object.hasOwn(filesystemShortcut, "embedded"));
});
