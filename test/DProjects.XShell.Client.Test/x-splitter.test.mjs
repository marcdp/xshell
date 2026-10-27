import assert from "node:assert/strict";
import test from "node:test";

import splitter from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-splitter.js";

function setup({ vertical = true, paneSize = 200, nextSize = 300, parentSize = 502,
    min = "100px", minNext = "120px", contentBox = false } = {}) {
    const dimension = vertical ? "width" : "height";
    const pane = { style: {}, getBoundingClientRect() {
        return { [dimension]: pane.style.flex ? parseFloat(pane.style.flex.split(" ").at(-1)) + (contentBox ? 20 : 0) : paneSize };
    } };
    const nextPane = { getBoundingClientRect() { return { [dimension]: paneSize + nextSize - pane.getBoundingClientRect()[dimension] }; } };
    const events = [];
    const host = {
        previousElementSibling: pane,
        nextElementSibling: nextPane,
        parentElement: { [vertical ? "clientWidth" : "clientHeight"]: parentSize },
        getBoundingClientRect() { return { [dimension]: 2 }; },
        dispatchEvent(event) { events.push(event); }
    };
    const handle = {
        setPointerCapture() {},
        hasPointerCapture() { return true; },
        releasePointerCapture() {}
    };
    const originalStyle = globalThis.getComputedStyle;
    const originalEvent = globalThis.CustomEvent;
    globalThis.getComputedStyle = element => ({
        [vertical ? "minWidth" : "minHeight"]: element === pane ? min : element === nextPane ? minNext : "auto",
        boxSizing: element === pane && contentBox ? "content-box" : "border-box",
        paddingLeft: element === pane && contentBox ? "10px" : "0px",
        paddingRight: element === pane && contentBox ? "10px" : "0px",
        paddingTop: "0px", paddingBottom: "0px",
        borderLeftWidth: "0px", borderRightWidth: "0px",
        borderTopWidth: "0px", borderBottomWidth: "0px"
    });
    globalThis.CustomEvent = class { constructor(type, options) { Object.assign(this, { type }, options); } };
    const controller = splitter.controller({ state: { orientation: vertical ? "vertical" : "horizontal", disabled: false }, host });
    return {
        pane, events, controller,
        drag(delta) {
            controller.pointerDown({ event: { button: 0, pointerId: 1, clientX: 0, clientY: 0, currentTarget: handle, preventDefault() {} } });
            controller.pointerMove({ event: { pointerId: 1, clientX: delta, clientY: delta } });
        },
        key(key) { controller.keydown({ event: { key, preventDefault() {} } }); },
        restore() { globalThis.getComputedStyle = originalStyle; globalThis.CustomEvent = originalEvent; }
    };
}

test("pointer resizing stops at both CSS minimums", () => {
    const ui = setup();
    try {
        ui.drag(1000);
        assert.equal(ui.pane.style.flex, "0 0 380px");
        ui.drag(-1000);
        assert.equal(ui.pane.style.flex, "0 0 100px");
    } finally { ui.restore(); }
});

test("keyboard resizing uses the same limits for horizontal panes", () => {
    const ui = setup({ vertical: false, paneSize: 130, nextSize: 120, parentSize: 252,
        min: "100px", minNext: "120px" });
    try {
        ui.key("ArrowDown");
        assert.equal(ui.pane.style.flex, "0 0 130px");
        for (let i = 0; i < 10; i++) ui.key("ArrowUp");
        assert.equal(ui.pane.style.flex, "0 0 100px");
        assert.equal(ui.events.at(-1).detail.size, 100);
    } finally { ui.restore(); }
});

test("content-box pane uses a content-box flex basis and ignores nonnumeric minimums", () => {
    const ui = setup({ contentBox: true, min: "auto", minNext: "none" });
    try {
        ui.drag(-1000);
        assert.equal(ui.pane.style.flex, "0 0 0px");
        ui.drag(1000);
        assert.equal(ui.pane.style.flex, "0 0 480px");
    } finally { ui.restore(); }
});

test("impossible minimums leave the pane at its current size", () => {
    const ui = setup({ parentSize: 200 });
    try {
        ui.drag(1000);
        assert.equal(ui.pane.style.flex, "0 0 200px");
        ui.key("ArrowLeft");
        assert.equal(ui.pane.style.flex, "0 0 200px");
    } finally { ui.restore(); }
});
