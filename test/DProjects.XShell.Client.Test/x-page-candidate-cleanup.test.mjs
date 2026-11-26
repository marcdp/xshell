import assert from "node:assert/strict";
import test from "node:test";

import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import Navigation from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/navigation.js";
import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/resolver.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Workspace from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/workspace.js";
import Invoke from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/invoke.js";
import Explorer from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/pages/explorer.js";
import GlobalFilesystems from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/pages/global/filesystems.js";
import FilesystemComponent from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/components/x-filesystem.js";
import FilesystemList from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/components/x-filesystem-list.js";
import Filesystems from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/services/filesystems.js";

const resources = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);

class FakeNode {
    adoptedStyleSheets = [];
    childNodes = [];
    nodeName = "X-PAGE";

    get firstChild() { return this.childNodes[0] ?? null; }
    appendChild(node) { this.childNodes.push(node); node.parentNode = this; return node; }
    removeChild(node) { this.childNodes.splice(this.childNodes.indexOf(node), 1); node.parentNode = null; return node; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
}

class FakeElement extends FakeNode {
    constructor() {
        super();
        this._attributes = new Map();
        this._listeners = new Map();
    }

    attachShadow() { this.shadowRoot = new FakeNode(); this.shadowRoot.host = this; return this.shadowRoot; }
    addEventListener(name, listener) {
        const listeners = this._listeners.get(name) ?? [];
        listeners.push(listener);
        this._listeners.set(name, listeners);
    }
    dispatchEvent(event) {
        Object.defineProperty(event, "target", { value: this });
        for (const listener of this._listeners.get(event.type) ?? []) listener(event);
        return true;
    }
    getAttribute(name) { return this._attributes.get(name) ?? null; }
    hasAttribute(name) { return this._attributes.has(name); }
    setAttribute(name, value) {
        const before = this.getAttribute(name);
        this._attributes.set(name, String(value));
        if (this.constructor.observedAttributes?.includes(name)) this.attributeChangedCallback(name, before, String(value));
    }
    removeAttribute(name) { this._attributes.delete(name); }
    getRootNode() { return this.parentNode?.getRootNode?.() ?? this; }
    remove() { this.parentNode?.removeChild(this); }
}

globalThis.HTMLElement = FakeElement;
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.customElements = {
    definitions: new Map(),
    define(name, implementation) { this.definitions.set(name, implementation); },
    get(name) { return this.definitions.get(name); }
};
globalThis.window = { customElements: globalThis.customElements };
globalThis.document = {
    baseURI: "https://example.test/",
    body: { querySelectorAll() { return []; } },
    createElement(name) { const element = new FakeElement(); element.localName = name; return element; }
};
globalThis.requestAnimationFrame = callback => { callback(); return 1; };

const { createPageClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/page-js.js");
const { createXPageClass } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/x-page.js");

class StateEngineFactory {
    constructor(state) { this.state = state; }
    create(handler) {
        return new Proxy(structuredClone(this.state), {
            set(state, key, value) {
                const previous = state[key];
                state[key] = value;
                if (previous !== value) handler.stateChange(key, previous, value);
                return true;
            }
        });
    }
}

class RenderEngineFactory {
    dependencies = [];
    slots = [];
    init() {}
    create() { return { mount() {}, unmount() {}, render() {} }; }
}

function deferred() {
    let resolve;
    const promise = new Promise(settle => { resolve = settle; });
    return { promise, resolve };
}

function assertScopeActive(scope) {
    assert.doesNotThrow(() => scope.has("__test__"));
}

function assertScopeDisposed(scope) {
    assert.throws(() => scope.has("__test__"), /Services scope is disposed/);
}

function createRuntime({ navigation = { mode: "path" }, bus = { emit() {} } } = {}) {
    const config = {
        app: { baseUrl: "https://example.test/" },
        modules: { test: { defaults: { page: { stateEngine: "test", renderEngine: "test" } } } },
        xshell: { services: {} }
    };
    const loader = {
        async load(resource) {
            if (resource.startsWith("schema:")) return {};
            if (resource.startsWith("state-engine:")) return StateEngineFactory;
            if (resource.startsWith("render-engine:")) return RenderEngineFactory;
            throw new Error(`Unexpected resource: ${resource}`);
        }
    };
    const root = new Services({ config, loader, contracts: {}, resolver: {}, bus: { emit() {} } });
    const modules = { getModuleById() { return { controller: {} }; } };
    root.register("config", config);
    root.register("loader", loader);
    root.register("modules", modules);
    root.register("services", root);
    root.register("i18n", {});
    root.register("navigation", navigation);
    const services = new Proxy({}, { get(target, prop) { return typeof prop === "string" ? root.resolve(prop) : undefined; } });
    return { root, config, loader, modules, context: { resourceDefinition: { moduleId: "test" }, services } };
}

function registerDisposableServices(root, disposed) {
    class Session {
        static optionsSchema = { type: "object", additionalProperties: false };
        dispose() { disposed.push("session"); }
    }
    class Helper {
        static optionsSchema = { type: "object", additionalProperties: false };
        dispose() { disposed.push("helper"); }
    }
    root.register("session", null, { lifetime: "scoped", implementationItem: { class: Session } });
    root.register("helper", null, { lifetime: "transient", implementationItem: { class: Helper } });
}

async function createTrackedPageClass(runtime, id, controller, capture) {
    const PageClass = await createPageClassFromJsDefinition(`${id}.js`, runtime.context, { meta: { id }, controller });
    return class extends PageClass {
        constructor(options) {
            super(options);
            capture.page = this;
            capture.scope = this._servicesScope;
        }
    };
}

function createHost(src, resolvePage) {
    const areas = {
        resolveAreaId() { return ""; },
        getArea() { return null; },
        getMenuitemBreadcrumb() { return []; }
    };
    const modules = { shadowStyleSheets: [], resolveModuleId() { return "test"; } };
    const navigation = {};
    const config = { xshell: { ui: { layouts: { embed: "x-layout-test" } } } };
    const bus = { emit() {} };
    const loader = { async load(resource) { return resource.startsWith("layout:") ? class {} : resolvePage(resource); } };
    const XPage = createXPageClass({ config, loader, bus, navigation, areas, modules });
    const host = new XPage();
    host._src = src;
    host.setAttribute("src", src);
    return host;
}

function createNavigationRuntime(t, mode) {
    // Deliver programmatic hash events separately from writes, like a browser.
    const globals = { location: globalThis.location, history: globalThis.history, window, document };
    t.after(() => Object.assign(globalThis, globals));
    const urls = [new URL(mode === "hash" ? "/app/#!/sales/home" : "/app/sales/home", document.baseURI)];
    const hashEvents = [];
    const listeners = new Map();
    let position = 0;
    const write = (href, replace) => {
        const before = urls[position];
        const after = new URL(href, before);
        if (mode === "hash" && before.hash !== after.hash) hashEvents.push({ oldURL: before.href, newURL: after.href });
        if (!replace) urls.splice(++position);
        urls[position] = after;
    };
    const location = {
        get origin() { return urls[position].origin; },
        get pathname() { return urls[position].pathname; },
        get search() { return urls[position].search; },
        get hash() { return urls[position].hash; },
        set hash(value) { if (value !== this.hash) write(value, false); },
        replace(value) { write(value, true); }
    };
    const flushHashEvents = async () => {
        for (const event of hashEvents.splice(0)) await listeners.get("hashchange")(event);
    };
    const go = async delta => {
        const before = urls[position];
        position += delta;
        await listeners.get(mode === "hash" ? "hashchange" : "popstate")({ oldURL: before.href, newURL: urls[position].href });
    };

    // Use ordinary Area, Resolver, Navigation and x-page entry points with a small DOM.
    const events = [];
    const bus = { emit(name, detail) { events.push({ name, detail }); }, addEventListener() {} };
    const config = { app: { basePath: "/app", baseUrl: "https://example.test/app/", label: "Test" }, modules: { test: {} },
        xshell: { assets: { basePath: "/_assets" }, resolver: { page: {
            "x-filesystem:/{path}": { src: "/_assets/x-filesystem/{path}", loader: "page-js" },
            "x:/{path}": { src: "/_assets/x/{path}", loader: "page-js" }
        } } } };
    const areas = new Areas({ config, bus }, { default: "sales", definitions: { sales: { prefix: "/sales", modules: ["test"] } } });
    const areaModule = { id: "test", routes: { "/customer/{id}": "/_assets/test/customer.js?mode=edit" }, config: { menus: {
        navigation: { items: [
            { label: "Home", path: "/home", href: "/_assets/test/home.js" },
            { label: "Preferences", path: "/preferences", href: "/_assets/x/pages/workspace.js?menu-name=preferences" }
        ] },
        preferences: { items: [
            { id: "appearance", label: "Appearance", href: "/_assets/test/home.js" },
            { id: "filesystems", label: "Filesystems", href: "/_assets/test/home.js" }
        ] }
    } } };
    areas.init({ modules: { getModuleById: () => areaModule } });
    const container = new FakeNode();
    container.querySelectorAll = selector => container.childNodes.filter(host =>
        !selector.includes(":not") || host.getAttribute("layout") !== "dialog");
    container.appendChild = host => { FakeNode.prototype.appendChild.call(container, host); host.connectedCallback(); };
    const navigation = new Navigation({ areas, bus, config, resolver: new Resolver({ config }) }, { mode }, { container });
    const runtime = createRuntime({ navigation, bus });
    runtime.root.register("areas", areas);
    runtime.config.xshell.ui = { layouts: { main: "x-layout-test", stack: "x-layout-test", dialog: "x-layout-test" } };
    runtime.modules.resolveModuleId = () => "test";
    const pages = new Map();
    const loader = {
        async load(resource) {
            if (resource.startsWith("layout:")) return class {};
            return pages.get(resource.slice(5).split(/[?#]/)[0]);
        }
    };
    const loads = [];
    const XPage = createXPageClass({ ...runtime, loader, navigation, areas, bus });
    class TestHost extends XPage {
        load() {
            const task = super.load();
            loads.push(task);
            return task;
        }
    }
    Object.assign(globalThis, {
        location,
        history: { pushState: (_, title, href) => write(href, false), replaceState: (_, title, href) => write(href, true) },
        window: { ...window, location, addEventListener: (name, listener) => listeners.set(name, listener) },
        document: { ...document, location, createElement(name) {
            const element = name === "x-page" ? new TestHost() : new FakeElement();
            element.localName = name;
            if (name === "x-layout-test") {
                element.controller = {};
                element.unload = async () => {};
            }
            return element;
        } }
    });
    return { ...runtime, events, navigation, loads, go, flushHashEvents, get url() { return urls[position]; },
        get position() { return position; },
        async register(href, definition) {
            const PageClass = await createPageClassFromJsDefinition(href, runtime.context, definition);
            pages.set(href, PageClass);
        } };
}

async function openHome(runtime) {
    // Start each scenario with a mounted root Page.
    await runtime.register("/_assets/test/home.js", { meta: { id: "navigation-test-home" }, controller: () => ({}) });
    await runtime.navigation.init();
    await runtime.loads.at(-1);
    return runtime.navigation.getXPage();
}

for (const mode of ["path", "hash"]) {
    test(`Filesystems menu switches Explorer invocations and restores them through ${mode} history`, async t => {
        // Register two filesystems with different contents and let the popup generate the targets.
        const preferences = new Map();
        const filesystems = new Filesystems({ config: { app: {} }, jsonValidator: new JsonValidator(), bus: { emit() {} }, preferences: {
            async get(key, fallback) { return preferences.get(key) ?? fallback; },
            async set(key, value) { preferences.set(key, value); },
            async list(prefix) { return [...preferences].filter(([key]) => key.startsWith(prefix)).map(([, value]) => ({ value })); }
        } }, { providers: { mem: { implementation: new URL("x-filesystem/providers/filesystem-mem.js", resources).href } } });
        for (const name of ["filesystem1", "filesystem2"]) {
            await filesystems.saveDefinition({ name, label: name, provider: "mem", options: {} });
            await (await filesystems.openNamed(name)).saveFile(`/${name}.txt`, name);
        }
        const popup = { items: [] };
        await GlobalFilesystems.controller({ state: popup, events: { on() {} }, bus: {}, filesystems }).load();
        const runtime = createNavigationRuntime(t, mode);
        const { navigation } = runtime;
        await runtime.register("/_assets/x-filesystem/pages/explorer.js", Explorer);
        const host = await openHome(runtime);

        async function checkExplorer(index) {
            // Pass the Explorer's bound values through the actual Filesystem and list controllers.
            const { name } = popup.items[index];
            const page = host.page;
            assert.equal(navigation.getXPage(), host);
            assert.match(runtime.url.href, new RegExp(`src=named%3A${name}&path=%2F`));
            assert.equal(page._state.src, `named:${name}`);
            assert.equal(page._state.path, "/");
            assert.match(Explorer.template, /x-prop:src="state.src" x-prop:path="state.path"/);
            const browserState = { src: page._state.src, pathList: page._state.path };
            let sourceChanged;
            const filesystem = FilesystemComponent.controller({ state: browserState, filesystems,
                events: { on(target, event, handler) { assert.equal(event, "change:src"); sourceChanged = handler; } } });
            await filesystem.load();
            await sourceChanged();
            const listState = { path: browserState.pathList, filesystem: browserState.filesystem };
            const listHost = { matches: () => false, shadowRoot: { querySelector: () => null } };
            await FilesystemList.controller({ state: listState, host: listHost }).refresh();
            assert.deepEqual(listState.entries.map(entry => entry.path), [`/${name}.txt`]);
            return page;
        }

        await navigation.navigate({ href: popup.items[0].href, open: "top" });
        await runtime.loads.at(-1);
        const first = await checkExplorer(0);
        const scope = first._servicesScope;
        await navigation.navigate({ href: popup.items[1].href, open: "top" });
        await runtime.loads.at(-1);
        const second = await checkExplorer(1);
        assert.notEqual(second, first);
        assertScopeDisposed(scope);
        await runtime.flushHashEvents();
        assert.equal(host.page, second);
        assert.equal(runtime.loads.length, 3);

        await runtime.go(-1);
        await runtime.loads.at(-1);
        const restored = await checkExplorer(0);
        assert.notEqual(restored, first);
        await runtime.go(1);
        await runtime.loads.at(-1);
        assert.notEqual(await checkExplorer(1), second);
        assert.equal(runtime.loads.length, 5);
        assert.equal(runtime.events.filter(event => event.name === "xshell:navigation:start").length, 5);
        assert.equal(runtime.events.filter(event => event.name === "xshell:navigation:end").length, 5);
    });
}

test("resolved routes compare encoded queries, preserve equivalent stack entries and reload with history replacement", async t => {
    const runtime = createNavigationRuntime(t, "path");
    const { navigation } = runtime;
    const root = (await openHome(runtime)).page;
    await runtime.register("/_assets/test/customer.js", { meta: { id: "navigation-test-customer" }, contract: { properties: {
        id: { type: "string", state: true, query: true },
        mode: { type: "string", state: true, query: true },
        filter: { type: "string", state: true, query: true, default: null }
    } }, controller: () => ({}) });
    await navigation.navigate({ href: "/sales/customer/123", open: "stack", classes: ["size-wide"] });
    await runtime.loads.at(-1);
    const host = navigation.getXPages()[1];
    const first = host.page;
    const position = runtime.position;
    const replace = href => navigation.navigate({ href, page: host.page, classes: ["size-medium"], replace: true });
    await replace("/app/sales/_assets/test/customer.js?mode=edit&id=123");
    await replace("/app/sales/_assets/test/customer.js?id=123&mode=edit");
    assert.equal(host.page, first);
    assert.deepEqual(host.shadowRoot.firstChild.stackClasses, ["size-medium"]);
    assert.equal(runtime.loads.length, 2);

    await replace("/sales/customer/123?filter=%2B+%26%2F");
    await runtime.loads.at(-1);
    assert.notEqual(host.page, first);
    assert.equal(host.page._state.filter, "+ &/");
    await replace("/sales/customer/123?filter=%2b%20%26%2f");
    assert.equal(runtime.loads.length, 3);
    await replace("/sales/customer/123");
    await runtime.loads.at(-1);
    assert.equal(host.page._state.filter, null);
    await replace("/sales/customer/a%2Fb");
    await runtime.loads.at(-1);
    assert.equal(host.page._state.id, "a/b");
    assert.equal(host.page._state.mode, "edit");
    assert.equal(runtime.loads.length, 5);
    assert.equal(runtime.position, position);

    // A path-and-query equivalent destination with a different explicit fragment still reloads.
    const page = host.page;
    await replace("/sales/customer/a%2Fb#summary");
    await runtime.loads.at(-1);
    assert.notEqual(host.page, page);
    assert.equal(navigation.getXPage().page, root);
    assert.equal(navigation.getXPages()[1], host);

    // Reflect changes to parameters supplied by the route while preserving the invocation.
    const reflected = host.page;
    reflected.replaceQuery({ id: "456" });
    assert.equal(reflected.query.id, "456");
    assert.equal(reflected.query.mode, "edit");
    reflected.replaceQuery({ mode: null });
    assert.equal(reflected.query.mode, undefined);
    assert.equal(navigation.stack[1].params.id, "456");
    assert.equal(host.src, reflected.src);
    assert.equal(host.page, reflected);
    assert.equal(runtime.loads.length, 6);
});

test("Workspace reloads on explicit navigation and reflects selection and fragments without hash reloads", async t => {
    const runtime = createNavigationRuntime(t, "hash");
    const { navigation } = runtime;
    const root = (await openHome(runtime)).page;
    await runtime.register("/_assets/x/pages/workspace.js", Workspace);
    // Open through the canonical Page reference with its actual query names and an Area menu alias.
    await navigation.navigate({ href: "page:x:/pages/workspace.js?menu-name=preferences&item=appearance&extra=keep", page: root,
        open: "stack", nav: { title: "Preferences" }, classes: ["size-wide"] });
    await runtime.loads.at(-1);
    const host = navigation.getXPages()[1];
    const initial = host.page;
    assert.equal(initial._state.menuName, "preferences");
    assert.equal(initial._state.item, "appearance");
    await navigation.navigate({ href: "/sales/preferences?item=filesystems&extra=keep", page: initial,
        nav: { title: "Preferences" }, classes: ["size-wide"] });
    await runtime.loads.at(-1);
    const workspace = host.page;
    assert.notEqual(workspace, initial);
    assert.equal(workspace._state.menuName, "preferences");
    assert.equal(workspace._state.item, "filesystems");

    // Select Workspace items through the controller, then use both Page URL update APIs.
    const scope = workspace._servicesScope;
    const controller = workspace._controller;
    const position = runtime.position;
    const items = controller.collectItems(workspace._state.menu);
    await controller.openItem(items.get("appearance"));
    await controller.openItem(items.get("filesystems"));
    await controller.openItem(items.get("appearance"));
    workspace.replaceQuery({ extra: "still here" });
    workspace.replaceHash("options");
    await runtime.flushHashEvents();
    assert.equal(host.page, workspace);
    assert.equal(workspace._controller, controller);
    assert.equal(workspace._servicesScope, scope);
    assertScopeActive(scope);
    assert.equal(runtime.position, position);
    assert.equal(runtime.loads.length, 3);
    assert.equal(navigation.getXPage().page, root);
    assert.deepEqual(host.shadowRoot.firstChild.stackClasses, ["size-wide"]);
    assert.equal(navigation.stack[1].nav.title, "Preferences");
    assert.equal(workspace.query.item, "appearance");
    assert.equal(workspace.query.extra, "still here");
    assert.equal(host.src, workspace.src);
    assert.match(host.src, /#options$/);
});

test("Invoke loads the new command contract when an explicit query changes", async t => {
    const runtime = createNavigationRuntime(t, "path");
    const { navigation } = runtime;
    await openHome(runtime);
    runtime.root.register("tasks", {});
    runtime.root.register("contracts", {});
    const { load } = runtime.loader;
    runtime.loader.load = resource => resource.startsWith("command:")
        ? class { static contract = { label: resource.slice(8), execute: {} }; }
        : load(resource);
    await runtime.register("/_assets/x/pages/invoke.js", Invoke);
    await navigation.navigate({ href: "page:x:/pages/invoke.js?type=command&id=export", open: "top" });
    await runtime.loads.at(-1);
    const exported = navigation.getXPage().page;
    assert.equal(exported._state.title, "export");
    const scope = exported._servicesScope;
    await navigation.navigate({ href: "page:x:/pages/invoke.js?type=command&id=import&method=execute", open: "top" });
    await runtime.loads.at(-1);
    const imported = navigation.getXPage().page;
    assert.equal(imported._state.title, "import");
    assert.equal(imported._state.method, "execute");
    assertScopeDisposed(scope);
});

test("a superseded query invocation is cleaned up while the latest request waits for the old Page to unload", async t => {
    const runtime = createNavigationRuntime(t, "hash");
    const { navigation } = runtime;
    const loading = deferred();
    const finishLoading = deferred();
    const unloading = deferred();
    const finishUnloading = deferred();
    const scopes = new Map();
    const mounts = [];
    const unloads = [];
    await runtime.register("/_assets/test/query.js", { meta: { id: "navigation-test-rapid" }, contract: { properties: {
        item: { type: "string", state: true, query: true, reflect: true }
    } }, controller({ state, services }) {
        const item = state.item;
        scopes.set(item, services);
        return {
            async load() {
                if (item !== "loading") return;
                loading.resolve();
                await finishLoading.promise;
            },
            mount() { mounts.push(item); },
            async unload() {
                unloads.push(item);
                if (item !== "first") return;
                unloading.resolve();
                await finishUnloading.promise;
            }
        };
    } });
    const host = await openHome(runtime);
    const navigate = item => navigation.navigate({ href: `/sales/_assets/test/query.js?item=${item}&other=keep`, open: "top" });
    await navigate("first");
    await runtime.loads.at(-1);
    const first = host.page;

    // An outgoing Page can reflect before reconciliation starts and while a candidate is pending.
    const pending = navigate("loading");
    first._state.item = "stale-before";
    await pending;
    await loading.promise;
    first._state.item = "stale-during";
    assert.equal(first.query.item, "first");
    assert.equal(navigation.stack[0].params.item, "loading");
    await navigate("queued");
    await unloading.promise;
    await navigate("last");
    await runtime.flushHashEvents();
    finishLoading.resolve();
    finishUnloading.resolve();
    await Promise.all(runtime.loads);

    assert.deepEqual(mounts, ["first", "last"]);
    assert.deepEqual(unloads.sort(), ["first", "loading", "queued"]);
    assert.equal(runtime.loads.length, 5);
    assert.equal(navigation.getXPage(), host);
    assert.equal(host.page._state.item, "last");
    assert.equal(host.page.query.other, "keep");
    assert.match(runtime.url.hash, /item=last/);
    for (const item of ["first", "loading", "queued"]) assertScopeDisposed(scopes.get(item));
    assertScopeActive(scopes.get("last"));
});

test("stacked query history reloads the selected entry and preserves the root and dialog", async t => {
    const runtime = createNavigationRuntime(t, "path");
    const { navigation } = runtime;
    const rootHost = await openHome(runtime);
    const root = rootHost.page;
    const href = "/sales/_assets/test/stack.js";
    await runtime.register("/_assets/test/stack.js", { meta: { id: "navigation-test-stack" }, controller: () => ({}) });
    await navigation.navigate({ href: href + "?item=1", open: "stack" });
    await runtime.loads.at(-1);
    const stackHost = navigation.getXPages()[1];
    const dialogResult = navigation.navigate({ href: "/sales/home", open: "dialog" });
    await runtime.loads.at(-1);
    const dialog = rootHost.parentNode.childNodes.at(-1);
    const dialogPage = dialog.page;
    await navigation.navigate({ href: href + "?item=2", page: stackHost.page });
    await runtime.loads.at(-1);
    const second = stackHost.page;
    await runtime.go(-1);
    await runtime.loads.at(-1);
    assert.equal(stackHost.page.query.item, "1");
    await runtime.go(1);
    await runtime.loads.at(-1);
    assert.equal(stackHost.page.query.item, "2");
    assert.notEqual(stackHost.page, second);
    assert.equal(rootHost.page, root);
    assert.equal(dialog.page, dialogPage);
    await dialog.close("closed");
    assert.equal(await dialogResult, "closed");
});

test("x-page unloads a definition-based candidate whose asynchronous load fails", async () => {
    const runtime = createRuntime();
    const disposed = [];
    const capture = {};
    const loadFailure = new Error("candidate load failed");
    let unloads = 0;
    registerDisposableServices(runtime.root, disposed);
    const Candidate = await createTrackedPageClass(runtime, "failed-load", ({session, helper}) => ({
        session, helper,
        async load() { throw loadFailure; },
        unload() { unloads++; }
    }), capture);
    const host = createHost("/pages/failed.js", () => Candidate);

    await assert.rejects(host.load(), error => error === loadFailure);

    assert.equal(unloads, 1);
    assertScopeDisposed(capture.scope);
    assert.deepEqual(disposed, ["helper", "session"]);
    assert.equal(host.page, null);
});

test("x-page unloads a candidate when navigation metadata preparation fails", async () => {
    const runtime = createRuntime();
    const disposed = [];
    const capture = {};
    let loads = 0;
    let unloads = 0;
    registerDisposableServices(runtime.root, disposed);
    const Candidate = await createTrackedPageClass(runtime, "failed-preparation", ({session}) => ({
        session,
        load() { loads++; },
        unload() { unloads++; }
    }), capture);
    const malformedNav = btoa("{");
    const host = createHost(`/pages/preparation.js?nav=${malformedNav}`, () => Candidate);

    await assert.rejects(host.load(), error => error instanceof SyntaxError);

    assert.equal(loads, 0);
    assert.equal(unloads, 1);
    assertScopeDisposed(capture.scope);
    assert.deepEqual(disposed, ["session"]);
});

test("failed candidate preparation preserves the active Page and its scope", async () => {
    const runtime = createRuntime();
    const activeCapture = {};
    const failedCapture = {};
    let activeUnloads = 0;
    let failedUnloads = 0;
    const Active = await createTrackedPageClass(runtime, "active", () => ({ unload() { activeUnloads++; } }), activeCapture);
    const Failed = await createTrackedPageClass(runtime, "failed-replacement", () => ({ unload() { failedUnloads++; } }), failedCapture);
    const host = createHost("/pages/active.js", resource => resource.includes("active.js") ? Active : Failed);
    await host.load();
    const activePage = host.page;

    host._src = `/pages/replacement.js?nav=${btoa("{")}`;
    await assert.rejects(host.load(), error => error instanceof SyntaxError);

    assert.strictEqual(host.page, activePage);
    assert.equal(activeUnloads, 0);
    assertScopeActive(activeCapture.scope);
    assert.equal(failedUnloads, 1);
    assertScopeDisposed(failedCapture.scope);
    await host.unload();
});

test("overlapping navigation unloads a stale candidate exactly once", async () => {
    const runtime = createRuntime();
    const staleCapture = {};
    const activeCapture = {};
    const started = deferred();
    const release = deferred();
    let staleUnloads = 0;
    let activeUnloads = 0;
    const Stale = await createTrackedPageClass(runtime, "stale", () => ({
        async load() { started.resolve(); await release.promise; },
        unload() { staleUnloads++; }
    }), staleCapture);
    const Active = await createTrackedPageClass(runtime, "overlap-active", () => ({ unload() { activeUnloads++; } }), activeCapture);
    const host = createHost("/pages/stale.js", resource => resource.includes("stale.js") ? Stale : Active);
    const staleLoad = host.load();
    await started.promise;

    host._src = "/pages/active.js";
    await host.load();
    release.resolve();
    await staleLoad;

    assert.ok(host.page instanceof Active);
    assert.equal(staleUnloads, 1);
    assertScopeDisposed(staleCapture.scope);
    assert.equal(activeUnloads, 0);
    assertScopeActive(activeCapture.scope);
    assert.strictEqual(activeCapture.scope.resolve("services"), runtime.root);
    await host.unload();
});

test("queued transition failure unloads the candidate and propagates the transition error", async () => {
    const runtime = createRuntime();
    const activeCapture = {};
    const failedCapture = {};
    const transitionFailure = new Error("queued transition failed");
    let activeUnloads = 0;
    let failedUnloads = 0;
    const Active = await createTrackedPageClass(runtime, "transition-active", () => ({ unload() { activeUnloads++; } }), activeCapture);
    const Failed = await createTrackedPageClass(runtime, "transition-failed", () => ({ unload() { failedUnloads++; } }), failedCapture);
    const host = createHost("/pages/active.js", resource => resource.includes("active.js") ? Active : Failed);
    await host.load();
    const activePage = host.page;
    host.unmount = async () => { throw transitionFailure; };
    host._src = "/pages/replacement.js";

    await assert.rejects(host.load(), error => error === transitionFailure);

    assert.strictEqual(host.page, activePage);
    assert.equal(activeUnloads, 0);
    assertScopeActive(activeCapture.scope);
    assert.equal(failedUnloads, 1);
    assertScopeDisposed(failedCapture.scope);
    await host.unload();
});

test("x-page reports both candidate preparation and cleanup failures", async () => {
    const runtime = createRuntime();
    const capture = {};
    const loadFailure = new Error("load failed");
    const cleanupFailure = new Error("cleanup failed");
    const Candidate = await createTrackedPageClass(runtime, "combined-failure", () => ({
        load() { throw loadFailure; },
        unload() { throw cleanupFailure; }
    }), capture);
    const host = createHost("/pages/combined.js", () => Candidate);

    await assert.rejects(host.load(), error => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [loadFailure, cleanupFailure]);
        assert.strictEqual(error.cause, loadFailure);
        return true;
    });

    assertScopeDisposed(capture.scope);
});
