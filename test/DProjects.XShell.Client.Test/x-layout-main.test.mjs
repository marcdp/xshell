import assert from "node:assert/strict";
import test from "node:test";

import layout from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-main.js";

function setup({ position = "bottom", panelWidth = 320, panelHeight = 240, containerWidth = 1000, containerHeight = 800 } = {}) {
    const values = new Map();
    const writes = [];
    const style = {
        flex: "",
        removeProperty(property) { if (property === "flex") this.flex = ""; }
    };
    const panel = { style, getBoundingClientRect: () => ({ width: panelWidth, height: panelHeight }) };
    const main = { getBoundingClientRect: () => ({ width: 600, height: 500 }) };
    const viewport = { width: containerWidth, height: containerHeight };
    const container = { getBoundingClientRect: () => viewport };
    const splitter = { getBoundingClientRect: () => ({ width: 2, height: 2 }) };
    const elements = { ".docked-page": panel, ".docked-main": main, ".dock-container": container, "x-splitter": splitter };
    const host = { shadowRoot: { querySelector: selector => elements[selector] || null } };
    const state = { dockPosition: position, dockSrc: "/dock.js" };
    const originalStorage = globalThis.localStorage;
    const originalStyle = globalThis.getComputedStyle;
    globalThis.localStorage = {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { writes.push([key, String(value)]); values.set(key, String(value)); }
    };
    globalThis.getComputedStyle = () => ({ minWidth: "160px", minHeight: "160px" });
    const controller = layout.controller({ state, host });
    return {
        controller, state, style, values, writes, elements, viewport,
        restore() {
            if (originalStorage === undefined) delete globalThis.localStorage;
            else globalThis.localStorage = originalStorage;
            if (originalStyle === undefined) delete globalThis.getComputedStyle;
            else globalThis.getComputedStyle = originalStyle;
        }
    };
}

test("dock resize persists measured bottom height only when resizing finishes", () => {
    const ui = setup({ panelHeight: 275.6 });
    try {
        ui.controller.onDockResize({ event: { type: "change", detail: { size: 900 } } });
        assert.deepEqual(ui.writes, []);

        ui.controller.onDockResize({ event: { type: "resize", detail: { size: 900 } } });
        assert.deepEqual(ui.writes, [["xshell.dockSize.bottom", "276"]]);
    } finally { ui.restore(); }
});

test("bottom and right dock sizes persist and restore independently", () => {
    const ui = setup({ panelWidth: 365.2, panelHeight: 245.4 });
    try {
        ui.controller.onDockResize({ event: { type: "resize" } });
        ui.state.dockPosition = "right";
        ui.controller.onDockResize({ event: { type: "resize" } });
        assert.deepEqual(ui.writes, [
            ["xshell.dockSize.bottom", "245"],
            ["xshell.dockSize.right", "365"]
        ]);

        ui.style.flex = "";
        ui.controller.restoreDockSize();
        assert.equal(ui.style.flex, "0 0 365px");
        ui.state.dockPosition = "bottom";
        ui.controller.restoreDockSize();
        assert.equal(ui.style.flex, "0 0 245px");
    } finally { ui.restore(); }
});

test("reopening restores the saved size and clamps it after viewport changes", () => {
    const ui = setup();
    try {
        ui.values.set("xshell.dockSize.bottom", "600");
        ui.elements[".docked-page"] = null;
        ui.controller.restoreDockSize();

        ui.elements[".docked-page"] = { style: ui.style, getBoundingClientRect: () => ({ width: 320, height: 240 }) };
        ui.controller.restoreDockSize();
        assert.equal(ui.style.flex, "0 0 600px");

        ui.viewport.height = 500;
        ui.controller.restoreDockSize();
        assert.equal(ui.style.flex, "0 0 338px");

        ui.values.set("xshell.dockSize.bottom", "20");
        ui.controller.restoreDockSize();
        assert.equal(ui.style.flex, "0 0 160px");
    } finally { ui.restore(); }
});

test("invalid or unavailable stored sizes restore the CSS default", () => {
    const ui = setup();
    try {
        for (const value of [null, "invalid", "0", "-20", "Infinity"]) {
            ui.style.flex = "0 0 200px";
            if (value === null) ui.values.delete("xshell.dockSize.bottom");
            else ui.values.set("xshell.dockSize.bottom", value);
            ui.controller.restoreDockSize();
            assert.equal(ui.style.flex, "");
        }

        globalThis.localStorage.getItem = () => { throw new Error("unavailable"); };
        ui.style.flex = "0 0 200px";
        ui.controller.restoreDockSize();
        assert.equal(ui.style.flex, "");
    } finally { ui.restore(); }
});
