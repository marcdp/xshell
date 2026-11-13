import assert from "node:assert/strict";
import test from "node:test";

const animationFrames = [];
const renderEngines = [];

class FakeElement {
    attributes = [];

    attachShadow() {
        this.shadowRoot = { adoptedStyleSheets: [] };
        return this.shadowRoot;
    }

    getAttribute(name) {
        return this.attributes.find(attribute => attribute.name === name)?.value ?? null;
    }
}

globalThis.HTMLElement = FakeElement;
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.customElements = {
    definitions: new Map(),
    define(name, definition) { this.definitions.set(name, definition); },
    get(name) { return this.definitions.get(name); }
};
globalThis.window = { customElements: globalThis.customElements };
globalThis.document = { baseURI: "https://example.test/" };
globalThis.requestAnimationFrame = callback => {
    animationFrames.push(callback);
    return animationFrames.length;
};

const { createComponentClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/component-js.js");
const { createPageClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/page-js.js");
const { default: xshell } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/xshell.js");

class StateEngineFactory {
    constructor(state) { this.state = state; }
    create() { return { ...this.state }; }
}

class RenderEngineFactory {
    dependencies = [];
    slots = [];

    init() {}

    create() {
        const renderEngine = {
            renderCount: 0,
            mount() {},
            unmount() {},
            render() { this.renderCount += 1; }
        };
        renderEngines.push(renderEngine);
        return renderEngine;
    }
}

function configureRuntime(commandsService) {
    xshell._config = {
        modules: {
            test: {
                defaults: {
                    component: { stateEngine: "test", renderEngine: "test" },
                    page: { stateEngine: "test", renderEngine: "test" }
                }
            }
        }
    };
    xshell._loader = {
        async load(resource) {
            if (resource === "schema:component" || resource === "schema:page") return {};
            return resource.startsWith("state-engine:") ? StateEngineFactory : RenderEngineFactory;
        }
    };
    xshell._services = { resolve(name) { return name === "commands" ? commandsService : null; } };
    xshell._modules = { getModuleById() { return { controller: {} }; } };
    xshell._bus = { emit() {} };
}

function createContext() {
    return { resourceDefinition: { moduleId: "test" } };
}

function flushAnimationFrames() {
    const callbacks = animationFrames.splice(0);
    for (const callback of callbacks) callback();
}

function assertPostRenderCalls(calls, controller) {
    assert.deepEqual(calls.map(([name, args, , renderCount]) => [name, args, renderCount]), [
        ["first", [1, { value: "one" }], 1],
        ["second", ["two", 3], 1]
    ]);
    assert.ok(calls.every(([, , receiver]) => receiver === controller));
}

test("Component postRender runs queued controller methods after rendering in FIFO order", async () => {
    animationFrames.length = 0;
    renderEngines.length = 0;
    const commandsService = { id: "component-commands-service" };
    configureRuntime(commandsService);
    const calls = [];
    let controller;
    let queue;
    let injectedCommands;
    const Component = await createComponentClassFromJsDefinition("post-render-component.js", createContext(), {
        meta: { id: "x-post-render-component-test" },
        controller({ postRender, commands }) {
            queue = postRender;
            injectedCommands = commands;
            controller = {
                first(...args) { calls.push(["first", args, this, renderEngines[0].renderCount]); },
                second(...args) { calls.push(["second", args, this, renderEngines[0].renderCount]); }
            };
            return controller;
        }
    }, {});
    const component = new Component();

    assert.equal(typeof queue, "function");
    assert.equal(injectedCommands, commandsService);
    queue("first", 1, { value: "one" });
    queue("second", "two", 3);
    assert.equal(animationFrames.length, 0);
    assert.deepEqual(calls, []);

    component.connectedCallback();
    assert.equal(animationFrames.length, 1);
    assert.deepEqual(calls, []);
    flushAnimationFrames();

    assertPostRenderCalls(calls, controller);
});

test("Page postRender runs queued controller methods after rendering in FIFO order", async () => {
    animationFrames.length = 0;
    renderEngines.length = 0;
    const commandsService = { id: "page-commands-service" };
    configureRuntime(commandsService);
    const calls = [];
    let controller;
    let queue;
    let injectedCommands;
    const PageClass = await createPageClassFromJsDefinition("post-render-page.js", createContext(), {
        meta: { id: "post-render-page-test" },
        controller({ postRender, commands }) {
            queue = postRender;
            injectedCommands = commands;
            controller = {
                first(...args) { calls.push(["first", args, this, renderEngines[0].renderCount]); },
                second(...args) { calls.push(["second", args, this, renderEngines[0].renderCount]); }
            };
            return controller;
        }
    }, {});
    const page = new PageClass({ src: "/pages/post-render.js", context: {} });
    const root = { adoptedStyleSheets: [] };
    const host = { nodeName: "X-PAGE", getAttribute() { return "/pages/post-render.js"; }, getRootNode() { return root; } };

    assert.equal(typeof queue, "function");
    assert.equal(injectedCommands, commandsService);
    queue("first", 1, { value: "one" });
    queue("second", "two", 3);
    assert.equal(animationFrames.length, 0);
    assert.deepEqual(calls, []);

    await page.load();
    await page.mount({ host });
    assert.equal(animationFrames.length, 1);
    assert.deepEqual(calls, []);
    flushAnimationFrames();

    assertPostRenderCalls(calls, controller);
});
