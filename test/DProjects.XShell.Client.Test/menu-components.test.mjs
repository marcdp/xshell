import assert from "node:assert/strict";
import test from "node:test";

import menuDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-menu.js";
import menuItemDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-menuitem.js";
import pageMenuDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-area-menu.js";

const menuItemContract = menuItemDefinition.contract;

test("x-area-menu reads the effective navigation items and handles a missing menu", () => {
    const state = {};
    const items = [{ label: "Home", href: "/pages/index.js" }];
    let menu = { name: "navigation", label: "Navigation", description: "", icon: null, items };
    const controller = pageMenuDefinition.controller({ state, areas: { getMenu: () => menu } });
    controller.refresh();
    assert.equal(state.menu, items);
    menu = null;
    controller.refresh();
    assert.deepEqual(state.menu, []);
});

test("x-area-menu uses descriptions as tooltip fallbacks without overriding explicit tooltips", () => {
    assert.match(pageMenuDefinition.template, /x-attr:tooltip="menuitem\.tooltip \|\| menuitem\.description"/);
});

test("x-menu passes canonical tooltip and embedded properties to x-menuitem", () => {
    assert.match(menuDefinition.template, /x-attr:tooltip="menuitem\.tooltip"/);
    assert.match(menuDefinition.template, /x-attr:embedded="menuitem\.embedded"/);
});

test("x-menuitem exposes tooltip and embedded as public attributes", () => {
    assert.deepEqual(menuItemContract.properties.tooltip, {
        type: "string",
        default: "",
        attribute: true,
        state: true,
        description: "Optional tooltip text shown on the navigation anchor."
    });
    assert.deepEqual(menuItemContract.properties.embedded, {
        type: "boolean",
        default: false,
        attribute: true,
        state: true,
        description: "Hosts the target Page inline instead of rendering a navigation anchor."
    });
});


test("x-menuitem renders tooltip on a normal anchor and an embedded target as an inline Page", () => {
    assert.match(
        menuItemDefinition.template,
        /<div x-elseif="state\.embedded">\s*<x-page\s+x-attr:src="state\.href"\s+loading="lazy"><\/x-page>\s*<\/div>/
    );

    assert.match(
        menuItemDefinition.template,
        /<x-anchor x-else[^>]*x-attr:tooltip="state\.tooltip"/
    );
});
