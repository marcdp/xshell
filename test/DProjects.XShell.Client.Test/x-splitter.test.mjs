import assert from "node:assert/strict";
import test from "node:test";

import splitter from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-splitter.js";

function setup(t, { direction = "row", total = 500, first = {}, second = {}, disabled = false } = {}) {
    const vertical = direction.startsWith("column");
    const axis = vertical ? "height" : "width";
    const dimension = vertical ? "Height" : "Width";
    const sides = vertical ? ["Top", "Bottom"] : ["Left", "Right"];

    // Each pane keeps its own basis and can grow only when its CSS allows it.
    function createPane({ basis, grow = 0, min = 0, max = Infinity, inset = 0 }) {
        const css = {
            flexGrow: String(grow), boxSizing: inset ? "content-box" : "border-box",
            ["min" + dimension]: `${min}px`, ["max" + dimension]: max === Infinity ? "none" : `${max}px`,
            ["padding" + sides[0]]: `${inset / 2}px`, ["border" + sides[1] + "Width"]: `${inset / 2}px`
        };
        const style = {};
        return {
            style, css, grow,
            baseSize() {
                const value = style.flexBasis ?? style.flex?.split(" ").at(-1) ?? basis;
                return Math.min(max, Math.max(min, parseFloat(value))) + inset;
            },
            getBoundingClientRect() {
                const remaining = Math.max(0, total - pane.baseSize() - next.baseSize());
                const effectiveGrow = style.flex ? Number(style.flex.split(" ")[0]) : grow;
                const growSum = [pane, next].reduce((sum, item) => sum + Number(item.style.flex?.split(" ")[0] ?? item.grow), 0);
                return { [axis]: Math.min(max + inset, this.baseSize() + remaining * effectiveGrow / Math.max(1, growSum)) };
            }
        };
    }

    const pane = createPane({ basis: 200, ...first });
    const next = createPane({ basis: 300, ...second });
    const attributes = new Map(), events = [];
    const handle = {
        captured: null,
        setAttribute(name, value) { attributes.set(name, value); },
        setPointerCapture(id) { this.captured = id; },
        hasPointerCapture(id) { return this.captured === id; },
        releasePointerCapture() { this.captured = null; }
    };
    const parent = {
        ["client" + dimension]: total + 2,
        css: { flexDirection: direction, flexWrap: "nowrap", columnGap: "normal", rowGap: "normal" },
        getBoundingClientRect: () => ({ [axis]: total + 2 })
    };
    const host = {
        css: {}, previousElementSibling: pane, nextElementSibling: next, parentElement: parent,
        shadowRoot: { querySelector: () => handle },
        getBoundingClientRect: () => ({ [axis]: 2 }),
        dispatchEvent(event) { events.push([event.type, event.detail.size, event.bubbles]); }
    };
    parent.children = [pane, host, next];
    const originalStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = element => element.css;
    t.after(() => {
        if (originalStyle === undefined) delete globalThis.getComputedStyle;
        else globalThis.getComputedStyle = originalStyle;
    });
    const controller = splitter.controller({ state: { disabled }, host, postRender: method => controller[method]() });
    controller.mount();

    return {
        attributes, events, pane, next, handle,
        down(options = {}) {
            let prevented = false;
            controller.pointerDown({ event: {
                button: 0, pointerId: 1, clientX: 0, clientY: 0, currentTarget: handle, preventDefault() { prevented = true; }, ...options
            } });
            return prevented;
        },
        move(delta, pointerId = 1) {
            controller.pointerMove({ event: { pointerId, clientX: vertical ? 999 : delta, clientY: vertical ? delta : 999 } });
        },
        up() {
            controller.pointerUp({ event: { pointerId: 1, currentTarget: handle } });
        },
        key(key, shiftKey = false) {
            let prevented = false;
            controller.keydown({ event: { key, shiftKey, preventDefault() { prevented = true; } } });
            return prevented;
        },
        assertSizes(firstSize, secondSize) {
            const sizes = [pane, next].map(item => item.getBoundingClientRect()[axis]);
            assert.deepEqual(sizes, [firstSize, secondSize]);
            assert.equal(sizes[0] + sizes[1] + host.getBoundingClientRect()[axis], parent["client" + dimension]);
        }
    };
}

for (const [name, first, second, expectedBases] of [
    ["fixed preceding pane", { basis: 200 }, { grow: 1, basis: 0 }, ["150px", undefined]],
    ["fixed following pane", { grow: 1, basis: 0 }, { basis: 300 }, [undefined, "350px"]],
    ["two fixed panes", {}, {}, ["150px", "350px"]],
    ["two flexible panes", { grow: 1, basis: 0 }, { grow: 3, basis: 200 }, ["25px", "475px"]],
    ["partial growth", { basis: 200 }, { grow: 0.5 }, ["150px", "350px"]]
]) {
    test(`horizontal dragging resizes both panes with ${name}`, t => {
        const ui = setup(t, { first, second });
        const start = name === "two flexible panes" ? 75 : 200;
        ui.assertSizes(start, 500 - start);
        assert.equal(ui.down(), true);
        assert.equal(ui.handle.captured, 1);
        ui.move(60, 2);
        ui.assertSizes(start, 500 - start);
        ui.move(60);
        ui.assertSizes(start + 60, 440 - start);
        ui.move(-50);
        ui.assertSizes(start - 50, 550 - start);
        ui.up();
        assert.equal(ui.handle.captured, null);
        assert.deepEqual([ui.pane.style.flexBasis, ui.next.style.flexBasis], expectedBases);
        assert.deepEqual([ui.pane.style.flex, ui.next.style.flex], [undefined, undefined]);
        assert.deepEqual(ui.events, [
            ["change", start + 60, true], ["change", start - 50, true], ["resize", start - 50, true], ["change", start - 50, true]
        ]);
    });
}

for (const [direction, delta, arrow, aria] of [
    ["column", 40, "ArrowDown", "horizontal"],
    ["column-reverse", -40, "ArrowUp", "horizontal"],
    ["row-reverse", -40, "ArrowLeft", "vertical"]
]) {
    test(`${direction} uses the correct pointer axis, arrow keys and separator orientation`, t => {
        const ui = setup(t, { direction, first: { grow: 1, basis: 0 } });
        assert.equal(ui.attributes.get("aria-orientation"), aria);
        ui.down();
        ui.move(delta);
        ui.up();
        ui.assertSizes(240, 260);
        assert.equal(ui.key(arrow), true);
        ui.assertSizes(250, 250);
        assert.equal(ui.key(arrow, true), true);
        ui.assertSizes(251, 249);
        assert.deepEqual(ui.events.slice(-4), [
            ["resize", 250, true], ["change", 250, true], ["resize", 251, true], ["change", 251, true]
        ]);
    });
}

test("pixel bounds account for both content boxes", t => {
    const ui = setup(t, { total: 498, first: { basis: 185, min: 100, max: 200, inset: 15 }, second: { basis: 288, min: 150, max: 350, inset: 10 } });
    ui.down();
    ui.move(1000);
    ui.assertSizes(215, 283);
    assert.equal(ui.pane.style.flexBasis, "200px");
    ui.move(-1000);
    ui.assertSizes(138, 360);
    assert.equal(ui.next.style.flexBasis, "350px");
    ui.up();
    assert.equal(ui.key("ArrowLeft"), true);
    ui.assertSizes(138, 360);
});

test("the remaining pane's minimum and the preceding pane's minimum bound the drag", t => {
    const ui = setup(t, { first: { min: 100, grow: 1, basis: 0 }, second: { min: 120 } });
    ui.down();
    ui.move(1000);
    ui.assertSizes(380, 120);
    ui.move(-1000);
    ui.assertSizes(100, 400);
});

test("impossible constraints leave the current bases alone", t => {
    const ui = setup(t, { total: 200, first: { basis: 0, min: 110 }, second: { basis: 0, min: 120 } });
    ui.down();
    ui.move(1000);
    ui.up();
    ui.key("ArrowLeft");
    assert.deepEqual([ui.pane.style, ui.next.style], [{}, {}]);
    assert.deepEqual(ui.events.map(event => event[1]), [110, 110, 110, 110, 110]);
});

test("disabled blocks pointer and keyboard resizing", t => {
    const disabled = setup(t, { disabled: true });
    assert.equal(disabled.down(), false);
    disabled.move(20);
    assert.equal(disabled.key("ArrowRight"), false);
    disabled.assertSizes(200, 300);
    assert.deepEqual(disabled.events, []);
});

test("non-primary pointer and cross-axis key interactions leave both panes alone", t => {
    const enabled = setup(t);
    assert.equal(enabled.down({ button: 1 }), false);
    enabled.move(20);
    assert.equal(enabled.key("ArrowDown"), false);
    enabled.assertSizes(200, 300);
    assert.deepEqual(enabled.events, []);
});
