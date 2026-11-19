import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import WorkspacePage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/workspace.js";
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";

const href = "/_assets/reports/pages/overview.js";
const reports = { label: "Reports", description: "Review the latest results.", icon: "x-chart",
    items: [{ label: "Group", children: [{ label: "Overview", href }] }, { label: "Other", href: "/pages/other.js" }] };

function createPage(menuName, src = null) {
    const config = { modules: { reports: { menus: { reports, empty: {} } } }, xshell: { assets: { basePath: "/_assets" } } };
    const areas = new Areas({ config, bus: new EventTarget() }, { default: null, global: ["reports", "empty"], definitions: {} });
    const state = { ...structuredClone(WorkspacePage.state), menuName, src };
    const page = {};
    const controller = WorkspacePage.controller({ state, areas, page });
    controller.load();
    return { state, page, controller, areas };
}

test("Workspace uses the requested global menu metadata and opens its first navigable item", () => {
    const { state, page, areas } = createPage("reports");
    assert.deepEqual(page, { label: reports.label, description: reports.description, icon: reports.icon });
    assert.equal(state.menu, areas.getGlobalMenu("reports").items);
    assert.equal(state.src, href);
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

test("the x module configures Preferences as a global Workspace menu", () => {
    const manifest = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x/manifest.jsonc", import.meta.url);
    const config = JSON.parse(readFileSync(manifest, "utf8").replace(/^\s*\/\/[^\r\n]*/gm, ""));
    config.xshell.assets = { basePath: "/_assets" };
    const areas = new Areas({ config, bus: new EventTarget() }, { default: null, global: ["preferences", "shortcuts"], definitions: {} });
    const menu = areas.getGlobalMenu("preferences");
    assert.deepEqual([menu.name, menu.label, menu.description, menu.icon],
        ["preferences", "Preferences", "Manage application preferences.", "x-settings"]);
    assert.equal(menu.items[0].href, "/pages/preferences-appearance.js");
    const workspaceSrc = "/pages/workspace.js?menu-name=preferences";
    assert.equal(config.xshell.services.preferences.options.page, workspaceSrc);
    assert.equal(areas.getGlobalMenu("shortcuts").items[0].children.find(item => item.label === "Preferences").href, workspaceSrc);
});
