import assert from "node:assert/strict";
import { getEventListeners, once } from "node:events";
import test from "node:test";

import contextMenu from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-contextmenu.js";
import datafield from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-datafield.js";
import menuItem from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-menuitem.js";
import searchPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/search.js";

const resources = "../../src/DProjects.XShell/Resources/DProjects.XShell/";
const frames = new Map();
let nextFrame = 0;

class FakePageElement extends EventTarget {
    localName = "x-page";
    nodeName = "X-PAGE";
    adoptedStyleSheets = [];

    attachShadow() { this.shadowRoot = { appendChild: layout => { this.shadowRoot.firstChild = layout; } }; }
    setAttribute() {}
    getAttribute(name) { return name === "src" ? this.src : null; }
    getRootNode() { return this; }
    querySelector() { return null; }
}

globalThis.HTMLElement = FakePageElement;
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; }
    observe(page) { page.enterViewport = () => this.callback([{isIntersecting: true}]); }
};
globalThis.window = {innerWidth: 1000, location: new URL("https://example.test/")};
globalThis.document = new class extends EventTarget {
    baseURI = "https://example.test/";
    createElement(localName) { return {localName, setAttribute() {}, removeAttribute() {}}; }
    removeEventListener(type, listener, capture = false) {
        // Match the browser's boolean capture argument when using Node's EventTarget.
        super.removeEventListener(type, listener, {capture});
    }
};
globalThis.requestAnimationFrame = callback => {
    frames.set(++nextFrame, callback);
    return nextFrame;
};
globalThis.cancelAnimationFrame = id => frames.delete(id);

const { createXPageClass } = await import(resources + "xshell/x-page.js");
const { createPageClassFromJsDefinition } = await import(resources + "xshell/loaders/page-js.js");

class StateEngineFactory {
    constructor(state) { this.state = state; }
    create() { return structuredClone(this.state); }
}

class RenderEngineFactory {
    dependencies = [];
    slots = [];
    constructor(template) { this.template = template; }
    init() {}
    create({host}) {
        return { mount() {}, unmount() {}, render: () => host.renderTemplate?.(this.template) };
    }
}

function renderFrame() {
    const ids = [...frames.keys()];
    for (const id of ids) {
        const callback = frames.get(id);
        frames.delete(id);
        callback?.();
    }
}

function createRuntime(t) {
    const pages = new Map();
    const loads = [];
    const services = {
        config: {
            app: {baseUrl: document.baseURI},
            modules: {x: {defaults: {page: {stateEngine: "test", renderEngine: "test"}}}},
            xshell: {ui: {layouts: {embed: "x-layout-embed"}}}
        },
        areas: {getArea() {}, resolveAreaId() {}}, menus: {getMenuitemBreadcrumb() {}},
        modules: {resolveModuleId: () => "x"},
        bus: {emit() {}},
        navigation: {},
        events: {on() {}},
        search: {listProviders: () => []},
        loader: {async load(resource) {
            if (resource === "state-engine:test") return StateEngineFactory;
            if (resource === "render-engine:test") return RenderEngineFactory;
            if (resource.startsWith("page:")) {
                loads.push(resource.slice(5));
                return pages.get(resource.slice(5));
            }
            return {};
        }}
    };
    services.services = {beginScope: () => ({resolve: name => services[name], async dispose() {}})};
    const Host = createXPageClass(services);
    t.after(() => frames.clear());
    return {
        loads,
        async addPage(src, definition) {
            const context = {resourceDefinition: {moduleId: "x"}, services};
            pages.set(src, await createPageClassFromJsDefinition(src, context, definition));
            const host = new Host();
            host.src = src;
            host.loading = "lazy";
            host.connectedCallback();
            return host;
        }
    };
}

function createMenu(t, ...contents) {
    const pending = [];
    const state = {expandOn: "click", expanded: false};
    const anchor = {focused: 0, focus() { this.focused++; }};
    const host = Object.assign(new EventTarget(), {
        localName: "x-menuitem",
        isConnected: true,
        classList: {contains: () => false},
        get firstElementChild() { return contents[0]; },
        getBoundingClientRect: () => ({left: 10, width: 100}),
        closest: () => host,
        querySelectorAll: () => contents,
        shadowRoot: {querySelector: selector => selector === "x-anchor" ? anchor : null}
    });
    for (const element of contents) element.parentElement ??= host;
    const controller = menuItem.controller({state, host, postRender: (...args) => pending.push(args)});
    controller.mount();
    t.after(() => controller.unmount());
    return {
        host, controller, state, anchor, pending,
        render() {
            // Flush callbacks only after the mocked submenu visibility has been applied.
            return Promise.all(pending.splice(0).map(([method, ...args]) => controller[method](...args)));
        }
    };
}

async function loadLazy(page) {
    const loaded = once(page, "load");
    page.enterViewport();
    await loaded;
}

test("an already rendered embedded Page gets focus after menu rendering and on every reopening", async t => {
    const {addPage, loads} = createRuntime(t);
    const focus = t.mock.fn();
    const page = await addPage("/ready.js", {controller: () => ({focus})});
    await loadLazy(page);
    renderFrame();
    const menu = createMenu(t, page);

    for (let count = 1; count <= 2; count++) {
        menu.controller.expand();
        assert.equal(focus.mock.callCount(), count - 1);
        assert.equal(frames.size, 0);
        const [[, {signal}]] = menu.pending;
        const done = menu.render();
        renderFrame();
        await done;
        assert.equal(focus.mock.callCount(), count);
        assert.equal(getEventListeners(signal, "abort").length, 0);
        menu.controller.collapse();
    }
    assert.deepEqual(loads, ["/ready.js"]);
});

test("opening the global Search menu focuses its lazy Search datafield after the Page and field render", async t => {
    const {addPage, loads} = createRuntime(t);
    const page = await addPage("/pages/search.js", searchPage);
    const input = {focus: t.mock.fn()};
    const field = {shadowRoot: {querySelector: () => null}};
    const fieldController = datafield.controller({host: field});
    field.focus = () => fieldController.focus();
    page.renderTemplate = template => {
        assert.match(template, /<x-datafield ref="search"[^>]*autofocus/);
        page.querySelector = selector => selector === '[ref="search"]' ? field : null;
        requestAnimationFrame(() => { field.shadowRoot.querySelector = () => input; });
    };
    const embed = {localName: "x-menuitem", shadowRoot: {querySelector: selector => selector === "x-page" ? page : null}};
    const menu = createMenu(t, embed);

    // Open the Search trigger using the context menu's existing keyboard behavior.
    const trigger = {matches: () => true, expand: () => menu.controller.expand()};
    const keyboard = {key: "ArrowRight", preventDefault: t.mock.fn()};
    contextMenu.controller({host: {querySelectorAll: () => [trigger]}}).keydown({event: keyboard});
    assert.equal(keyboard.preventDefault.mock.callCount(), 1);
    const done = menu.render();
    assert.deepEqual(loads, []);
    await loadLazy(page);
    assert.equal(input.focus.mock.callCount(), 0);
    renderFrame();
    assert.equal(input.focus.mock.callCount(), 0);
    renderFrame();
    await done;
    assert.equal(input.focus.mock.callCount(), 1);

    menu.controller.keydown({key: "Escape", preventDefault() {}, stopPropagation() {}});
    assert.equal(menu.state.expanded, false);
    assert.equal(menu.anchor.focused, 1);
    menu.controller.expand();
    const reopened = menu.render();
    renderFrame();
    await reopened;
    assert.equal(input.focus.mock.callCount(), 2);
    assert.deepEqual(loads, ["/pages/search.js"]);
});

test("dismissing a submenu releases pending work before load, first render, or the focus frame", async t => {
    const {addPage} = createRuntime(t);
    for (const phase of ["during load", "before first render", "after first render"]) {
        const focus = t.mock.fn();
        const started = Promise.withResolvers();
        const finishLoading = Promise.withResolvers();
        const load = async () => { started.resolve(); await finishLoading.promise; };
        const page = await addPage("/page.js", {controller: () => ({load, focus})});
        const menu = createMenu(t, page);
        menu.controller.expand();
        const [[, {signal}]] = menu.pending;
        const done = menu.render();
        const loaded = loadLazy(page);
        await started.promise;
        if (phase !== "during load") {
            finishLoading.resolve();
            await loaded;
        }
        if (phase === "after first render") renderFrame();
        assert.equal(getEventListeners(signal, "abort").length, 1, phase);

        menu.controller.documentPointerDown({composedPath: () => []});
        await done;
        assert.equal(getEventListeners(signal, "abort").length, 0, phase);
        assert.equal(getEventListeners(document, "pointerdown").length, 0, phase);
        finishLoading.resolve();
        await loaded;
        renderFrame();
        renderFrame();
        assert.equal(focus.mock.callCount(), 0, phase);
        assert.equal(frames.size, 0, phase);
    }
});

test("rapid expansion and menu removal discard old post-render and Page callbacks", async t => {
    const {addPage} = createRuntime(t);
    const focus = t.mock.fn();
    const page = await addPage("/page.js", {controller: () => ({focus})});
    const menu = createMenu(t, page);
    menu.controller.expand();
    const [[, earlier]] = menu.pending;
    menu.controller.collapse();
    menu.controller.expand();
    const done = menu.render();
    assert.equal(getEventListeners(earlier.signal, "abort").length, 0);
    await loadLazy(page);
    renderFrame();
    renderFrame();
    await done;
    assert.equal(focus.mock.callCount(), 1);

    menu.controller.collapse();
    menu.controller.expand();
    const [[, {signal}]] = menu.pending;
    const removed = menu.render();
    menu.host.isConnected = false;
    menu.controller.unmount();
    await removed;
    assert.equal(getEventListeners(signal, "abort").length, 0);
    assert.equal(frames.size, 0);
    assert.equal(focus.mock.callCount(), 1);
});

test("replacing a Page source or removing its host cancels the pending request", async t => {
    const {addPage} = createRuntime(t);
    const oldFocus = t.mock.fn();
    const newFocus = t.mock.fn();
    const page = await addPage("/old.js", {controller: () => ({focus: oldFocus})});
    await addPage("/new.js", {controller: () => ({focus: newFocus})});
    const menu = createMenu(t, page);
    menu.controller.expand();
    const [[, {signal}]] = menu.pending;
    const done = menu.render();
    await loadLazy(page);
    const replaced = once(page, "load");
    page.src = "/new.js";
    await Promise.all([done, replaced]);
    assert.equal(getEventListeners(signal, "abort").length, 0);
    renderFrame();
    renderFrame();
    assert.equal(oldFocus.mock.callCount(), 0);
    assert.equal(newFocus.mock.callCount(), 0);

    menu.controller.collapse();
    menu.controller.expand();
    const removed = menu.render();
    page.disconnectedCallback();
    await removed;
    renderFrame();
    assert.equal(newFocus.mock.callCount(), 0);
    assert.equal(frames.size, 0);
});

test("only the first eligible Page in DOM order receives focus", async t => {
    const {addPage} = createRuntime(t);
    const first = t.mock.fn();
    const second = t.mock.fn();
    const withoutFocus = await addPage("/no-focus.js", {});
    const firstPage = await addPage("/first.js", {controller: () => ({focus: first})});
    const secondPage = await addPage("/second.js", {controller: () => ({focus: second})});
    await loadLazy(firstPage);
    await loadLazy(secondPage);
    renderFrame();
    const menu = createMenu(t, withoutFocus, firstPage, secondPage);
    menu.controller.expand();
    const done = menu.render();
    assert.equal(frames.size, 0);
    await loadLazy(withoutFocus);
    renderFrame();
    await done;
    assert.equal(first.mock.callCount(), 1);
    assert.equal(second.mock.callCount(), 0);
});

test("opening an ancestor ignores Pages inside independently expandable child submenus", async t => {
    const {addPage} = createRuntime(t);
    const focus = t.mock.fn();
    const page = await addPage("/nested.js", {controller: () => ({focus})});
    await loadLazy(page);
    renderFrame();
    const nested = createMenu(t, page);
    const parent = createMenu(t, nested.host, page);
    parent.controller.expand();
    await parent.render();
    assert.equal(nested.state.expanded, false);
    assert.equal(frames.size, 0);
    assert.equal(focus.mock.callCount(), 0);

    nested.controller.expand();
    const done = nested.render();
    renderFrame();
    await done;
    assert.equal(focus.mock.callCount(), 1);
});

test("unloading an embedded Page releases its pending focus frame", async t => {
    const {addPage} = createRuntime(t);
    const focus = t.mock.fn();
    const page = await addPage("/unload.js", {controller: () => ({focus})});
    await loadLazy(page);
    renderFrame();
    const menu = createMenu(t, page);
    menu.controller.expand();
    const [[, {signal}]] = menu.pending;
    const done = menu.render();
    assert.equal(frames.size, 1);

    await page.unload();
    await done;
    assert.equal(getEventListeners(signal, "abort").length, 0);
    assert.equal(frames.size, 0);
    assert.equal(focus.mock.callCount(), 0);
});

test("menus without embedded Pages keep their trigger focus on Escape", async t => {
    const menu = createMenu(t, {localName: "x-menuitem"});
    menu.controller.expand();
    await menu.render();
    assert.equal(frames.size, 0);
    assert.equal(menu.anchor.focused, 0);

    menu.controller.keydown({key: "Escape", preventDefault() {}, stopPropagation() {}});
    assert.equal(menu.state.expanded, false);
    assert.equal(menu.anchor.focused, 1);
});
