import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import WorkspacePage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/workspace.js";
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";

const href = "/_assets/reports/pages/overview.js";
const reports = { scope: "global", label: "Reports", description: "Review the latest results.", icon: "x-chart",
    items: [{ label: "Group", children: [{ label: "Overview", href }] }, { label: "Other", href: "/pages/other.js" }] };

function createPage(menuName, src = null) {
    const config = { modules: { reports: { menus: { reports, empty: { scope: "global" } } } }, xshell: { assets: { basePath: "/_assets" } } };
    const areas = new Areas({ config, bus: new EventTarget() }, { default: null, definitions: {} });
    const state = { ...structuredClone(WorkspacePage.state), menuName, src };
    const page = {};
    const controller = WorkspacePage.controller({ state, areas, page });
    controller.load();
    return { state, page, controller, areas };
}

test("Workspace uses the requested global menu metadata and opens its first navigable item", () => {
    const { state, page, areas } = createPage("reports");
    assert.deepEqual(page, { label: reports.label, description: reports.description, icon: reports.icon });
    assert.equal(state.menu, areas.getMenu("reports").items);
    assert.deepEqual(areas.getMenus(), [areas.getMenu("reports"), areas.getMenu("empty")]);
    assert.equal(state.src, href);
});

test("Workspace uses an Area menu through the unified lookup", () => {
    const localReports = { label: "Area reports", description: "Reports for this Area.", icon: "x-chart", items: [{ label: "Overview", href }] };
    const config = { modules: { reports: { menus: { reports: localReports } } }, xshell: { assets: { basePath: "/_assets" } } };
    const areas = new Areas({ config, bus: new EventTarget() }, { default: "main", definitions: { main: { prefix: "/main", modules: ["reports"] } } });
    areas.init({ modules: { getModuleById: id => ({ id, config: config.modules[id] }) } });
    const state = { ...structuredClone(WorkspacePage.state), menuName: "reports", src: null };
    const page = {};
    const controller = WorkspacePage.controller({ state, areas, page });

    controller.load();

    assert.deepEqual(page, { label: localReports.label, description: localReports.description, icon: localReports.icon });
    assert.equal(state.menu, areas.getMenu("reports").items);
    assert.equal(state.src, "/main" + href);
});

test("Workspace preserves a supplied source and tracks the embedded Page for selection and reflection", () => {
    const { state, controller } = createPage("reports", "/pages/preselected.js");
    assert.equal(state.src, "/pages/preselected.js");
    controller.refresh({ event: { detail: { page: { src: href, label: "Overview" } } } });
    assert.equal(state.src, href);
    assert.equal(state.title, "Overview");
    assert.match(WorkspacePage.template, /x-attr:selected="[^"]*menuitem.href == state.src/);
    assert.match(WorkspacePage.template, /open="embed"\s+outlet="content"/);
    assert.match(WorkspacePage.template, /<x-page outlet="content" x-attr:src="state.src" x-on:load="refresh"/);
    assert.match(WorkspacePage.template, /<h4 x-if="state.showTitle">/);
    const { menuName, src, showTitle } = WorkspacePage.contract.properties;
    assert.equal(menuName.query, true);
    assert.ok(src.query && src.reflect);
    assert.ok(showTitle.query && showTitle.default);
});

test("Workspace handles unknown and empty menus", () => {
    const unknown = createPage("unknown");
    assert.deepEqual(unknown.state.menu, []);
    assert.equal(unknown.state.src, null);
    assert.deepEqual(unknown.page, {});

    const empty = createPage("empty");
    assert.deepEqual(empty.state.menu, []);
    assert.equal(empty.state.src, null);
    assert.deepEqual(empty.page, { label: "empty", description: "", icon: null });
});

test("bundled manifests compose Preferences and Diagnostics shortcuts as global menus", () => {
    const resources = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);
    const readManifest = id => JSON.parse(readFileSync(new URL(`${id}/manifest.jsonc`, resources), "utf8").replace(/^\s*\/\/[^\r\n]*/gm, ""));
    const framework = readManifest("xshell");
    const x = readManifest("x");
    const diagnostics = readManifest("xshell-diagnostics");
    const config = { modules: { ...x.modules, ...diagnostics.modules }, xshell: { assets: { basePath: "/_assets" } } };
    const options = { ...framework.xshell.services.areas.options, ...diagnostics.xshell.services.areas.options };
    options.definitions.main = { modules: ["x", "xshell-diagnostics"] };
    config.modules["xshell-diagnostics"].files = [{ path: "/pages/index.js" }];
    const areas = new Areas({ config, bus: new EventTarget() }, options);
    areas.init({ modules: { getModuleById: id => ({ id, config: config.modules[id] }) } });

    const menu = areas.getMenu("preferences");
    assert.deepEqual([menu.name, menu.scope, menu.label, menu.description, menu.icon],
        ["preferences", "global", "Preferences", "Manage application preferences.", "x-settings"]);
    assert.equal(menu.items[0].href, "/pages/preferences/appearance.js");
    const workspaceSrc = "/pages/workspace.js?menu-name=preferences";
    assert.equal(x.xshell.services.preferences.options.page, workspaceSrc);
    const shortcuts = areas.getMenu("shortcuts").items[0].children;
    assert.equal(shortcuts.find(item => item.label === "Preferences").href, workspaceSrc);
    assert.equal(shortcuts.find(item => item.label === "Diagnostics console").module, "xshell-diagnostics");
    assert.equal(areas.getMenu("shortcuts", "main").scope, "global");
    assert.equal(areas.getMenu("navigation", "main").scope, "area");
});
