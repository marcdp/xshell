import assert from "node:assert/strict";
import test from "node:test";

import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";

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
        for (const listener of this._listeners.get(event.type) ?? []) listener(event);
        return true;
    }
    getAttribute(name) { return this._attributes.get(name) ?? null; }
    hasAttribute(name) { return this._attributes.has(name); }
    setAttribute(name, value) { this._attributes.set(name, String(value)); }
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
const { default: XPage } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/x-page.js");
const { default: xshell } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/xshell.js");

class StateEngineFactory {
    constructor(state) { this.state = state; }
    create() { return { ...structuredClone(this.state) }; }
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

function createRuntime() {
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
    const services = new Proxy({}, { get(target, prop) { return typeof prop === "string" ? root.resolve(prop) : undefined; } });
    return { root, context: { resourceDefinition: { moduleId: "test" }, services } };
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

function configureXPage(resolvePage, getBreadcrumb = () => []) {
    const areas = {
        resolveAreaId() { return ""; },
        getArea() { return null; },
        getMenuitemBreadcrumb: getBreadcrumb
    };
    const modules = { shadowStyleSheets: [], resolveModuleId() { return "test"; } };
    const navigation = {};
    xshell._config = { xshell: { ui: { layouts: { embed: "x-layout-test" } } } };
    xshell._bus = { emit() {} };
    xshell._services = { resolve(name) {
        if (name === "areas") return areas;
        if (name === "modules") return modules;
        if (name === "navigation") return navigation;
        throw new Error(`Unexpected service: ${name}`);
    } };
    xshell._loader = { async load(resource) { return resource.startsWith("layout:") ? class {} : resolvePage(resource); } };
}

function createHost(src) {
    const host = new XPage();
    host._src = src;
    host.setAttribute("src", src);
    return host;
}

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
    configureXPage(() => Candidate);
    const host = createHost("/pages/failed.js");

    await assert.rejects(host.load(), error => error === loadFailure);

    assert.equal(unloads, 1);
    assert.equal(capture.scope._lifecycleState, "disposed");
    assert.deepEqual(disposed, ["helper", "session"]);
    assert.equal(runtime.root._children.length, 0);
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
    configureXPage(() => Candidate);
    const malformedNav = btoa("{");
    const host = createHost(`/pages/preparation.js?nav=${malformedNav}`);

    await assert.rejects(host.load(), error => error instanceof SyntaxError);

    assert.equal(loads, 0);
    assert.equal(unloads, 1);
    assert.equal(capture.scope._lifecycleState, "disposed");
    assert.deepEqual(disposed, ["session"]);
    assert.equal(runtime.root._children.length, 0);
});

test("failed candidate preparation preserves the active Page and its scope", async () => {
    const runtime = createRuntime();
    const activeCapture = {};
    const failedCapture = {};
    let activeUnloads = 0;
    let failedUnloads = 0;
    const Active = await createTrackedPageClass(runtime, "active", () => ({ unload() { activeUnloads++; } }), activeCapture);
    const Failed = await createTrackedPageClass(runtime, "failed-replacement", () => ({ unload() { failedUnloads++; } }), failedCapture);
    configureXPage(resource => resource.includes("active.js") ? Active : Failed);
    const host = createHost("/pages/active.js");
    await host.load();
    const activePage = host.page;

    host._src = `/pages/replacement.js?nav=${btoa("{")}`;
    await assert.rejects(host.load(), error => error instanceof SyntaxError);

    assert.strictEqual(host.page, activePage);
    assert.equal(activeUnloads, 0);
    assert.equal(activeCapture.scope._lifecycleState, "active");
    assert.equal(failedUnloads, 1);
    assert.equal(failedCapture.scope._lifecycleState, "disposed");
    assert.deepEqual(runtime.root._children, [activeCapture.scope]);
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
    configureXPage(resource => resource.includes("stale.js") ? Stale : Active);
    const host = createHost("/pages/stale.js");
    const staleLoad = host.load();
    await started.promise;

    host._src = "/pages/active.js";
    await host.load();
    release.resolve();
    await staleLoad;

    assert.ok(host.page instanceof Active);
    assert.equal(staleUnloads, 1);
    assert.equal(staleCapture.scope._lifecycleState, "disposed");
    assert.equal(activeUnloads, 0);
    assert.equal(activeCapture.scope._lifecycleState, "active");
    assert.strictEqual(activeCapture.scope.resolve("services"), runtime.root);
    assert.deepEqual(runtime.root._children, [activeCapture.scope]);
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
    configureXPage(resource => resource.includes("active.js") ? Active : Failed);
    const host = createHost("/pages/active.js");
    await host.load();
    const activePage = host.page;
    host.unmount = async () => { throw transitionFailure; };
    host._src = "/pages/replacement.js";

    await assert.rejects(host.load(), error => error === transitionFailure);

    assert.strictEqual(host.page, activePage);
    assert.equal(activeUnloads, 0);
    assert.equal(activeCapture.scope._lifecycleState, "active");
    assert.equal(failedUnloads, 1);
    assert.equal(failedCapture.scope._lifecycleState, "disposed");
    assert.deepEqual(runtime.root._children, [activeCapture.scope]);
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
    configureXPage(() => Candidate);
    const host = createHost("/pages/combined.js");

    await assert.rejects(host.load(), error => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [loadFailure, cleanupFailure]);
        assert.strictEqual(error.cause, loadFailure);
        return true;
    });

    assert.equal(capture.scope._lifecycleState, "disposed");
    assert.equal(runtime.root._children.length, 0);
});
