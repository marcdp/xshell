import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import MenuShortcuts from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/menu-shortcuts.js";
import menuShortcutsContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/menu-shortcuts.json" with { type: "json" };

const framework = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/", import.meta.url);

test("XShell init registers the native x-page and Loader returns the registered class", async t => {
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
        },
        get(name) { return definitions.get(name); }
    };
    globalThis.window = { document: new EventTarget(), customElements };
    const { default: XShell } = await import(rootUrl);
    assert.equal(typeof XShell, "function");
    const xshell = new XShell();
    t.after(() => {
        xshell._bus?._channel.port1.close();
        xshell._bus?._channel.port2.close();
    });
    assert.equal(customElements.get("x-page"), undefined);

    // Register test implementations at the Services boundary for the production initialization path.
    const sharedSheet = new CSSStyleSheet();
    const startup = [];
    const initShortcuts = MenuShortcuts.prototype.init;
    t.mock.method(MenuShortcuts.prototype, "init", function () {
        startup.push("shortcuts");
        return initShortcuts.call(this);
    });
    t.mock.method(xshell, "validateConfig", async () => {});
    t.mock.method(Services.prototype, "init", async function () {
        this.register("areas", { init() {}, getCurrentArea: () => null, getMenus: () => [] });
        this.register("navigation", { init() { startup.push("navigation"); } });
        // Construct the real service through the runtime's options and contract validation.
        this.register("menuShortcuts", null, {
            implementationItem: { class: MenuShortcuts },
            contractItem: { contract: menuShortcutsContract }
        });
        this.register("modules", { init() {}, shadowStyleSheets: [sharedSheet] });
        assert.equal(customElements.get("x-page"), undefined);
    });
    const manifestSource = await readFile(new URL("manifest.jsonc", framework), "utf8");
    const { xshell: { resolver } } = JSON.parse(manifestSource.replace(/^\s*\/\/[^\r\n]*/gm, ""));
    await xshell.init({
        app: { basePath: "", baseUrl: framework.href },
        modules: {},
        xshell: { assets: { path: framework.href.slice(0, -1) }, resolver, ui: { components: {} } }
    }, {});

    const XPage = definitions.get("x-page");
    assert.ok(XPage.prototype instanceof HTMLElement);
    assert.equal(customElements.get("x-page"), XPage);
    const [shared, local] = new XPage().shadowRoot.adoptedStyleSheets;
    assert.equal(shared, sharedSheet);
    assert.equal(local, localSheet);

    // Resolve the manifest entry without loading the factory as a Component definition.
    assert.equal(await xshell._loader.load("component:x-page"), XPage);
    assert.deepEqual(xshell._loader.registry, []);
    assert.deepEqual(startup, ["navigation", "shortcuts"]);
    assert.equal(getEventListeners(window.document, "keydown").length, 1);
    await xshell._services.dispose();
    assert.equal(getEventListeners(window.document, "keydown").length, 0);
});
