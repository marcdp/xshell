import assert from "node:assert/strict";
import test from "node:test";

class FakeElement {
    constructor() {
        this._attributes = new Map();
    }

    attachShadow() {
        this.shadowRoot = { adoptedStyleSheets: [] };
        return this.shadowRoot;
    }

    getAttribute(name) {
        return this._attributes.get(name) ?? null;
    }

    setAttribute(name, value) {
        this._attributes.set(name, String(value));
    }

    removeAttribute(name) {
        this._attributes.delete(name);
    }

    get attributes() {
        return [...this._attributes].map(([name, value]) => ({ name, value }));
    }
}

globalThis.HTMLElement = FakeElement;
globalThis.CSSStyleSheet = class {
    replaceSync() {}
};
globalThis.customElements = {
    definitions: new Map(),
    define(name, definition) {
        this.definitions.set(name, definition);
    },
    get(name) {
        return this.definitions.get(name);
    }
};
globalThis.MutationObserver = class {
    observe() {}
};
globalThis.window = { customElements: globalThis.customElements };
globalThis.document = { baseURI: "https://example.test/" };
globalThis.history = { replaceState() {}, pushState() {} };
globalThis.location = { replace() {}, hash: "" };

const { createComponentClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/component-js.js");
const { createPageClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/page-js.js");
const { default: Navigation } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/navigation.js");
const { default: Page } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/page.js");
const bus = { emit() {} };
let activeNavigation;

class ReactiveStateEngineFactory {
    constructor(state) {
        this.state = state;
    }

    create(handler) {
        const state = { ...this.state };
        return new Proxy(state, {
            set(target, property, value) {
                const oldValue = target[property];
                if (oldValue !== value) {
                    target[property] = value;
                    handler.stateChange(property, oldValue, value);
                    handler.invalidate(property);
                }
                return true;
            }
        });
    }
}

class RenderEngineFactory {
    dependencies = [];
    slots = [];

    init() {}
}

function configureDefinitionLoaders() {
    const config = {
        modules: {
            test: {
                defaults: {
                    component: { stateEngine: "test", renderEngine: "test" },
                    page: { stateEngine: "test", renderEngine: "test" }
                }
            }
        }
    };
    const loader = {
        async load(resource) {
            if (resource === "schema:component" || resource === "schema:page") return {};
            return resource.startsWith("state-engine:") ? ReactiveStateEngineFactory : RenderEngineFactory;
        }
    };
    const services = {
        config,
        loader,
        bus,
        navigation: activeNavigation,
        modules: { shadowStyleSheets: [], getModuleById() { return { controller: {} }; } }
    };
    const rootServices = {
        beginScope() {
            return {
                beginScope: () => rootServices.beginScope(),
                resolve: name => services[name] ?? null,
                initialize: async name => services[name] ?? null,
                async dispose() {}
            };
        }
    };
    services.services = rootServices;
    return services;
}

function createNavigation(mode, xpages) {
    const replaceCalls = [];
    const pushCalls = [];
    const locationReplacements = [];
    globalThis.history = {
        replaceState(state, title, url) {
            replaceCalls.push(url);
        },
        pushState(state, title, url) {
            pushCalls.push(url);
        }
    };
    globalThis.location = {
        hash: "",
        replace(url) {
            locationReplacements.push(url);
        }
    };
    const mounted = [];
    const container = {
        querySelectorAll(selector) {
            return mounted;
        }
    };
    const navigation = new Navigation({
        areas: { globalPrefix: "/global", resolvePath() { return null; } },
        bus: { emit() {} },
        resolver: { has: href => href === "page:/_assets/test/pages/tool.js" },
        config: {
            app: { basePath: "", baseUrl: "https://example.test/" },
            xshell: { assets: { basePath: "/_assets" } }
        }
    }, { mode }, { container });
    activeNavigation = navigation;
    const initialize = async (items = xpages.map(xpage => navigation.parseUrl(xpage.src))) => {
        // Establish the requested stack through public navigation while presenting its existing hosts as mounted DOM.
        for (let index = 0; index < items.length; index++) {
            mounted.push(xpages[index]);
            const item = items[index];
            await navigation.navigate({
                href: item.href,
                params: item.params,
                nav: item.nav,
                open: index === 0 ? "top" : "stack",
                page: { src: xpages[0].src, host: xpages[0] },
                replace: true
            });
        }
        replaceCalls.length = 0;
        pushCalls.length = 0;
        locationReplacements.length = 0;
    };
    return { navigation, initialize, replaceCalls, pushCalls, locationReplacements };
}

function createDefinition(controller = () => ({})) {
    return { meta: { id: "page-query-reflection-test" }, controller };
}

function createContext(services) {
    return { resourceDefinition: { moduleId: "test" }, services };
}

async function createPageClass(properties, controller = () => ({})) {
    const services = configureDefinitionLoaders();
    return await createPageClassFromJsDefinition(
        "/page.js",
        createContext(services),
        { ...createDefinition(controller), contract: { properties } }
    );
}

function createPageInstance(PageType, src) {
    return new PageType({ src, context: {}, bus, navigation: activeNavigation });
}

function createXPage(src, layout = "main") {
    return {
        src,
        getAttribute(name) {
            return name === "layout" ? layout : null;
        },
        synchronizePageSrc(value) {
            this.src = value;
        }
    };
}

for (const mode of ["path", "hash"]) {
    test(`Global Page reflects query and fragment without loading in ${mode} mode`, async () => {
        const resource = "/global/_assets/test/pages/tool.js";
        const host = createXPage(resource + "?item=one#before");
        const { navigation, initialize, replaceCalls, pushCalls, locationReplacements } = createNavigation(mode, [host]);
        await initialize();
        const PageClass = await createPageClass({ item: { type: "string", state: true, query: true, reflect: true } });
        const page = createPageInstance(PageClass, host.src);
        page._host = host;

        // A query or fragment change synchronizes the mounted source through replaceState.
        page._state.item = "two";
        page.replaceHash("after");
        const source = resource + "?item=two#after";
        assert.equal(page.src, source);
        assert.equal(host.src, source);
        assert.deepEqual(navigation.stack[0].params, { item: "two" });
        assert.equal(navigation.stack[0].href, resource + "#after");
        assert.deepEqual(pushCalls, []);
        assert.equal((mode === "path" ? replaceCalls : locationReplacements).at(-1), (mode === "path" ? "" : "#!") + source);
    });
}

test("reflected Page state patches only its own query and removes contract defaults", async () => {
    const host = createXPage("/page.js?page-index=2&enabled=false&ratio=1.5&external=x");
    const { navigation, initialize, replaceCalls, pushCalls } = createNavigation("path", [host]);
    await initialize();
    const PageClass = await createPageClass({
        pageIndex: { type: "integer", default: 0, state: true, query: true, reflect: true },
        enabled: { type: "boolean", default: false, state: true, query: true, reflect: true },
        ratio: { type: "number", default: 1, state: true, query: true, reflect: true }
    });
    const page = createPageInstance(PageClass, host.src);
    page._host = host;

    assert.equal(page._state.pageIndex, 2);
    assert.equal(page._state.enabled, false);
    assert.equal(page._state.ratio, 1.5);
    assert.equal(replaceCalls.length, 0);
    const originalPage = page;

    page._state.pageIndex = 3;

    assert.equal(page, originalPage);
    assert.equal(navigation.stack[0].params["page-index"], "3");
    assert.equal(navigation.stack[0].params.external, "x");
    assert.equal(new URLSearchParams(replaceCalls.at(-1).split("?")[1]).get("page-index"), "3");
    assert.match(page.src, /page-index=3/);
    assert.match(host.src, /page-index=3/);
    assert.equal(pushCalls.length, 0);

    page._state.enabled = true;
    page._state.ratio = 2.5;

    assert.equal(navigation.stack[0].params.enabled, "true");
    assert.equal(navigation.stack[0].params.ratio, "2.5");

    page._state.pageIndex = 0;

    assert.equal(Object.hasOwn(navigation.stack[0].params, "page-index"), false);
    assert.equal(new URLSearchParams(replaceCalls.at(-1).split("?")[1]).has("page-index"), false);
    assert.doesNotMatch(page.src, /page-index=/);
    assert.equal(replaceCalls.length, 4);
});

test("reflected Page JSON values serialize, remove defaults, and preserve JSON null", async () => {
    const host = createXPage("/page.js?external=x#details");
    const { navigation, initialize, replaceCalls } = createNavigation("path", [host]);
    await initialize();
    const PageClass = await createPageClass({
        args: { type: "object", default: {}, state: true, query: true, queryParser: "json", reflect: true },
        value: { type: "any", default: false, state: true, query: true, queryParser: "json", reflect: true }
    });
    const page = createPageInstance(PageClass, host.src);
    page._host = host;

    page._state.args = { path: "/docs/file.txt", options: [1, true] };
    assert.deepEqual(JSON.parse(navigation.stack[0].params.args), { path: "/docs/file.txt", options: [1, true] });
    assert.equal(navigation.stack[0].href, "/page.js#details");
    assert.equal(navigation.stack[0].params.external, "x");

    page._state.value = null;
    assert.equal(navigation.stack[0].params.value, "null");
    assert.equal(new URLSearchParams(replaceCalls.at(-1).split("?")[1].split("#")[0]).get("value"), "null");

    page._state.args = {};
    assert.equal(Object.hasOwn(navigation.stack[0].params, "args"), false);
});

test("Page JSON reflection rejects JavaScript values that JSON would serialize lossily", async () => {
    const host = createXPage("/page.js");
    const { navigation, initialize } = createNavigation("path", [host]);
    await initialize();
    const PageClass = await createPageClass({
        value: { type: "any", default: null, state: true, query: true, queryParser: "json", reflect: true }
    });
    const page = createPageInstance(PageClass, host.src);
    page._host = host;

    for (const value of [undefined, () => {}, Number.NaN, { omitted: undefined }, [undefined], new Date()]) {
        assert.throws(() => { page._state.value = value; }, /cannot be serialized losslessly as JSON/);
    }
    const cyclic = {};
    cyclic.self = cyclic;
    assert.throws(() => { page._state.value = cyclic; }, /cannot be serialized losslessly as JSON/);
});

test("Page JSON reflection uses existing hash-mode navigation serialization", async () => {
    const host = createXPage("/page.js");
    const { navigation, initialize, locationReplacements } = createNavigation("hash", [host]);
    await initialize();
    const PageClass = await createPageClass({
        args: { type: "object", default: {}, state: true, query: true, queryParser: "json", reflect: true }
    });
    const page = createPageInstance(PageClass, host.src);
    page._host = host;

    page._state.args = { path: "/docs/file.txt" };

    assert.equal(locationReplacements.length, 1);
    assert.deepEqual(JSON.parse(navigation.parseUrl(locationReplacements[0].substring(2)).params.args), { path: "/docs/file.txt" });
});

test("stacked Page query reflection preserves other stack items and navigation metadata", async () => {
    const xpages = [
        createXPage("/customers?status=active"),
        createXPage("/customer?id=42&tab=summary"),
        createXPage("/order?id=100")
    ];
    const { navigation, initialize, replaceCalls, pushCalls } = createNavigation("path", xpages);
    await initialize([
        navigation.parseUrl(xpages[0].src),
        { ...navigation.parseUrl(xpages[1].src), nav: { title: "Customer", marker: "keep" } },
        navigation.parseUrl(xpages[2].src)
    ]);
    const page = createPageInstance(Page, xpages[1].src);
    page._host = xpages[1];

    page.replaceQuery({ tab: "details" });

    assert.deepEqual(navigation.stack[0].params, { status: "active" });
    assert.deepEqual(navigation.stack[2].params, { id: "100" });
    assert.deepEqual(navigation.stack[1].params, { id: "42", tab: "details" });
    assert.deepEqual(navigation.stack[1].nav, { title: "Customer", marker: "keep" });
    assert.equal(pushCalls.length, 0);
    assert.equal(replaceCalls.length, 1);
    const serialized = navigation.parseUrl(replaceCalls[0]);
    assert.deepEqual(serialized.nav.stack[0].params, { id: "42", tab: "details" });
    assert.deepEqual(serialized.nav.stack[0].nav, { title: "Customer", marker: "keep" });
    assert.match(page.src, /tab=details/);
});

test("hash-mode Page query reflection uses replacement serialization", async () => {
    const host = createXPage("/page.js?enabled=false");
    const { navigation, initialize, locationReplacements } = createNavigation("hash", [host]);
    await initialize();
    const page = createPageInstance(Page, host.src);
    page._host = host;

    page.replaceQuery({ enabled: true });

    assert.equal(locationReplacements.length, 1);
    assert.equal(locationReplacements[0].startsWith("#!/"), true);
    assert.equal(navigation.parseUrl(locationReplacements[0].substring(2)).params.enabled, "true");
});

test("dialog and embedded Pages patch local src without changing the navigation stack", async () => {
    const stackHost = createXPage("/page.js?root=1");
    const dialogHost = createXPage("/dialog.js?tab=summary&external=x", "dialog");
    const { navigation, initialize, replaceCalls, locationReplacements } = createNavigation("path", [stackHost]);
    await initialize();
    const page = createPageInstance(Page, dialogHost.src);
    page._host = dialogHost;

    page.replaceQuery({ tab: "details" });

    assert.match(page.src, /tab=details/);
    assert.equal(navigation.stack[0].params.root, "1");
    assert.equal(replaceCalls.length, 0);
    assert.equal(locationReplacements.length, 0);
});

test("root Page hash replacement preserves query and synchronizes its source without loading", async () => {
    const host = {
        _src: "/page.js?tab=summary#overview",
        syncCalls: 0,
        get src() { return this._src; },
        set src(value) { throw new Error(`Page reload attempted: ${value}`); },
        getAttribute(name) { return name === "layout" ? "main" : null; },
        synchronizePageSrc(value) { this._src = value; this.syncCalls++; }
    };
    const { navigation, initialize, replaceCalls, pushCalls } = createNavigation("path", [host]);
    await initialize();
    const originalStack = navigation.stack;
    const originalItem = originalStack[0];
    const page = createPageInstance(Page, host.src);
    page._host = host;

    assert.equal(page.replaceHash("details"), "/page.js?tab=summary#details");
    await Promise.resolve();

    assert.equal(navigation.stack[0].href, "/page.js#details");
    assert.deepEqual(navigation.stack[0].params, { tab: "summary" });
    assert.notDeepEqual(navigation.stack, originalStack);
    assert.notDeepEqual(navigation.stack[0], originalItem);
    assert.deepEqual(replaceCalls, ["/page.js?tab=summary#details"]);
    assert.equal(pushCalls.length, 0);
    assert.equal(page.src, "/page.js?tab=summary#details");
    assert.equal(host.src, page.src);
    assert.equal(host.syncCalls, 1);
});

test("Page hashes accept a leading marker and empty values remove the fragment", async () => {
    const host = createXPage("/page.js?tab=summary#overview");
    const { navigation, initialize, replaceCalls } = createNavigation("path", [host]);
    await initialize();
    const page = createPageInstance(Page, host.src);
    page._host = host;

    assert.equal(page.replaceHash("#details"), "/page.js?tab=summary#details");
    assert.equal(page.replaceHash(""), "/page.js?tab=summary");
    assert.equal(page.replaceHash("#again"), "/page.js?tab=summary#again");
    assert.equal(page.replaceHash(null), "/page.js?tab=summary");
    await Promise.resolve();

    assert.deepEqual(replaceCalls, [
        "/page.js?tab=summary#details",
        "/page.js?tab=summary",
        "/page.js?tab=summary#again",
        "/page.js?tab=summary"
    ]);
    assert.equal(navigation.stack[0].href, "/page.js");
    assert.deepEqual(navigation.stack[0].params, { tab: "summary" });
});

test("stacked Page hash replacement changes only its item", async () => {
    const xpages = [
        createXPage("/customers?status=active#list"),
        createXPage("/customer?id=42&tab=summary#overview"),
        createXPage("/order?id=100#receipt")
    ];
    const { navigation, initialize, replaceCalls, pushCalls } = createNavigation("path", xpages);
    await initialize([
        navigation.parseUrl(xpages[0].src),
        { ...navigation.parseUrl(xpages[1].src), nav: { title: "Customer", marker: "keep" } },
        navigation.parseUrl(xpages[2].src)
    ]);
    const [root, oldTarget, order] = navigation.stack;
    const page = createPageInstance(Page, xpages[1].src);
    page._host = xpages[1];

    const src = page.replaceHash("details");
    await Promise.resolve();

    assert.equal(navigation.parseUrl(src).href, "/customer#details");
    assert.deepEqual(navigation.parseUrl(src).params, { id: "42", tab: "summary" });
    assert.deepEqual(navigation.stack[0], root);
    assert.deepEqual(navigation.stack[2], order);
    assert.notDeepEqual(navigation.stack[1], oldTarget);
    assert.equal(navigation.stack[1].href, "/customer#details");
    assert.deepEqual(navigation.stack[1].params, { id: "42", tab: "summary" });
    assert.deepEqual(navigation.stack[1].nav, oldTarget.nav);
    assert.equal(xpages[1].src, page.src);
    assert.equal(replaceCalls.length, 1);
    assert.equal(pushCalls.length, 0);
    const restored = navigation.parseUrl(replaceCalls[0]).nav.stack[0];
    assert.equal(restored.href, "/customer#details");
    assert.deepEqual(restored.params, oldTarget.params);
    assert.deepEqual(restored.nav, oldTarget.nav);
});

test("hash-mode Page fragment replacement preserves the XShell navigation prefix", async () => {
    const host = createXPage("/page.js?tab=summary#overview");
    const { navigation, initialize, locationReplacements, pushCalls } = createNavigation("hash", [host]);
    await initialize();
    const page = createPageInstance(Page, host.src);
    page._host = host;

    page.replaceHash("details");
    await Promise.resolve();

    assert.deepEqual(locationReplacements, ["#!/page.js?tab=summary#details"]);
    assert.equal(pushCalls.length, 0);
    const restored = navigation.parseUrl(locationReplacements[0].substring(2));
    assert.equal(restored.href, "/page.js#details");
    assert.deepEqual(restored.params, { tab: "summary" });
});

test("dialog and embedded Page hashes change only their local sources", async () => {
    const stackHost = createXPage("/page.js?root=1#main");
    const { navigation, initialize, replaceCalls, pushCalls, locationReplacements } = createNavigation("path", [stackHost]);
    await initialize();
    const stack = navigation.stack;

    for (const layout of ["dialog", "embed"]) {
        const host = createXPage("/dialog.js?tab=summary#old", layout);
        const page = createPageInstance(Page, host.src);
        page._host = host;
        assert.equal(page.replaceHash("new"), "/dialog.js?tab=summary#new");
        assert.equal(host.src, page.src);
        assert.equal(page.replaceHash(null), "/dialog.js?tab=summary");
        assert.equal(host.src, page.src);
    }

    assert.deepEqual(navigation.stack, stack);
    assert.equal(stackHost.src, "/page.js?root=1#main");
    assert.equal(replaceCalls.length, 0);
    assert.equal(pushCalls.length, 0);
    assert.equal(locationReplacements.length, 0);
    assert.equal(navigation.replacePageHash({ src: null }, "new"), null);
});

test("Page hash replacement rejects values other than strings and null", async () => {
    const host = createXPage("/page.js#old");
    const { navigation, initialize, replaceCalls } = createNavigation("path", [host]);
    await initialize();
    const page = createPageInstance(Page, host.src);
    page._host = host;

    for (const value of [{}, [], 123, undefined]) {
        assert.throws(() => page.replaceHash(value), { name: "TypeError", message: "Navigation.replacePageHash: hash must be a string or null." });
    }
    assert.equal(page.src, "/page.js#old");
    assert.equal(replaceCalls.length, 0);
});

test("attribute reflection remains independent from Page-query metadata", async () => {
    const services = configureDefinitionLoaders();
    const Component = await createComponentClassFromJsDefinition(
        "component.js",
        createContext(services),
        {
            meta: { id: "query-reflection-component" },
            contract: { properties: { value: { type: "string", default: "default", state: true, attribute: true, reflect: true } } },
            controller: () => ({})
        }
    );
    const component = new Component();

    component.value = "changed";

    assert.equal(component.getAttribute("value"), "changed");
});
