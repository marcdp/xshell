import assert from "node:assert/strict";
import test from "node:test";
import ComponentSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/component.schema.json" with { type: "json" };
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import { Validator } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/vendor/json-schema/4.1.1/json-schema.js";
import Dialog from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/dialog.js";
import pickerDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/dialog-picker.js";
import mainLayoutDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-main.js";

const animationFrames = [];
const bus = { emit() {} };

class FakeNode {
    adoptedStyleSheets = [];
    childNodes = [];
    nodeName = "X-PAGE";

    get firstChild() {
        return this.childNodes[0] ?? null;
    }

    appendChild(node) {
        this.childNodes.push(node);
        node.parentNode = this;
        return node;
    }

    removeChild(node) {
        this.childNodes.splice(this.childNodes.indexOf(node), 1);
        node.parentNode = null;
        node.disconnectedCallback?.();
        return node;
    }

    replaceChildren(...nodes) {
        this.childNodes = nodes;
    }

    querySelector() {
        return null;
    }

    querySelectorAll() {
        return this.childNodes.flatMap(child => [child, ...child.querySelectorAll()]);
    }
}

class FakeElement extends FakeNode {
    constructor() {
        super();
        this._attributes = new Map();
        this._listeners = new Map();
    }

    attachShadow() {
        this.shadowRoot = new FakeNode();
        return this.shadowRoot;
    }

    addEventListener(name, listener) {
        const listeners = this._listeners.get(name) ?? [];
        listeners.push(listener);
        this._listeners.set(name, listeners);
    }

    dispatchEvent(event) {
        for (const listener of this._listeners.get(event.type) ?? []) listener(event);
    }

    contains() {
        return false;
    }

    getAttribute(name) {
        return this._attributes.get(name) ?? null;
    }

    hasAttribute(name) {
        return this._attributes.has(name);
    }

    setAttribute(name, value) {
        this._attributes.set(name, String(value));
    }

    removeAttribute(name) {
        const oldValue = this.getAttribute(name);
        this._attributes.delete(name);
        if (oldValue !== null && this.constructor.observedAttributes?.includes(name)) this.attributeChangedCallback(name, oldValue, null);
    }

    get attributes() {
        return [...this._attributes.entries()].map(([name, value]) => ({ name, value }));
    }

    remove() {
        this.removed = true;
        this.parentNode?.removeChild(this);
    }
}

globalThis.HTMLElement = FakeElement;
globalThis.CSSStyleSheet = class {
    replaceSync() {}
};
globalThis.MutationObserver = class {
    observations = [];
    disconnectCount = 0;

    observe(target, options) {
        this.observations.push({ target, options });
    }

    disconnect() {
        this.disconnectCount += 1;
    }
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
globalThis.window = { customElements: globalThis.customElements, location: { origin: "https://example.test" } };
globalThis.document = {
    adoptedStyleSheets: [],
    baseURI: "https://example.test/",
    body: { querySelectorAll() { return []; } },
    implementation: {
        createHTMLDocument() {
            return {
                createElement(name) {
                    const element = new FakeElement();
                    element.localName = name;
                    element.matches = () => false;
                    return element;
                }
            };
        }
    },
    createElement(name) {
        if (name === "x-page") return new (customElements.get(name))();
        const element = new FakeElement();
        element.localName = name;
        return element;
    }
};
globalThis.requestAnimationFrame = callback => {
    animationFrames.push(callback);
    return animationFrames.length;
};

const { createComponentClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/component-js.js");
const { RenderEngineHtml } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/render-engines/html.js");
const { createPageClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/page-js.js");
const { createXPageClass } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/x-page.js");
const { default: Navigation } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/navigation.js");
const { default: Page } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/page.js");
const { default: LoaderPageMd } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/page-md.js");
const { default: Resolver } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/resolver.js");

// Register the test class for Navigation paths that construct a host through the DOM.
const XPage = createXPageClass({});
customElements.define("x-page", XPage);

test("x-page treats nullish and removed src as empty without loading it", () => {
    const cases = [
        page => { page.src = null; },
        page => { page.src = undefined; },
        page => {
            page._attributes.set("src", "/pages/old.js");
            page.removeAttribute("src");
            assert.equal(page.getAttribute("src"), null);
        }
    ];
    for (const clearSource of cases) {
        const page = new XPage();
        const loads = [];
        page.load = () => loads.push(page.src);
        page.src = "/pages/old.js";
        page.connectedCallback();
        assert.deepEqual(loads, ["/pages/old.js"]);

        assert.doesNotThrow(() => clearSource(page));
        assert.equal(page.src, "");
        assert.equal(page._src, "");
        assert.deepEqual(loads, ["/pages/old.js"]);
    }
});

function markdownContext(loader) {
    const config = { xshell: { ui: { components: { markdown: "x-markdown" } } } };
    return { services: { config, loader } };
}

test("Markdown adapter loads its component without fetching, and follows the Page lifecycle across mounts", async (t) => {
    const resources = [];
    t.mock.method(globalThis, "fetch", () => { throw new Error("page-md must not fetch Markdown"); });
    const loader = { async load(resource) { resources.push(resource); } };
    const source = "/_assets/xshell-docs/pages/10-architecture/100-services.md";
    const MarkdownPage = await new LoaderPageMd().load(source, markdownContext(loader));
    assert.deepEqual(resources, ["component:x-markdown"]);
    const emit = t.mock.fn();
    const page = new MarkdownPage({ src: source + "?view=one#section", context: {}, bus: { emit } });
    assert.ok(page instanceof Page);
    assert.equal(page.src, source + "?view=one#section");
    assert.equal(page.label, null); // menu/navigation metadata can supply the label
    await page.load();
    await page.load();
    assert.deepEqual(emit.mock.calls.map(call => call.arguments), [["xshell:page:load", { src: page.src, id: page.id }]]);
    assert.deepEqual(Object.keys(page), []);
    const host = new FakeNode();
    await page.mount({ host });
    const first = host.firstChild;
    assert.equal(first.localName, "x-markdown");
    assert.equal(first.getAttribute("src"), source);
    assert.equal(first.getAttribute("src").startsWith("string:"), false);
    await page.unmount();
    assert.equal(host.childNodes.length, 0);
    assert.equal(page.host, null);
    await page.mount({ host });
    assert.equal(host.firstChild.getAttribute("src"), source);
    assert.notEqual(host.firstChild, first);
    await page.unmount();
    await page.unload();
    await page.mount({ host });
    assert.equal(host.childNodes.length, 0);
    assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test("Markdown adapter passes the resolved resource URL instead of the Area-qualified navigation source", async () => {
    const loader = { async load() {} };
    const config = {
        app: { basePath: "/prefix/xshell-docs", baseUrl: "https://example.test/prefix/xshell-docs/" },
        xshell: { resolver: { page: {
            "/_assets/xshell-docs/1.0.0.dev/{path}.md": {
                src: "/_assets/xshell-docs/1.0.0.dev/{path}.md",
                loader: "page-md",
                cache: true,
                cacheMode: "path"
            }
        } } }
    };
    const resolved = new Resolver({ config }).resolve("page:/_assets/xshell-docs/1.0.0.dev/pages/index.md");
    const MarkdownPage = await new LoaderPageMd().load(resolved.url, markdownContext(loader));
    const navigationSrc = "/xshell-docs/_assets/xshell-docs/1.0.0.dev/pages/index.md?view=all#section";
    const page = new MarkdownPage({ src: navigationSrc, context: {}, bus });
    const host = new FakeNode();
    await page.load();
    await page.mount({ host });
    assert.equal(page.src, navigationSrc);
    assert.equal(host.firstChild.getAttribute("src"), "https://example.test/prefix/xshell-docs/_assets/xshell-docs/1.0.0.dev/pages/index.md");
});

test("Markdown adapter propagates component resolution/loading failure", async () => {
    const loader = { async load() { throw new Error("component unavailable"); } };
    await assert.rejects(new LoaderPageMd().load("/guide.md", markdownContext(loader)), /component unavailable/);
});

test("x-page intercepts only application anchors and preserves native clicks", async (t) => {
    const cases = [
        { href: "/customers", intercept: true },
        { href: "/_assets/xshell-docs/pages/10-architecture/100-services.md", intercept: true },
        { href: "relative-page.js", intercept: true },
        { href: "another-document.md?view=one#section", intercept: true },
        { href: "#!/customers?view=one", intercept: true },
        { href: "/customers", target: "_self", intercept: true },
        { href: "/customers", target: "_SELF", intercept: true },
        { href: "#section" },
        { href: "#" },
        { href: "https://example.com/page" },
        { href: "http://example.com/page" },
        { href: "mailto:user@example.com" },
        { href: "tel:+1234" },
        { href: "data:text/plain,hello" },
        { href: "blob:https://example.com/id" },
        { href: "Custom+v1.2-test:resource" },
        { href: "//example.com/page" },
        { href: "/customers", event: { ctrlKey: true } },
        { href: "/customers", event: { metaKey: true } },
        { href: "/customers", event: { shiftKey: true } },
        { href: "/customers", event: { altKey: true } },
        { href: "/customers", event: { button: 1 } },
        { href: "/customers", event: { button: 2 } },
        { href: "/customers", event: { defaultPrevented: true } },
        { href: "/customers", download: true },
        { href: "/customers", target: "_blank" },
        { href: "/customers", target: "_parent" },
        { href: "/customers", target: "_top" },
        { href: "/customers", target: "preview" },
        { href: "" },
        { href: null }
    ];
    for (const mode of ["path", "hash"]) {
        for (const scenario of cases) {
            await t.test(`${mode}: ${JSON.stringify(scenario)}`, () => {
                // exercise the registered click listener with real Navigation URL parsing
                const navigation = new Navigation({
                    areas: { resolvePath() { return null; } }, bus: {},
                    config: { app: { basePath: "", baseUrl: "https://example.test/" }, xshell: { assets: { basePath: "/_assets" } } }
                }, { mode }, { container: {} });
                const calls = [];
                navigation.navigate = item => calls.push(item);
                const XPage = createXPageClass({ navigation });
                const xpage = new XPage();
                xpage._page = new Page({ src: "/pages/current.js", context: {} });
                const anchor = document.createElement("a");
                if (scenario.href !== null) anchor.setAttribute("href", scenario.href);
                if (scenario.download) anchor.setAttribute("download", "");
                anchor.target = scenario.target || "";
                anchor.closest = selector => selector === "a" ? anchor : xpage;
                xpage.contains = element => element === anchor;
                let prevented = 0;
                let stopped = 0;
                const event = {
                    type: "click", target: anchor, button: 0, defaultPrevented: false,
                    metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
                    ...scenario.event,
                    preventDefault() { prevented++; this.defaultPrevented = true; },
                    stopPropagation() { stopped++; }
                };
                xpage.dispatchEvent(event);
                const expected = scenario.intercept ? 1 : 0;
                assert.equal(calls.length, expected);
                assert.equal(prevented, expected);
                assert.equal(stopped, expected);
                if (scenario.intercept) {
                    assert.deepEqual(calls[0], { href: scenario.href, open: "auto", page: xpage.page });
                    assert.equal(calls[0].page, xpage.page);
                }
            });
        }
    }
});

test("x-page native anchors and x-anchor targets reach the same JavaScript and Markdown Pages", () => {
    const definitions = [
        { id: "demo", prefix: "/demo", modules: ["x-demo"] },
        { id: "xshell-docs", prefix: "/xshell-docs", modules: ["xshell-docs"] }
    ];
    const areas = {
        resolveAreaId(href) {
            return definitions.find(area => href === area.prefix || href.startsWith(area.prefix + "/"))?.id || null;
        },
        getArea(id) { return definitions.find(area => area.id === id) || null; },
        getAreas() { return definitions; },
        getCurrentArea() { return definitions[0]; },
        getDefaultArea() { return definitions[0]; },
        getModuleId(href) { return /\/_assets\/([^/]+)\//.exec(href)?.[1] || null; },
        resolveHref() { return null; },
        resolvePath() { return null; }
    };
    const scenarios = [
        {
            name: "JavaScript Page",
            pageSrc: "/demo/_assets/x-demo/1.0.0.dev/pages/01-components/01-basics.js",
            renderedHref: "/prefix/_assets/x-demo/1.0.0.dev/pages/01-components/02-forms.js?view=all#examples",
            authoredHref: "02-forms.js?view=all#examples"
        },
        {
            name: "Markdown Page",
            pageSrc: "/xshell-docs/_assets/xshell-docs/1.0.0.dev/pages/index.md",
            renderedHref: "/prefix/_assets/xshell-docs/1.0.0.dev/pages/10-architecture/30-modules.md?view=all#configuration",
            authoredHref: "10-architecture/30-modules.md?view=all#configuration"
        }
    ];

    for (const mode of ["path", "hash"]) {
        for (const scenario of scenarios) {
            const browserUrls = [];
            const navigation = new Navigation({
                areas,
                bus: {},
                config: {
                    app: { basePath: "/prefix", baseUrl: "https://example.test/prefix/" },
                    xshell: { assets: { basePath: "/_assets" } }
                }
            }, { mode }, { container: { querySelectorAll() { return []; } } });
            navigation.navigate = params => { browserUrls.push(navigation.buildUrlAbsolute(params)); };
            const XPage = createXPageClass({ navigation });
            const xpage = new XPage();
            xpage._page = new Page({ src: scenario.pageSrc, context: {} });
            const anchor = document.createElement("a");
            anchor.setAttribute("href", scenario.renderedHref);
            anchor.target = "";
            anchor.closest = selector => selector === "a" ? anchor : xpage;
            const event = {
                type: "click", target: anchor, button: 0, defaultPrevented: false,
                metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
                composedPath() { return [anchor, xpage]; },
                preventDefault() { this.defaultPrevented = true; },
                stopPropagation() {}
            };

            xpage.dispatchEvent(event);

            const xAnchorUrl = navigation.buildUrlAbsolute({ href: scenario.authoredHref, page: xpage.page });
            assert.deepEqual(browserUrls, [xAnchorUrl], `${mode}: ${scenario.name}`);
            assert.equal(browserUrls[0].includes("/prefix/demo/prefix/"), false);
            assert.equal(browserUrls[0].includes("/prefix/xshell-docs/prefix/"), false);
        }
    }
});

test("x-page finds native anchors through a composed Shadow DOM click path", () => {
    const calls = [];
    const navigation = { navigate(item) { calls.push(item); } };
    const XPage = createXPageClass({ navigation });
    const xpage = new XPage();
    xpage._page = new Page({ src: "/demo/_assets/example/pages/current.js", context: {} });
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "next.js");
    anchor.target = "";
    anchor.closest = () => null;
    const componentHost = document.createElement("example-component");
    componentHost.closest = () => null;
    const event = {
        type: "click", target: componentHost, button: 0, defaultPrevented: false,
        metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
        composedPath() { return [anchor, { nodeName: "#document-fragment" }, componentHost, xpage]; },
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() {}
    };

    xpage.dispatchEvent(event);

    assert.deepEqual(calls, [{ href: "next.js", open: "auto", page: xpage.page }]);
    assert.equal(event.defaultPrevented, true);
});

const renderEngines = [];

class StateEngineFactory {
    constructor(state) {
        this.state = state;
    }

    create() {
        return { ...this.state };
    }
}

class RenderEngineFactory {
    dependencies = [];
    slots = [];

    init() {}

    create({ state } = {}) {
        const renderEngine = {
            mountCount: 0,
            renderCount: 0,
            unmountCount: 0,
            lastState: null,
            mount() {
                this.mountCount += 1;
            },
            render() {
                this.renderCount += 1;
                this.lastState = { ...state };
            },
            unmount() {
                this.unmountCount += 1;
            }
        };
        renderEngines.push(renderEngine);
        return renderEngine;
    }
}

let definitionServices;

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
            if (resource.startsWith("schema:")) return {};
            return resource.startsWith("state-engine:") ? StateEngineFactory : RenderEngineFactory;
        }
    };
    const modules = { getModuleById() { return { controller: {} }; } };
    const services = new Services({ config, loader, contracts: {}, resolver: {}, bus });
    definitionServices = { config, loader, modules, services };
}

function createContext() {
    return { resourceDefinition: { moduleId: "test" }, services: definitionServices };
}

function flushAnimationFrames() {
    const callbacks = animationFrames.splice(0);
    for (const callback of callbacks) {
        callback();
    }
}

function createDeferred() {
    let resolve, reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

test("Component definitions reject an ID already registered by another source", async () => {
    configureDefinitionLoaders();
    const id = "x-component-collision-test";
    const Component = await createComponentClassFromJsDefinition("first-component.js", createContext(), { meta: { id } }, {});
    assert.equal(customElements.get(id), Component);
    assert.equal(Component.isXShellComponent, true);

    await assert.rejects(
        createComponentClassFromJsDefinition("second-component.js", createContext(), { meta: { id } }, {}),
        error => error.message.includes(id) && error.message.includes("second-component.js")
    );
    assert.equal(customElements.get(id), Component);
});

test("component preserves its instance lifetime across reconnects and unloads once", async () => {
    configureDefinitionLoaders();
    renderEngines.length = 0;
    animationFrames.length = 0;
    const commands = [];
    const Component = await createComponentClassFromJsDefinition("component-lifecycle.js", createContext(), {
        meta: { id: "x-component-lifecycle-test" },
        state: { value: 1, settings: {} },
        controller() {
            return {
                load() { commands.push("load"); },
                mount() { commands.push("mount"); },
                unmount() { commands.push("unmount"); },
                unload() { commands.push("unload"); }
            };
        }
    }, {});
    const component = new Component();
    const mutationObserver = component._mutationObserver;
    const controller = component._controller;
    const disposable = { disposeCount: 0, dispose() { this.disposeCount += 1; } };
    const servicesScope = component._servicesScope;
    servicesScope.addDisposable(disposable);
    assert.ok(mutationObserver instanceof MutationObserver);
    assert.deepEqual(mutationObserver.observations, [{ target: component, options: { attributes: true } }]);

    component.connectedCallback();
    const firstRenderEngine = component._renderEngine;
    component._state.value = 2;
    component.connectedMoveCallback();

    assert.deepEqual(commands, ["load", "mount"]);
    assert.equal(component._renderEngine, firstRenderEngine);
    assert.equal(component._state.value, 2);

    component.disconnectedCallback();

    assert.deepEqual(commands, ["load", "mount", "unmount"]);
    assert.equal(component._controller, controller);
    assert.equal(component._state.value, 2);
    assert.equal(component._renderEngine, null);
    assert.equal(firstRenderEngine.unmountCount, 1);
    assert.equal(disposable.disposeCount, 0);
    assert.equal(mutationObserver.disconnectCount, 0);

    component.connectedCallback();
    const secondRenderEngine = component._renderEngine;
    assert.notEqual(secondRenderEngine, firstRenderEngine);
    assert.deepEqual(commands, ["load", "mount", "unmount", "mount"]);
    assert.equal(component._mutationObserver, mutationObserver);
    assert.equal(mutationObserver.observations.length, 1);

    component.invalidate();
    component.disconnectedCallback();
    assert.doesNotThrow(flushAnimationFrames);
    assert.equal(secondRenderEngine.renderCount, 0);

    await component.unload();
    assert.equal(mutationObserver.disconnectCount, 1);
    assert.equal(component._mutationObserver, null);
    await component.unload();
    assert.deepEqual(commands, ["load", "mount", "unmount", "mount", "unmount", "unload"]);
    assert.equal(mutationObserver.disconnectCount, 1);
    assert.equal(disposable.disposeCount, 1);
});

test("Components without awaitLoad and with awaitLoad false preserve immediate mounting", async () => {
    for (const [name, awaitLoad] of [["omitted", undefined], ["false", false]]) {
        configureDefinitionLoaders();
        renderEngines.length = 0;
        animationFrames.length = 0;
        const loading = createDeferred();
        const meta = { id: `x-await-load-${name}-test` };
        if (awaitLoad !== undefined) meta.awaitLoad = awaitLoad;
        const Component = await createComponentClassFromJsDefinition(`await-load-${name}.js`, createContext(), {
            meta,
            controller() { return { load() { return loading.promise; } }; }
        }, {});
        const component = new Component();

        component.connectedCallback();
        flushAnimationFrames();

        assert.equal(renderEngines.length, 1);
        assert.equal(renderEngines[0].mountCount, 1);
        assert.equal(renderEngines[0].renderCount, 1);
        loading.resolve();
        await loading.promise;
        await component.unload();
    }
});

test("awaitLoad accepts synchronous load and mounts once with initialized state", async () => {
    configureDefinitionLoaders();
    renderEngines.length = 0;
    animationFrames.length = 0;
    let loadCount = 0;
    const Component = await createComponentClassFromJsDefinition("await-load-sync.js", createContext(), {
        meta: { id: "x-await-load-sync-test", awaitLoad: true },
        state: { value: "initial" },
        controller({ state }) {
            return { load() { loadCount++; state.value = "loaded"; } };
        }
    }, {});
    const component = new Component();

    component.connectedCallback();
    component.connectedCallback();
    flushAnimationFrames();

    assert.equal(loadCount, 1);
    assert.equal(renderEngines.length, 1);
    assert.equal(renderEngines[0].mountCount, 1);
    assert.equal(renderEngines[0].renderCount, 1);
    assert.equal(renderEngines[0].lastState.value, "loaded");
    await component.unload();
});

test("awaitLoad blocks mounts, renders, and invalidations until asynchronous initialization completes", async () => {
    configureDefinitionLoaders();
    renderEngines.length = 0;
    animationFrames.length = 0;
    const loading = createDeferred();
    const Component = await createComponentClassFromJsDefinition("await-load-async.js", createContext(), {
        meta: { id: "x-await-load-async-test", awaitLoad: true },
        state: { value: "initial" },
        controller({ state, host }) {
            return {
                async load() {
                    state.value = "loading";
                    host.invalidate();
                    await loading.promise;
                    state.value = "loaded";
                    host.invalidate();
                }
            };
        }
    }, {});
    const component = new Component();

    component.connectedCallback();
    component.invalidate();
    flushAnimationFrames();
    assert.equal(renderEngines.length, 0);

    loading.resolve();
    await loading.promise;
    await Promise.resolve();
    flushAnimationFrames();

    assert.equal(renderEngines.length, 1);
    assert.equal(renderEngines[0].mountCount, 1);
    assert.equal(renderEngines[0].renderCount, 1);
    assert.equal(renderEngines[0].lastState.value, "loaded");
    await component.unload();
});

test("awaitLoad defers mounting while disconnected and mounts on a connected completion or later reconnect", async () => {
    for (const reconnectBeforeCompletion of [false, true]) {
        configureDefinitionLoaders();
        renderEngines.length = 0;
        animationFrames.length = 0;
        const loading = createDeferred();
        const Component = await createComponentClassFromJsDefinition(`await-load-reconnect-${reconnectBeforeCompletion}.js`, createContext(), {
            meta: { id: `x-await-load-reconnect-${reconnectBeforeCompletion}-test`, awaitLoad: true },
            controller() { return { load() { return loading.promise; } }; }
        }, {});
        const component = new Component();
        component.connectedCallback();
        component.disconnectedCallback();
        if (reconnectBeforeCompletion) component.connectedCallback();

        loading.resolve();
        await loading.promise;
        await Promise.resolve();
        assert.equal(renderEngines.length, reconnectBeforeCompletion ? 1 : 0);

        component.connectedCallback();
        component.connectedCallback();
        flushAnimationFrames();
        assert.equal(renderEngines.length, 1);
        assert.equal(renderEngines[0].mountCount, 1);
        await component.unload();
    }
});

test("awaitLoad never mounts after unloading during initialization", async () => {
    configureDefinitionLoaders();
    renderEngines.length = 0;
    animationFrames.length = 0;
    const loading = createDeferred();
    const commands = [];
    const Component = await createComponentClassFromJsDefinition("await-load-unload.js", createContext(), {
        meta: { id: "x-await-load-unload-test", awaitLoad: true },
        controller() {
            return {
                load() { commands.push("load"); return loading.promise; },
                unload() { commands.push("unload"); }
            };
        }
    }, {});
    const component = new Component();
    component.connectedCallback();

    await component.unload();
    loading.resolve();
    await loading.promise;
    await Promise.resolve();
    component.connectedCallback();
    flushAnimationFrames();

    assert.deepEqual(commands, ["load", "unload"]);
    assert.equal(renderEngines.length, 0);
});

test("awaitLoad reports asynchronous load failures, prevents mounting, and still unloads", async (t) => {
    configureDefinitionLoaders();
    renderEngines.length = 0;
    animationFrames.length = 0;
    const loading = createDeferred();
    const failure = new Error("initialization failed");
    const errors = [];
    t.mock.method(console, "error", (...args) => errors.push(args));
    const Component = await createComponentClassFromJsDefinition("await-load-failure.js", createContext(), {
        meta: { id: "x-await-load-failure-test", awaitLoad: true },
        controller() { return { load() { return loading.promise; } }; }
    }, {});
    const component = new Component();
    component.connectedCallback();

    loading.reject(failure);
    await loading.promise.catch(() => {});
    await Promise.resolve();
    component.connectedCallback();
    flushAnimationFrames();

    assert.equal(renderEngines.length, 0);
    assert.equal(errors.length, 1);
    assert.match(errors[0][0], /Failed to load Component 'x-await-load-failure-test'/);
    assert.equal(errors[0][1], failure);
    await assert.doesNotReject(component.unload());
});

test("x-layout-main applies a saved collapsed preference before its first Component render", async () => {
    configureDefinitionLoaders();
    renderEngines.length = 0;
    animationFrames.length = 0;
    const menuPreference = createDeferred();
    const preferences = {
        get(key) {
            if (key === "x-layout-main.menuCollapsed") return menuPreference.promise;
            if (key === "x-layout-main.dockPosition") return Promise.resolve("bottom");
            return Promise.resolve("");
        },
        set() {},
        delete() {}
    };
    definitionServices.services.register("events", { on() {} });
    definitionServices.services.register("areas", { getMenu() { return null; } });
    definitionServices.services.register("bus", {});
    definitionServices.services.register("preferences", preferences);
    const Component = await createComponentClassFromJsDefinition("x-layout-main-await-load.js", createContext(), {
        ...mainLayoutDefinition,
        meta: { ...mainLayoutDefinition.meta, id: "x-layout-main-await-load-test" },
        state: { ...mainLayoutDefinition.state },
        controller(services) {
            const controller = mainLayoutDefinition.controller(services);
            return { ...controller, mount() {} };
        }
    }, {});
    const component = new Component();

    component.connectedCallback();
    assert.equal(renderEngines.length, 0);
    menuPreference.resolve(true);
    await menuPreference.promise;
    await new Promise(resolve => setImmediate(resolve));
    flushAnimationFrames();

    assert.equal(mainLayoutDefinition.meta.awaitLoad, true);
    assert.equal(renderEngines.length, 1);
    assert.equal(renderEngines[0].renderCount, 1);
    assert.equal(renderEngines[0].lastState.menuCollapsed, true);
    await component.unload();
});

test("component explicit unload while mounted unmounts before final cleanup", async () => {
    configureDefinitionLoaders();
    renderEngines.length = 0;
    animationFrames.length = 0;
    const commands = [];
    const Component = await createComponentClassFromJsDefinition("component-explicit-unload.js", createContext(), {
        meta: { id: "x-component-explicit-unload-test" },
        controller() {
            return {
                mount() { commands.push("mount"); },
                unmount() { commands.push("unmount"); },
                unload() { commands.push("unload"); }
            };
        }
    }, {});
    const component = new Component();
    component.connectedCallback();
    const renderEngine = component._renderEngine;

    await component.unload();
    component.disconnectedCallback();
    await component.unload();

    assert.deepEqual(commands, ["mount", "unmount", "unload"]);
    assert.equal(renderEngine.unmountCount, 1);
    assert.equal(component._renderEngine, null);
});

test("temporary parent disconnection preserves the parent and unloads its discarded rendered child", async () => {
    configureDefinitionLoaders();
    const calls = [];
    const Parent = await createComponentClassFromJsDefinition("parent-disconnect.js", createContext(), {
        meta: { id: "x-parent-disconnect-test" },
        controller() { return { unmount() { calls.push("parent unmount"); }, unload() { calls.push("parent unload"); } }; }
    }, {});
    const Child = await createComponentClassFromJsDefinition("child-disconnect.js", createContext(), {
        meta: { id: "x-child-disconnect-test" },
        controller() { return { unmount() { calls.push("child unmount"); }, unload() { calls.push("child unload"); } }; }
    }, {});
    const parent = new Parent();
    const child = new Child();
    parent.connectedCallback();
    child.connectedCallback();
    parent.shadowRoot.appendChild(child);
    parent._renderEngine = new RenderEngineHtml({ host: parent.shadowRoot, template: { cloneNode() { return { content: new FakeNode() }; } }, state: {} });

    parent.disconnectedCallback();
    assert.deepEqual(calls, ["parent unmount", "child unmount", "child unload"]);
    assert.equal(parent._unloaded, false);
    assert.equal(child._unloaded, true);
    assert.equal(parent.shadowRoot.childNodes.length, 0);
    parent.connectedCallback();
    assert.equal(parent._unloaded, false);
    assert.ok(parent._renderEngine);
    await parent.unload();
    assert.equal(calls.at(-1), "parent unload");
});

test("Component final cleanup survives a throwing controller unmount", async () => {
    configureDefinitionLoaders();
    const calls = [];
    const failure = new Error("unmount failed");
    const Component = await createComponentClassFromJsDefinition("component-unmount-failure.js", createContext(), {
        meta: { id: "x-component-unmount-failure-test" }, state: { settings: {} },
        controller() { return { unmount() { calls.push("unmount"); throw failure; }, unload() { calls.push("unload"); } }; }
    }, {});
    const component = new Component();
    const observer = component._mutationObserver;
    const disposable = { count: 0, dispose() { this.count++; } };
    const servicesScope = component._servicesScope;
    servicesScope.addDisposable(disposable);
    component.connectedCallback();
    const renderEngine = component._renderEngine;

    await assert.rejects(component.unload(), error => error === failure);
    assert.deepEqual(calls, ["unmount", "unload"]);
    assert.equal(renderEngine.unmountCount, 1);
    assert.equal(component._renderEngine, null);
    assert.equal(observer.disconnectCount, 1);
    assert.equal(disposable.count, 1);
    await component.unload();
    assert.equal(disposable.count, 1);
});

test("Component final cleanup survives throwing and rejecting controller unload", async () => {
    configureDefinitionLoaders();
    for (const [name, unload] of [
        ["throw", () => { throw new Error("unload failed"); }],
        ["reject", async () => { throw new Error("unload rejected"); }]
    ]) {
        const Component = await createComponentClassFromJsDefinition(`component-unload-${name}.js`, createContext(), {
            meta: { id: `x-component-unload-${name}-test` }, state: { settings: {} },
            controller() { return { unload }; }
        }, {});
        const component = new Component();
        const observer = component._mutationObserver;
        const disposable = { count: 0, dispose() { this.count++; } };
        const servicesScope = component._servicesScope;
        servicesScope.addDisposable(disposable);
        component.connectedCallback();
        const renderEngine = component._renderEngine;

        await assert.rejects(component.unload(), /unload failed|unload rejected/);
        assert.equal(renderEngine.unmountCount, 1);
        assert.equal(component._renderEngine, null);
        assert.equal(observer.disconnectCount, 1);
        assert.equal(disposable.count, 1);
    }
});

test("page preserves state and disposables until its final unload", async () => {
    configureDefinitionLoaders();
    renderEngines.length = 0;
    animationFrames.length = 0;
    const commands = [];
    let controller;
    const PageClass = await createPageClassFromJsDefinition("page-lifecycle.js", createContext(), {
        meta: { id: "page-lifecycle-test" },
        state: { value: 1 },
        controller() {
            controller = {
                load() { commands.push("load"); },
                mount() { assert.equal(this, controller); commands.push("mount"); },
                unmount() { assert.equal(this, controller); commands.push("unmount"); },
                unload() { commands.push("unload"); }
            };
            return controller;
        }
    }, {});
    const page = new PageClass({ src: "/pages/lifecycle.js", context: {}, bus });
    const disposable = { disposeCount: 0, dispose() { this.disposeCount += 1; } };
    const servicesScope = page._servicesScope;
    servicesScope.addDisposable(disposable);
    const root = { adoptedStyleSheets: [] };
    const host = { nodeName: "X-PAGE", getAttribute() { return "/pages/lifecycle.js"; }, getRootNode() { return root; } };

    await page.load();
    await page.load();
    await page.mount({ host });
    const firstRenderEngine = page._renderEngine;
    page._state.value = 2;
    await page.unmount();

    assert.deepEqual(commands, ["load", "mount", "unmount"]);
    assert.equal(page._state.value, 2);
    assert.equal(page._renderEngine, null);
    assert.equal(disposable.disposeCount, 0);

    await page.mount({ host });
    const secondRenderEngine = page._renderEngine;
    assert.notEqual(secondRenderEngine, firstRenderEngine);
    await page.unmount();
    await page.unmount();
    assert.deepEqual(commands, ["load", "mount", "unmount", "mount", "unmount", "unmount"]);

    page.invalidate();
    assert.doesNotThrow(flushAnimationFrames);
    assert.equal(secondRenderEngine.renderCount, 0);

    await page.unload();
    await page.unload();
    assert.deepEqual(commands, ["load", "mount", "unmount", "mount", "unmount", "unmount", "unload"]);
    assert.equal(disposable.disposeCount, 1);
});

function createLoadableXPage(load, navigation = {}) {
    const config = { xshell: { ui: { layouts: { embed: "x-layout-test" }, components: { error: "x-test-error" } } } };
    const areas = { resolveAreaId() { return ""; }, getArea() { return null; }, getMenuitemBreadcrumb() { return []; } };
    const modules = { resolveModuleId() { return "test"; } };
    return createXPageClass({ config, loader: { load }, bus, navigation, areas, modules });
}

test("x-page unmounts then unloads a replaced page and only unmounts on disconnection", async () => {
    const commands = [];
    const oldPage = {
        src: "/pages/new.js",
        async mount() { commands.push("old mount"); },
        async unmount() { commands.push("old unmount"); },
        async unload() { commands.push("old unload"); }
    };
    class NewPage {
        label = "";
        icon = "";

        constructor() {}

        async load() { commands.push("new load"); }

        async mount() { commands.push("new mount"); }
    }
    const XPage = createLoadableXPage(async resource => resource.startsWith("page:") ? NewPage : class {});
    const xpage = new XPage();
    xpage._src = "/pages/new.js";
    xpage._page = oldPage;

    xpage.disconnectedCallback();
    await Promise.resolve();
    assert.deepEqual(commands, ["old unmount"]);

    commands.length = 0;
    xpage.connectedCallback();
    await Promise.resolve();
    assert.deepEqual(commands, ["old mount"]);

    commands.length = 0;
    xpage.connectedMoveCallback();
    assert.deepEqual(commands, []);
    assert.equal(xpage._connected, true);

    await xpage.load();
    assert.deepEqual(commands, ["new load", "old unmount", "old unload", "new mount"]);
});

test("x-page discards an older load without disturbing the newer active Page", async () => {
    const commands = [];
    let finishALoad;
    let markALoadStarted;
    const aLoadStarted = new Promise(resolve => { markALoadStarted = resolve; });
    const aLoadGate = new Promise(resolve => { finishALoad = resolve; });
    class PageA {
        label = "";
        icon = "";
        async load() { commands.push("A load"); markALoadStarted(); await aLoadGate; }
        async mount() { commands.push("A mount"); }
        async unmount() { commands.push("A unmount"); }
        async unload() { commands.push("A unload"); }
    }
    class PageB {
        label = "";
        icon = "";
        async load() { commands.push("B load"); }
        async mount() { commands.push("B mount"); }
        async unmount() { commands.push("B unmount"); }
        async unload() { commands.push("B unload"); }
    }
    const XPage = createLoadableXPage(async resource => resource === "page:/pages/a.js" ? PageA : PageB);
    const xpage = new XPage();
    xpage._src = "/pages/a.js";
    const loadA = xpage.load();
    await aLoadStarted;

    xpage._src = "/pages/b.js";
    await xpage.load();
    const activePage = xpage.page;
    assert.ok(activePage instanceof PageB);
    assert.deepEqual(commands, ["A load", "B load", "B mount"]);

    finishALoad();
    await loadA;
    assert.equal(xpage.page, activePage);
    assert.deepEqual(commands, ["A load", "B load", "B mount", "A unload"]);
});

test("dialog close completes after one final Page unload and host removal", async () => {
    const commands = [];
    let finishUnload;
    const unloadGate = new Promise(resolve => { finishUnload = resolve; });
    const container = new FakeNode();
    const navigation = new Navigation({
        areas: { resolvePath() { return null; } },
        bus: {},
        config: { app: { basePath: "", baseUrl: "https://example.test/" }, xshell: {} }
    }, { mode: "path" }, { container });
    const resultPromise = navigation.navigate({ href: "/pages/dialog.js", open: "dialog", context: {} });
    const xpage = container.firstChild;
    xpage._page = {
        async unmount() { commands.push("unmount"); },
        async unload() {
            commands.push("unload started");
            await unloadGate;
            commands.push("unload finished");
        }
    };
    let completed = false;
    resultPromise.then(() => { completed = true; });

    await xpage.close({ accepted: true });
    await Promise.resolve();
    assert.deepEqual(commands, ["unmount", "unload started"]);
    assert.equal(completed, false);
    assert.equal(container.firstChild, xpage);

    await xpage.close({ accepted: false });
    finishUnload();
    assert.deepEqual(await resultPromise, { accepted: true });
    assert.deepEqual(commands, ["unmount", "unload started", "unload finished"]);
    assert.equal(container.firstChild, null);
    assert.equal(xpage.page, null);
});

test("dialog close rejects its promise when final Page cleanup fails", async () => {
    const container = new FakeNode();
    const navigation = new Navigation({
        areas: { resolvePath() { return null; } },
        bus: {},
        config: { app: { basePath: "", baseUrl: "https://example.test/" }, xshell: {} }
    }, { mode: "path" }, { container });
    const resultPromise = navigation.navigate({ href: "/pages/dialog.js", open: "dialog", context: {} });
    const xpage = container.firstChild;
    const failure = new Error("unload failed");
    xpage._page = {
        async unmount() {},
        async unload() { throw failure; }
    };

    await xpage.close("done");
    await assert.rejects(resultPromise, error => error === failure);
});

test("navigation stack changes close dialogs through final Page cleanup", async t => {
    globalThis.history = { pushState() {} };
    t.after(() => { delete globalThis.history; });
    const commands = [];
    const container = new FakeNode();
    container.querySelectorAll = () => container.childNodes;
    const navigation = new Navigation({
        areas: { resolvePath() { return null; } },
        bus,
        config: { app: { basePath: "", baseUrl: "https://example.test/" }, xshell: {} }
    }, { mode: "path" }, { container });
    navigation.getXPages = () => [];
    const resultPromise = navigation.navigate({ href: "/pages/dialog.js", open: "dialog", context: {} });
    const xpage = container.firstChild;
    xpage._page = {
        async unmount() { commands.push("unmount"); },
        async unload() { commands.push("unload"); }
    };

    await navigation.navigate({ href: "/pages/main.js", open: "top", page: { host: null } });
    assert.equal(await resultPromise, null);
    assert.deepEqual(commands, ["unmount", "unload"]);
    assert.deepEqual(container.childNodes.map(host => host.getAttribute("src")), ["/pages/main.js"]);
});

test("navigation shrinks three stack Pages to one after asynchronous final unloads", async t => {
    globalThis.history = { pushState() {} };
    t.after(() => { delete globalThis.history; });
    const container = new FakeNode();
    container.querySelectorAll = () => container.childNodes;
    const navigation = new Navigation({
        areas: { resolvePath() { return null; } }, bus: { emit() {} },
        config: { app: { basePath: "", baseUrl: "https://example.test/" }, xshell: {} }
    }, { mode: "path" }, { container });
    const counts = [0, 0, 0];
    const gates = [];
    for (let i = 0; i < 3; i++) {
        const host = new XPage();
        host._src = `/pages/p${i}.js`;
        host._page = {
            async unmount() {},
            async unload() {
                counts[i]++;
                if (i > 0) await new Promise(resolve => gates.push(resolve));
            }
        };
        container.appendChild(host);
    }
    const [root, middle, top] = container.childNodes;
    const reconciliation = navigation.navigate({ href: root.src, open: "top", page: { host: root } });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(counts, [0, 1, 0]);
    gates.shift()();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(counts, [0, 1, 1]);
    gates.shift()();
    await reconciliation;
    assert.deepEqual(counts, [0, 1, 1]);
    assert.deepEqual(container.childNodes, [root]);
    assert.equal(middle.removed, true);
    assert.equal(top.removed, true);
    assert.equal(root.removed, undefined);
});

test("x-page loads URLs containing error through the normal Page loader", async () => {
    const loaded = [];
    const XPage = createLoadableXPage(async resource => {
        if (resource.startsWith("page:")) {
            loaded.push(resource);
            return class { async load() {} async mount() {} };
        }
        return class {};
    });
    for (const src of ["/pages/error-report.js", "/pages/errors/index.js", "/pages/orders.js?status=error"]) {
        const host = new XPage();
        host._src = src;
        await host.load();
    }
    assert.deepEqual(loaded, ["page:/pages/error-report.js", "page:/pages/errors/index.js", "page:/pages/orders.js?status=error"]);
});

test("x-page renders a failed Page through the configured error Component", async t => {
    const resources = [];
    const emit = t.mock.method(bus, "emit");
    const navigation = { replacePageQuery: t.mock.fn(() => null) };
    const failure = Object.assign(new Error("Page unavailable"), { code: 404, details: "missing definition" });
    class ErrorComponent {}
    const XPage = createLoadableXPage(async resource => {
        resources.push(resource);
        if (resource === "page:/pages/missing.js") throw failure;
        if (resource === "component:x-test-error") return ErrorComponent;
        return class {};
    }, navigation);
    const host = new XPage();
    host.src = "/pages/missing.js";

    await host.load();

    assert.deepEqual(resources, ["layout:x-layout-test", "page:/pages/missing.js", "component:x-test-error"]);
    assert.equal(host.page.constructor, Page);
    assert.ok(emit.mock.calls.some(({arguments: [name, detail]}) => name === "xshell:page:load" && detail.id === host.page.id));
    host.page.replaceQuery({ retry: "true" });
    assert.deepEqual(navigation.replacePageQuery.mock.calls[0].arguments, [host.page, { retry: "true" }]);
    assert.ok(host.firstChild instanceof ErrorComponent);
    assert.deepEqual(
        { code: host.firstChild.code, message: host.firstChild.message, src: host.firstChild.src,
            moduleId: host.firstChild.moduleId, details: host.firstChild.details },
        { code: 404, message: "Page unavailable", src: "/pages/missing.js", moduleId: "test", details: "missing definition" }
    );
});

test("x-page and dialog preserve falsy results", async () => {
    const container = new FakeNode();
    const navigation = new Navigation({
        areas: { resolvePath() { return null; } }, bus: {},
        config: { app: { basePath: "", baseUrl: "https://example.test/" }, xshell: {} }
    }, { mode: "path" }, { container });
    for (const value of [false, 0, "", null]) {
        const resultPromise = navigation.navigate({ href: "/pages/dialog.js", open: "dialog", context: {} });
        const host = container.firstChild;
        assert.equal(host.result, null);
        host._page = { async unmount() {}, async unload() {} };
        await host.close(value);
        assert.equal(await resultPromise, value);
    }
});

function validateComponentContract(contract) {
    const schema = { ...ComponentSchema, $defs: { [ContractSchema.$id]: ContractSchema } };
    return new Validator(schema, "2020-12").validate({ contract });
}

test("Component schema accepts boolean awaitLoad and rejects other values", () => {
    const schema = { ...ComponentSchema, $defs: { [ContractSchema.$id]: ContractSchema } };
    const validator = new Validator(schema, "2020-12");
    for (const awaitLoad of [true, false]) {
        assert.equal(validator.validate({ meta: { id: "x-await-load-schema", awaitLoad } }).valid, true);
    }
    for (const awaitLoad of ["true", 1, null, {}]) {
        assert.equal(validator.validate({ meta: { id: "x-await-load-schema", awaitLoad } }).valid, false);
    }
});

test("Component contract accepts boolean attribute observation and rejects string aliases", () => {
    for (const attribute of [true, false]) {
        assert.equal(validateComponentContract({ properties: { item: { type: "string", attribute } } }).valid, true);
    }
    assert.equal(validateComponentContract({ properties: { item: { type: "string", attribute: "item-name" } } }).valid, false);
});

test("Component contract accepts the JSON attribute parser and rejects unknown parsers", () => {
    assert.equal(validateComponentContract({ properties: { item: { type: "any", attribute: true, attributeParser: "json" } } }).valid, true);
    assert.equal(validateComponentContract({ properties: { item: { type: "any", attribute: true, attributeParser: "custom" } } }).valid, false);
});

test("Component value descriptors keep type required and accept optional JSON Schema", () => {
    const contracts = {
        property: descriptor => ({ properties: { value: descriptor } }),
        eventDetailProperty: descriptor => ({ events: { changed: { detail: { value: descriptor } } } }),
        methodParameter: descriptor => ({ methods: { update: { parameters: [{ name: "value", ...descriptor }] } } }),
        returnValue: descriptor => ({ methods: { update: { returns: descriptor } } })
    };
    const nestedSchema = {
        type: "object",
        properties: {
            items: { type: "array", items: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } }
        }
    };

    // check compact, structured, and boolean schemas on every value descriptor
    for (const [name, createContract] of Object.entries(contracts)) {
        for (const descriptor of [{ type: "string" }, { type: "object", schema: nestedSchema }, { type: "array", schema: { items: { type: "object", properties: { name: { type: "string" } } } } }, { type: "any", schema: true }, { type: "any", schema: false }]) {
            assert.equal(validateComponentContract(createContract(descriptor)).valid, true, `${name}: ${JSON.stringify(descriptor)}`);
        }
        for (const descriptor of [{ schema: true }, { type: "string", schema: null }, { type: "string", schema: [] }, { type: "string", schema: "object" }, { type: "string", schema: 123 }, { type: "object", properties: {} }, { type: "array", items: {} }]) {
            assert.equal(validateComponentContract(createContract(descriptor)).valid, false, `${name}: ${JSON.stringify(descriptor)}`);
        }
    }

    // keep void exclusive to method returns
    for (const [name, createContract] of Object.entries(contracts)) {
        assert.equal(validateComponentContract(createContract({ type: "void" })).valid, name === "returnValue", name);
    }

    // preserve component-specific metadata outside the optional schema
    assert.equal(validateComponentContract({ properties: { value: {
        type: "object", description: "Value", default: {}, state: true, reflect: true,
        required: true, readonly: false, enum: ["one"], attribute: false, schema: { type: "object" }
    } } }).valid, true);
});

test("Component public-method diagnostic uses its canonical name", async () => {
    configureDefinitionLoaders();
    const Component = await createComponentClassFromJsDefinition("missing-method.js", createContext(), {
        meta: { id: "x-missing-method" }, controller() { return {}; },
        contract: { methods: { submit: { description: "Submit" } } }
    });
    assert.throws(() => new Component(), /Component 'x-missing-method'.*public method 'submit'/);
});

test("dialog.language forwards value to a radios picker", async () => {
    const dialog = new Dialog({ navigation: {}, i18n: { config: { langs: [
        { id: "en", label: "English" }, { id: "es", label: "Spanish" }
    ] } } }, {});
    let options;
    dialog.picker = async value => { options = value; return "es"; };
    assert.equal(await dialog.language({ value: "es", current: ["en"] }), "es");
    assert.deepEqual(options, { title: "Select language", message: "Language", value: "es", inputType: "radios",
        domain: [{ value: "es", label: "Spanish (es)" }], required: true });
});

test("picker Page contract includes radios", () => {
    assert.deepEqual(pickerDefinition.contract.properties.inputType.enum, ["select", "radios"]);
});
