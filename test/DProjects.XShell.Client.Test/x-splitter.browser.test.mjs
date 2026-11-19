import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import splitter from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-splitter.js";
import filesystem from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/components/x-filesystem.js";
import store from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/pages/store.js";
import workspace from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/workspace.js";
import layout from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-main.js";

// Run the real consumer CSS and splitter controller in a local document with no application services.
async function verifyLayout(splitter, layout, styles) {
    // Use the same stylesheet API as XShell under its style policy.
    function applyStyle(root, css) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        root.adoptedStyleSheets = [sheet];
    }
    applyStyle(document, "html {font-size:16px} body {margin:0; overflow:hidden}");

    function near(actual, expected, label) {
        if (!(Math.abs(actual - expected) <= 0.05)) throw new Error(`${label}: received ${actual}, expected ${expected}`);
    }

    function mount(name, markup, css, width = 1200) {
        const fixture = document.body.appendChild(document.createElement("main"));
        const root = fixture.attachShadow({ mode: "open" });
        root.innerHTML = `<div class="fixture">${markup}</div>`;
        applyStyle(root, `.fixture {width:${width}px} ${css.replaceAll(":scope", ".fixture")}`);
        const host = root.querySelector("x-splitter");
        host.attachShadow({ mode: "open" }).innerHTML = splitter.template;
        applyStyle(host.shadowRoot, splitter.style);
        const parent = host.parentElement, pane = host.previousElementSibling, next = host.nextElementSibling;
        const vertical = getComputedStyle(parent).flexDirection.startsWith("column");
        const axis = vertical ? "height" : "width";
        const handle = host.shadowRoot.querySelector(".handle");
        const controller = splitter.controller({ host, state: { disabled: false }, postRender: method => controller[method]() });
        const events = [];
        host.addEventListener("change", event => events.push(event));
        host.addEventListener("resize", event => events.push(event));
        controller.mount();
        if (handle.getAttribute("role") !== "separator" || handle.getAttribute("aria-orientation") !== (vertical ? "horizontal" : "vertical")) {
            throw new Error(`${name}: incorrect separator semantics`);
        }

        // The controller receives synthetic input while layout and event dispatch use the browser DOM.
        const capture = { setPointerCapture() {}, hasPointerCapture() { return false; } };
        function pointer(delta) {
            return { button: 0, pointerId: 1, clientX: delta, clientY: delta, currentTarget: capture, preventDefault() {} };
        }
        return {
            fixture, host, parent, pane, next, axis,
            size(element) { return element.getBoundingClientRect()[axis]; },
            drag(delta) {
                controller.pointerDown({ event: pointer(0) });
                controller.pointerMove({ event: pointer(delta) });
                controller.pointerUp({ event: pointer(delta) });
            },
            key(key) { controller.keydown({ event: { key, preventDefault() {} } }); },
            check(first, second, space = this.size(parent)) {
                near(this.size(pane), first, `${name} preceding pane`);
                near(this.size(next), second, `${name} following pane`);
                near(this.size(pane) + this.size(host) + this.size(next), space, `${name} occupied space`);
                for (const event of events.splice(0)) near(event.detail.size, first, `${name} ${event.type}`);
            }
        };
    }

    for (const [name, markup, style, max] of [
        ["Filesystem", '<div class="container"><x-filesystem-tree></x-filesystem-tree><x-splitter></x-splitter><x-filesystem-list></x-filesystem-list></div>',
            styles.filesystem, 1200 - 448 - 2.4],
        ["Store", '<div class="workspace"><section class="collections"></section><x-splitter></x-splitter><section class="documents"></section></div>',
            styles.store, 384]
    ]) {
        const ui = mount(name, markup, style);
        const total = ui.size(ui.parent) - ui.size(ui.host);
        const before = ui.size(ui.pane);
        ui.drag(50);
        ui.check(before + 50, total - before - 50);
        ui.drag(-30);
        ui.check(before + 20, total - before - 20);
        ui.drag(2000);
        ui.check(max, total - max);
        ui.drag(-2000);
        ui.check(192, total - 192);
        if (ui.next.style.flexBasis) throw new Error(`${name}: the growing pane's basis was overridden`);
    }

    const workspaceMarkup = '<div><div class="menu-container"></div><x-splitter></x-splitter><div class="page-container"></div></div>';
    const currentWorkspace = mount("Workspace", workspaceMarkup, styles.workspace, 1800);
    const menuSize = currentWorkspace.size(currentWorkspace.pane) + 100;
    const occupied = currentWorkspace.size(currentWorkspace.parent) - currentWorkspace.size(currentWorkspace.host);
    currentWorkspace.drag(100);
    currentWorkspace.check(menuSize, occupied - menuSize);

    const limitedWorkspace = mount("Workspace with percentage limits", workspaceMarkup,
        styles.workspace + ":scope > div .page-container {min-width:50%; max-width:80%}", 1800);
    const workspaceTotal = limitedWorkspace.size(limitedWorkspace.parent) - limitedWorkspace.size(limitedWorkspace.host);
    const pageStyle = getComputedStyle(limitedWorkspace.next);
    const pageInset = pageStyle.boxSizing === "border-box" ? 0 : ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"]
        .reduce((sum, name) => sum + parseFloat(pageStyle[name]), 0);
    const pageMin = 900 + pageInset, pageMax = 1440 + pageInset;
    limitedWorkspace.drag(2000);
    limitedWorkspace.check(workspaceTotal - pageMin, pageMin);
    limitedWorkspace.drag(-2000);
    limitedWorkspace.check(workspaceTotal - pageMax, pageMax);

    for (const [position, arrow] of [["right", "ArrowLeft"], ["bottom", "ArrowUp"]]) {
        const ui = mount(`${position} dock`, `<div class="dock-container ${position}"><div class="docked-main"></div>
            <x-splitter></x-splitter><div class="docked-page"></div></div>`, styles.layout);
        const total = ui.size(ui.parent) - ui.size(ui.host);
        const sizeKey = `x-layout-main.dockSize.${position}`;
        const values = new Map();
        const dock = layout.controller({
            state: { dockPosition: position }, host: ui.fixture,
            preferences: { async get(key) { return values.get(key); }, async set(key, value) { values.set(key, value); } }
        });
        dock.refreshMenuHeight = () => {};
        ui.host.addEventListener("resize", event => dock.onDockResize({ event }));

        ui.drag(40);
        ui.check(total - 360, 360);
        ui.key(arrow);
        ui.check(total - 370, 370);
        await dock.restoreDockSize();
        if (values.get(sizeKey) !== "370") throw new Error(`${position} dock: measured size was not persisted`);
        ui.check(total - 370, 370);

        values.delete(sizeKey);
        await dock.restoreDockSize();
        ui.check(total - 400, 400);
        ui.drag(40);
        ui.check(total - 360, 360);
        await dock.restoreDockSize();
        ui.check(total - 360, 360);
        ui.next.style.removeProperty("flex");
        ui.check(total - 400, 400);
    }

    for (const direction of ["row-reverse", "column-reverse"]) {
        const ui = mount(direction, '<div class="panes"><div></div><x-splitter></x-splitter><div></div></div>', `
            .panes {display:flex; flex-direction:${direction}; height:600px}
            .panes > div:first-child {flex:1 1 0; min-width:0; min-height:0}
            .panes > div:last-child {flex:2 1 0; min-width:0; min-height:0}`, 600);
        const total = ui.size(ui.parent) - ui.size(ui.host);
        const before = ui.size(ui.pane);
        ui.drag(-50);
        ui.check(before + 50, total - before - 50);
        ui.drag(30);
        ui.check(before + 20, total - before - 20);
        if (getComputedStyle(ui.pane).flexGrow !== "1" || getComputedStyle(ui.next).flexGrow !== "2") {
            throw new Error(`${direction}: the grow factors changed`);
        }
    }

    const contentBox = mount("Content boxes", '<div class="panes"><div><span></span></div><x-splitter></x-splitter><div></div></div>', `
        .panes {display:flex; padding:10px; border:4px solid; gap:5px; box-sizing:border-box}
        .panes > div:first-child {flex:0 0 200px; max-width:60%; padding:10px; border:2px solid}
        .panes span {display:block; width:140px}
        .panes > div:last-child {flex:0 0 200px; min-width:20%; padding:5px; border:2px solid}
        x-splitter {margin:0 3px}`, 528);
    const space = 500 - 10 - 6;
    const total = space - contentBox.size(contentBox.host);
    contentBox.drag(-1000);
    contentBox.check(164, total - 164, space);
    contentBox.drag(1000);
    contentBox.check(324, total - 324, space);

    for (const [height, min, max] of [["400px", 100, 240], ["auto", 0, 398]]) {
        const ui = mount(`Column with ${height} height`, '<div class="panes"><div></div><x-splitter></x-splitter><div></div></div>', `
            .panes {display:flex; flex-direction:column; height:${height}}
            .panes > div:first-child {flex:0 0 160px; min-height:25%; max-height:60%}
            .panes > div:last-child {flex:0 0 238px; min-height:20%}`);
        const space = ui.size(ui.parent);
        const total = space - ui.size(ui.host);
        ui.drag(-1000);
        ui.check(min, total - min, space);
        ui.drag(1000);
        ui.check(max, total - max, space);
    }

    const impossible = mount("Impossible minimums", '<div class="panes"><div></div><x-splitter></x-splitter><div></div></div>', `
        .panes {display:flex}
        .panes > div {flex:0 0 25%; min-width:60%}`, 200);
    impossible.drag(100);
    near(impossible.size(impossible.pane), 120, "impossible preceding pane");
    near(impossible.size(impossible.next), 120, "impossible following pane");
    const inline = [impossible.pane, impossible.next].map(pane => pane.getAttribute("style"));
    if (inline.some(value => value !== null)) throw new Error(`impossible pane sizes were overwritten: ${JSON.stringify(inline)}`);

    // Probe a pane with a partial inline flex declaration and an unrelated style.
    const { style } = impossible.next;
    style.setProperty("flex-basis", "50px", "important");
    style.color = "red";
    impossible.key("ArrowRight");
    if (style.flexBasis !== "50px" || style.getPropertyPriority("flex-basis") !== "important" ||
        style.flexGrow || style.flexShrink || style.color !== "red") {
        throw new Error(`sizing probe changed the original declarations: ${style.cssText}`);
    }
}

const browser = process.env.XSHELL_TEST_BROWSER;
test("splitter resizes consumer panes under CSP in a Chromium browser", { skip: !browser && "Set XSHELL_TEST_BROWSER to a Chromium executable" }, () => {
    const temp = mkdtempSync(join(tmpdir(), "xshell-splitter-"));
    try {
        const file = join(temp, "splitter.html");
        const styles = { filesystem: filesystem.style, store: store.style, workspace: workspace.style, layout: layout.style };
        writeFileSync(file, `<!doctype html><meta charset="utf-8">
            <meta http-equiv="Content-Security-Policy" content="style-src 'self'; style-src-attr 'none'">
            <body data-result="pending"><script>
            document.addEventListener("securitypolicyviolation", event => document.body.dataset.violation = event.effectiveDirective);
            (${verifyLayout})({ ${splitter.controller}, style:${JSON.stringify(splitter.style)}, template:${JSON.stringify(splitter.template)} },
                { ${layout.controller} }, ${JSON.stringify(styles)}).then(
                    () => document.body.dataset.result = "passed",
                    error => { document.body.dataset.result = "failed"; document.body.append(error.stack); }
                );
            </script>`);
        const result = spawnSync(browser, [
            "--headless", "--disable-gpu", "--disable-background-networking", "--no-first-run",
            `--user-data-dir=${join(temp, "profile")}`, "--window-size=1600,1000", "--virtual-time-budget=1000", "--dump-dom", pathToFileURL(file).href
        ], { encoding: "utf8", timeout: 30_000 });
        if (result.error) throw result.error;
        assert.equal(result.status, 0, result.stderr);
        const violation = result.stdout.match(/<body[^>]*data-violation="([^"]+)"/)?.[1];
        assert.equal(violation, undefined, `Browser reported a CSP violation for ${violation}`);
        const status = result.stdout.match(/<body[^>]*data-result="([^"]+)"/)?.[1];
        const failure = result.stdout.slice(result.stdout.lastIndexOf("</script>") + "</script>".length, result.stdout.lastIndexOf("</body>"));
        assert.equal(status, "passed", failure || "Browser did not complete the layout checks");
    } finally {
        rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
    }
});
