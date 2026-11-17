import assert from "node:assert/strict";
import test from "node:test";
import layout from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-main.js";

const settle = () => new Promise(resolve => setImmediate(resolve));

function setup() {
    const values = new Map(), writes = [], listeners = new Map();
    const style = {flex:"", removeProperty() { this.flex = ""; }};
    const viewport = {width:1000, height:800};
    const panel = {style, getBoundingClientRect: () => ({width:365.2, height:245.4})};
    const elements = {
        ".docked-page":panel, ".docked-main":{getBoundingClientRect: () => ({width:600, height:500})},
        ".dock-container":{getBoundingClientRect: () => viewport}, "x-splitter":{getBoundingClientRect: () => ({width:2, height:2})}
    };
    const host = {shadowRoot:{querySelector: selector => elements[selector] || null}};
    const state = new Proxy({dockPosition:"bottom", dockSrc:"/dock.js", toggled:false}, {set(target, prop, value) {
        const oldValue = target[prop];
        target[prop] = value;
        if (oldValue !== value) {
            for (const [names, callback] of listeners) {
                if (names.split(",").includes(`change:${prop}`)) callback({prop, oldValue, newValue:value});
            }
        }
        return true;
    }});
    const preferences = {
        async get(key) { return values.get(key); },
        async set(key, value) { writes.push([key, value]); values.set(key, value); },
        async delete(key) { writes.push([key, null]); values.delete(key); }
    };
    const originalStyle = globalThis.getComputedStyle, originalDocument = globalThis.document;
    globalThis.getComputedStyle = () => ({minWidth:"160px", minHeight:"160px"});
    globalThis.document = {documentElement:{setAttribute() {}, removeAttribute() {}}};
    const controller = layout.controller({
        state, host, preferences, bus:{}, getPage:() => null, postRender() {},
        events:{on(target, names, callback) { listeners.set(String(names), callback); }}
    });
    controller.refreshMenuHeight = () => {};
    return {controller, state, style, viewport, elements, values, writes, listeners, preferences, restore() {
        if (originalStyle === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = originalStyle;
        if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
    }};
}

test("dock resize persists only the measured final size", async () => {
    const ui = setup();
    try {
        ui.controller.onDockResize({event:{type:"change", detail:{size:900}}});
        await settle();
        assert.deepEqual(ui.writes, []);
        ui.controller.onDockResize({event:{type:"resize", detail:{size:900}}});
        await settle();
        assert.deepEqual(ui.writes, [["xshell.dockSize.bottom", "245"]]);
        ui.state.dockPosition = "right";
        ui.controller.onDockResize({event:{type:"resize"}});
        await settle();
        assert.deepEqual(ui.writes.at(-1), ["xshell.dockSize.right", "365"]);
    } finally { ui.restore(); }
});

test("dock sizes restore independently and clamp to the viewport", async () => {
    const ui = setup();
    try {
        ui.values.set("xshell.dockSize.bottom", "600");
        ui.values.set("xshell.dockSize.right", "300");
        await ui.controller.restoreDockSize();
        assert.equal(ui.style.flex, "0 0 600px");
        ui.viewport.height = 500;
        await ui.controller.restoreDockSize();
        assert.equal(ui.style.flex, "0 0 338px");
        ui.state.dockPosition = "right";
        await ui.controller.restoreDockSize();
        assert.equal(ui.style.flex, "0 0 300px");
        ui.elements[".docked-page"] = null;
        await ui.controller.restoreDockSize();
    } finally { ui.restore(); }
});

test("invalid or failed dock size reads restore the CSS default", async () => {
    const ui = setup();
    try {
        for (const value of [undefined, "invalid", "0", "-20", "Infinity"]) {
            ui.style.flex = "0 0 200px";
            if (value === undefined) ui.values.delete("xshell.dockSize.bottom");
            else ui.values.set("xshell.dockSize.bottom", value);
            await ui.controller.restoreDockSize();
            assert.equal(ui.style.flex, "");
        }
        ui.preferences.get = async () => { throw new Error("unavailable"); };
        ui.style.flex = "0 0 200px";
        await ui.controller.restoreDockSize();
        assert.equal(ui.style.flex, "");
    } finally { ui.restore(); }
});

test("load restores saved layout values without persisting defaults", async () => {
    const ui = setup();
    try {
        ui.values.set("xshell.toggled", "true");
        ui.values.set("xshell.dockSrc", "/saved.js");
        ui.values.set("xshell.dockPosition", "right");
        await ui.controller.load();
        assert.equal(ui.state.toggled, true);
        assert.equal(ui.state.dockSrc, "/saved.js");
        assert.equal(ui.state.dockPosition, "right");
        assert.deepEqual(ui.writes, []);
    } finally { ui.restore(); }
});

test("rapid menu and dock updates leave the latest values", async () => {
    const ui = setup();
    try {
        await ui.controller.load();
        ui.controller.onToggleMenu();
        ui.controller.onToggleMenu();
        ui.state.dockSrc = "/first.js";
        ui.state.dockSrc = "/second.js";
        ui.state.dockPosition = "right";
        await settle();
        assert.equal(ui.values.get("xshell.toggled"), "false");
        assert.equal(ui.values.get("xshell.dockSrc"), "/second.js");
        assert.equal(ui.values.get("xshell.dockPosition"), "right");
    } finally { ui.restore(); }
});

test("changes made during a delayed load take precedence over saved values", async () => {
    const ui = setup();
    try {
        const pending = new Map();
        ui.preferences.get = key => new Promise(resolve => pending.set(key, resolve));
        const loading = ui.controller.load();
        ui.controller.onToggleMenu();
        ui.state.dockSrc = "/new.js";
        pending.get("xshell.toggled")("false");
        pending.get("xshell.dockSrc")("/old.js");
        pending.get("xshell.dockPosition")("right");
        await loading;
        await settle();
        assert.equal(ui.state.toggled, true);
        assert.equal(ui.state.dockSrc, "/new.js");
        assert.equal(ui.state.dockPosition, "right");
        assert.equal(ui.values.get("xshell.dockSrc"), "/new.js");
    } finally { ui.restore(); }
});

test("a delayed dock size read cannot overwrite a newer resize", async () => {
    const ui = setup();
    try {
        let finishRead;
        ui.preferences.get = () => new Promise(resolve => { finishRead = resolve; });
        const restoring = ui.controller.restoreDockSize();
        await settle();
        ui.controller.onDockResize({event:{type:"resize"}});
        finishRead("600");
        await restoring;
        assert.equal(ui.style.flex, "");
        await settle();
        assert.equal(ui.values.get("xshell.dockSize.bottom"), "245");
    } finally { ui.restore(); }
});

test("closing a dock deletes its source and storage failures do not interrupt changes", async () => {
    const ui = setup();
    try {
        await ui.controller.load();
        ui.values.set("xshell.dockSrc", "/dock.js");
        ui.preferences.delete = async () => { throw new Error("delete failed"); };
        ui.state.dockSrc = null;
        ui.controller.onToggleMenu();
        await settle();
        assert.equal(ui.values.get("xshell.toggled"), "true");
        assert.equal(ui.values.get("xshell.dockSrc"), "/dock.js");
    } finally { ui.restore(); }
});
