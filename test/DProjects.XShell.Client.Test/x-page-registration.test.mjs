import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";

const framework = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/", import.meta.url);

test("XShell registers the native x-page at import and Loader returns the registered class", async t => {
    const factoryUrl = new URL("x-page.js", framework).href;
    const rootUrl = new URL("xshell.js", framework).href;
    const hooks = registerHooks({
        resolve(specifier, context, nextResolve) {
            const result = nextResolve(specifier, context);
            if (context.parentURL === factoryUrl) assert.notEqual(result.url, rootUrl);
            return result;
        }
    });
    t.after(() => hooks.deregister());

    // Import the factory before the custom element registry exists.
    globalThis.HTMLElement = class extends EventTarget {
        attachShadow() { this.shadowRoot = { adoptedStyleSheets: [] }; }
    };
    globalThis.CSSStyleSheet = class { replaceSync() {} };
    const { createXPageClass } = await import(factoryUrl);
    const StandaloneXPage = createXPageClass({});
    const [localSheet] = new StandaloneXPage().shadowRoot.adoptedStyleSheets;
    assert.ok(localSheet instanceof CSSStyleSheet);

    // Capture the registered class and mimic the synchronous upgrade of an existing element.
    const definitions = new Map();
    globalThis.customElements = {
        define(name, implementation) {
            assert.equal(definitions.has(name), false);
            definitions.set(name, implementation);
            assert.deepEqual(new implementation().shadowRoot.adoptedStyleSheets, [localSheet]);
        },
        get(name) { return definitions.get(name); }
    };
    globalThis.window = { document: {}, customElements };
    const { default: xshell } = await import(rootUrl);
    t.after(() => {
        xshell.bus?._channel.port1.close();
        xshell.bus?._channel.port2.close();
    });
    const XPage = definitions.get("x-page");
    assert.ok(XPage.prototype instanceof HTMLElement);
    assert.equal(xshell.services, null);

    // Register test implementations at the Services boundary and construct a host before init returns.
    const sharedSheet = new CSSStyleSheet();
    t.mock.method(xshell, "validateConfig", async () => {});
    t.mock.method(Services.prototype, "init", async function () {
        this.register("areas", { init() {} });
        this.register("navigation", { init() {} });
        this.register("modules", { init() {}, shadowStyleSheets: [sharedSheet] });
        assert.deepEqual(new XPage().shadowRoot.adoptedStyleSheets, [localSheet]);
    });
    const manifestSource = await readFile(new URL("manifest.jsonc", framework), "utf8");
    const { xshell: { resolver } } = JSON.parse(manifestSource.replace(/^\s*\/\/[^\r\n]*/gm, ""));
    await xshell.init({
        app: { basePath: "", baseUrl: framework.href },
        modules: {},
        xshell: { assets: { path: framework.href.slice(0, -1) }, resolver, ui: { components: {} } }
    }, {});

    const [shared, local] = new XPage().shadowRoot.adoptedStyleSheets;
    assert.equal(shared, sharedSheet);
    assert.equal(local, localSheet);

    // Resolve the manifest entry without loading the factory as a Component definition.
    assert.equal(await xshell.loader.load("component:x-page"), XPage);
    assert.deepEqual(xshell.loader.registry, []);
});
