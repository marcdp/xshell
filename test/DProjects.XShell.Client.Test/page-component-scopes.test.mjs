import assert from "node:assert/strict";
import test from "node:test";

import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import Events from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/events.js";
import Timer from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/timer.js";

class FakeNode {
    adoptedStyleSheets = [];
    childNodes = [];

    get firstChild() { return this.childNodes[0] ?? null; }
    appendChild(node) { this.childNodes.push(node); node.parentNode = this; return node; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
}

class FakeElement extends FakeNode {
    attributes = [];
    nodeName = "X-TEST";

    attachShadow() { this.shadowRoot = new FakeNode(); this.shadowRoot.host = this; return this.shadowRoot; }
    addEventListener() {}
    getAttribute(name) { return this.attributes.find(attribute => attribute.name === name)?.value ?? null; }
    hasAttribute(name) { return this.attributes.some(attribute => attribute.name === name); }
    setAttribute(name, value) {
        const attribute = this.attributes.find(item => item.name === name);
        if (attribute) attribute.value = String(value);
        else this.attributes.push({ name, value: String(value) });
    }
    removeAttribute(name) { this.attributes = this.attributes.filter(attribute => attribute.name !== name); }
    getRootNode() { return this.parentNode?.getRootNode?.() ?? this; }
}

const customElementDefinitions = new Map();
globalThis.HTMLElement = FakeElement;
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.customElements = {
    define(name, implementation) { customElementDefinitions.set(name, implementation); },
    get(name) { return customElementDefinitions.get(name); }
};
globalThis.window = { customElements: globalThis.customElements };
globalThis.document = { baseURI: "https://example.test/", body: new FakeElement(), adoptedStyleSheets: [] };
globalThis.requestAnimationFrame = callback => { callback(); return 1; };

const { createComponentClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/component-js.js");
const { createPageClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/page-js.js");

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

let runtimeId = 0;

function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function createRuntime({ order = [], scopedDispose } = {}) {
    const config = {
        app: { baseUrl: "https://example.test/" },
        modules: { test: { defaults: { component: { stateEngine: "test", renderEngine: "test" }, page: { stateEngine: "test", renderEngine: "test" } } } },
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
    root.register("navigation", { mode: "path" });

    class Singleton {
        static optionsSchema = { type: "object", additionalProperties: false };
    }
    class Scoped {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor() { this.id = ++runtimeId; }
        dispose() { order.push(`scoped-dispose:${this.id}`); scopedDispose?.(this); }
    }
    class Transient {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor() { this.id = ++runtimeId; }
        dispose() { order.push(`transient-dispose:${this.id}`); }
    }
    root.register("singleton", null, { implementationItem: { class: Singleton } });
    root.register("session", null, { lifetime: "scoped", implementationItem: { class: Scoped } });
    root.register("formatter", null, { lifetime: "transient", implementationItem: { class: Transient } });
    root.register("events", null, { lifetime: "transient", implementationItem: { class: Events } });
    root.register("timer", null, { lifetime: "transient", implementationItem: { class: Timer } });

    const services = new Proxy({}, {
        get(target, prop) { return typeof prop === "string" ? root.resolve(prop) : undefined; }
    });
    return { root, context: { resourceDefinition: { moduleId: "test" }, services }, order };
}

function createPage(PageClass, src = "/pages/test.js") {
    return new PageClass({ src, context: {}, bus: { emit() {} }, navigation: {} });
}

function createPageHost(src = "/pages/test.js") {
    const root = new FakeNode();
    return { nodeName: "X-PAGE", dispatchEvent() {}, getAttribute() { return src; }, getRootNode() { return root; } };
}

function ownerController({ services, singleton, session, formatter }) {
    const secondTransient = services.resolve("formatter");
    return {
        services,
        singleton,
        session,
        transients: [formatter, secondTransient]
    };
}

test("definition-based Pages create one direct root scope with lifetime-aware injection", async () => {
    const { root, context } = createRuntime();
    const PageClass = await createPageClassFromJsDefinition("page-scopes.js", context, {
        meta: { id: "page-scopes" },
        controller: ownerController
    });

    assert.equal(root._children.length, 0);
    const first = createPage(PageClass, "/pages/first.js");
    const second = createPage(PageClass, "/pages/second.js");

    assert.equal(root._children.length, 2);
    assert.notStrictEqual(first._servicesScope, second._servicesScope);
    assert.strictEqual(first._servicesScope._parent, root);
    assert.strictEqual(second._servicesScope._parent, root);
    assert.strictEqual(first._controller.services, first._servicesScope);
    assert.strictEqual(first._controller.singleton, second._controller.singleton);
    assert.strictEqual(first._controller.session, first._servicesScope.resolve("session"));
    assert.notStrictEqual(first._controller.session, second._controller.session);
    assert.notStrictEqual(first._controller.transients[0], first._controller.transients[1]);

    const scope = first._servicesScope;
    const scopedInstance = first._controller.session;
    const host = createPageHost();
    await first.mount({ host });
    await first.unmount();
    await first.mount({ host });
    assert.strictEqual(first._servicesScope, scope);
    assert.strictEqual(first._servicesScope.resolve("session"), scopedInstance);

    await first.unload();
    await first.unload();
    assert.equal(scope._lifecycleState, "disposed");
    assert.equal(second._servicesScope._lifecycleState, "active");
    assert.strictEqual(second._servicesScope.resolve("singleton"), second._controller.singleton);
});

test("definition-based Components create independent scopes before attachment and preserve them across reconnects", async () => {
    const { root, context } = createRuntime();
    const Component = await createComponentClassFromJsDefinition("component-scopes.js", context, {
        meta: { id: `x-component-scopes-${++runtimeId}` },
        controller: ownerController
    });

    assert.equal(root._children.length, 0);
    const parent = new Component();
    const nested = new Component();
    const sibling = new Component();
    parent.shadowRoot.appendChild(nested);

    assert.equal(root._children.length, 3);
    for (const component of [parent, nested, sibling]) assert.strictEqual(component._servicesScope._parent, root);
    assert.notStrictEqual(parent._servicesScope, nested._servicesScope);
    assert.notStrictEqual(parent._controller.session, nested._controller.session);
    assert.notStrictEqual(nested._controller.session, sibling._controller.session);
    assert.strictEqual(parent._controller.singleton, nested._controller.singleton);
    assert.strictEqual(parent._controller.services, parent._servicesScope);
    assert.notStrictEqual(parent._controller.transients[0], parent._controller.transients[1]);

    const scope = parent._servicesScope;
    const scopedInstance = parent._controller.session;
    parent.connectedCallback();
    parent.connectedMoveCallback();
    parent.disconnectedCallback();
    parent.connectedCallback();
    assert.strictEqual(parent._servicesScope, scope);
    assert.strictEqual(parent._servicesScope.resolve("session"), scopedInstance);

    await parent.unload();
    await parent.unload();
    assert.equal(scope._lifecycleState, "disposed");
    assert.equal(nested._servicesScope._lifecycleState, "active");
    assert.equal(sibling._servicesScope._lifecycleState, "active");
    await nested.unload();
    await sibling.unload();
});

test("Page and Component scopes are independent even when the Component is rendered inside the Page", async () => {
    const { root, context } = createRuntime();
    const PageClass = await createPageClassFromJsDefinition("independent-page.js", context, {
        meta: { id: "independent-page" }, controller: ownerController
    });
    const Component = await createComponentClassFromJsDefinition("independent-component.js", context, {
        meta: { id: `x-independent-component-${++runtimeId}` }, controller: ownerController
    });
    const page = createPage(PageClass);
    const component = new Component();
    const host = createPageHost();
    host.appendChild = node => { node.parentNode = host; return node; };
    host.getRootNode().appendChild(component);

    assert.strictEqual(page._servicesScope._parent, root);
    assert.strictEqual(component._servicesScope._parent, root);
    assert.notStrictEqual(page._servicesScope, component._servicesScope);
    assert.notStrictEqual(page._controller.session, component._controller.session);
    assert.strictEqual(page._controller.singleton, component._controller.singleton);

    await page.unload();
    assert.equal(component._servicesScope._lifecycleState, "active");
    assert.strictEqual(component._servicesScope.resolve("session"), component._controller.session);
    await component.unload();
});

test("Page and Component controllers resolve transient Events and Timer services with independent owner contexts", async () => {
    const { context } = createRuntime();
    const pageTarget = new EventTarget();
    const componentTarget = new EventTarget();
    let pageController;
    let componentController;
    const PageClass = await createPageClassFromJsDefinition("helper-page.js", context, {
        meta: {id: "helper-page"},
        controller({events, timer, services}) {
            pageController = {
                events, timer, extraEvents: services.resolve("events"), extraTimer: services.resolve("timer"), calls: 0,
                load() { events.on(pageTarget, "run", "refresh"); timer.setTimeout("refresh", 0); },
                refresh() { assert.strictEqual(this, pageController); this.calls++; },
                unload() { pageTarget.dispatchEvent(new Event("run")); }
            };
            return pageController;
        }
    });
    const Component = await createComponentClassFromJsDefinition("helper-component.js", context, {
        meta: {id: `x-helper-component-${++runtimeId}`},
        controller({events, timer, services}) {
            componentController = {
                events, timer, extraEvents: services.resolve("events"), extraTimer: services.resolve("timer"), calls: 0,
                load() { events.on(componentTarget, "run", "refresh"); timer.setTimeout("refresh", 0); },
                refresh() { assert.strictEqual(this, componentController); this.calls++; }
            };
            return componentController;
        }
    });
    const page = createPage(PageClass);
    const component = new Component();

    assert.notStrictEqual(pageController.events, pageController.extraEvents);
    assert.notStrictEqual(pageController.timer, pageController.extraTimer);
    assert.notStrictEqual(componentController.events, componentController.extraEvents);
    assert.notStrictEqual(componentController.timer, componentController.extraTimer);
    assert.notStrictEqual(pageController.events, componentController.events);

    await page.load();
    await delay(5);
    pageTarget.dispatchEvent(new Event("run"));
    componentTarget.dispatchEvent(new Event("run"));
    assert.equal(pageController.calls, 2);
    assert.equal(componentController.calls, 2);

    const pageScope = page._servicesScope;
    const componentScope = component._servicesScope;
    const host = createPageHost();
    await page.mount({host});
    await page.unmount();
    await page.mount({host});
    component.connectedCallback();
    component.disconnectedCallback();
    component.connectedCallback();
    assert.strictEqual(page._servicesScope, pageScope);
    assert.strictEqual(component._servicesScope, componentScope);

    await page.unload();
    await component.unload();
    const pageCalls = pageController.calls;
    const componentCalls = componentController.calls;
    pageTarget.dispatchEvent(new Event("run"));
    componentTarget.dispatchEvent(new Event("run"));
    assert.equal(pageController.calls, pageCalls);
    assert.equal(componentController.calls, componentCalls);
    assert.equal(pageController.events._handler, null);
    assert.equal(componentController.events._handler, null);
});

test("controller unload precedes helper and scope cleanup and repeated unload is idempotent", async () => {
    const order = [];
    const { context } = createRuntime({ order });
    const PageClass = await createPageClassFromJsDefinition("ordered-page.js", context, {
        meta: { id: "ordered-page" },
        controller({ services, session }) {
            return { unload() { order.push(`controller-unload:${session.id}`); assert.strictEqual(services.resolve("session"), session); } };
        }
    });
    const page = createPage(PageClass);
    page._servicesScope.addDisposable({ dispose() { order.push("helper-dispose"); } });

    await page.unload();
    await page.unload();

    assert.deepEqual(order, [
        `controller-unload:${order[0].split(":")[1]}`,
        "helper-dispose",
        `scoped-dispose:${order[0].split(":")[1]}`
    ]);
});

test("Page cleanup and scope disposal continue when controller unload fails", async () => {
    const order = [];
    const controllerFailure = new Error("Page controller unload failed");
    const { root, context } = createRuntime({ order });
    const PageClass = await createPageClassFromJsDefinition("failing-unload-page.js", context, {
        meta: { id: "failing-unload-page" },
        controller({ session }) { return { unload() { order.push("controller-unload"); throw controllerFailure; }, session }; }
    });
    const events = [];
    const page = new PageClass({ src: "/pages/failing.js", context: {}, bus: { emit(name) { events.push(name); } }, navigation: {} });
    page._servicesScope.addDisposable({ dispose() { order.push("helper-dispose"); } });

    await assert.rejects(page.unload(), error => error === controllerFailure);

    assert.deepEqual(events, ["xshell:page:unload"]);
    assert.deepEqual(order.slice(0, 2), ["controller-unload", "helper-dispose"]);
    assert.equal(root._children.length, 0);
    assert.equal(page._host, null);
    assert.equal(page._refs, null);
    await page.unload();
});

test("constructor failures asynchronously dispose created scopes without replacing the original error", async t => {
    const order = [];
    const { root, context } = createRuntime({ order });
    const controllerFailure = new Error("Controller construction failed.");
    const failedHelpers = [];
    const PageClass = await createPageClassFromJsDefinition("failing-page.js", context, {
        meta: { id: "failing-page" },
        controller({ session, events, timer }) { assert.ok(session); failedHelpers.push(events, timer); throw controllerFailure; }
    });
    const Component = await createComponentClassFromJsDefinition("failing-component.js", context, {
        meta: { id: `x-failing-component-${++runtimeId}` },
        contract: { methods: { execute: {} } },
        controller({ session, events, timer }) { failedHelpers.push(events, timer); return { session }; }
    });
    const cleanupErrors = [];
    t.mock.method(console, "error", (...args) => cleanupErrors.push(args));

    assert.throws(() => createPage(PageClass), error => error === controllerFailure);
    assert.throws(() => new Component(), /declares public method 'execute'.*controller\.execute is not a function/);
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(root._children.length, 0);
    assert.equal(order.filter(item => item.startsWith("scoped-dispose:")).length, 2);
    assert.ok(failedHelpers.every(helper => helper._handler === null));
    assert.deepEqual(cleanupErrors, []);
});

test("constructor cleanup reports scope disposal failures without an unhandled rejection", async t => {
    const constructionFailure = new Error("construction failed");
    const cleanupFailure = new Error("constructor cleanup failed");
    const { root, context } = createRuntime({ scopedDispose() { throw cleanupFailure; } });
    const PageClass = await createPageClassFromJsDefinition("cleanup-reporting-page.js", context, {
        meta: { id: "cleanup-reporting-page" },
        controller({ session }) { assert.ok(session); throw constructionFailure; }
    });
    const reported = [];
    t.mock.method(console, "error", (...args) => reported.push(args));

    assert.throws(() => createPage(PageClass), error => error === constructionFailure);
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(root._children.length, 0);
    assert.equal(reported.length, 1);
    assert.match(reported[0][0], /Failed to dispose Services scope for Page 'cleanup-reporting-page'/);
    assert.strictEqual(reported[0][1], cleanupFailure);
});

test("unload aggregates controller and scope failures after existing cleanup", async () => {
    const order = [];
    const controllerFailure = new Error("controller unload failed");
    const scopeFailure = new Error("scope disposal failed");
    const { context } = createRuntime({
        order,
        scopedDispose() { throw scopeFailure; }
    });
    const Component = await createComponentClassFromJsDefinition("cleanup-failures.js", context, {
        meta: { id: `x-cleanup-failures-${++runtimeId}` },
        controller({ session }) {
            return { session, unload() { order.push("controller-unload"); throw controllerFailure; } };
        }
    });
    const component = new Component();
    component._servicesScope.addDisposable({ dispose() { order.push("helper-dispose"); } });

    await assert.rejects(component.unload(), error => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [controllerFailure, scopeFailure]);
        return true;
    });

    assert.deepEqual(order.slice(0, 2), ["controller-unload", "helper-dispose"]);
    assert.equal(component._servicesScope, null);
    assert.equal(component._controller, null);
    await component.unload();
});
