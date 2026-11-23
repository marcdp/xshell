import assert from "node:assert/strict";
import test from "node:test";

globalThis.HTMLElement = class {};
globalThis.CSSStyleSheet = class {
    replaceSync() {}
};
globalThis.customElements = {
    define() {},
    get() { return undefined; }
};
globalThis.window = {
    customElements: globalThis.customElements
};

const { createComponentClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/component-js.js");
const { createPageClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/page-js.js");
const loaders = [
    { name: "component", create: createComponentClassFromJsDefinition },
    { name: "page", create: createPageClassFromJsDefinition }
];
let capturedState = null;

class StateEngineFactory {
    constructor(state) {
        capturedState = state;
    }

    create() {
        return { ...capturedState };
    }
}

class RenderEngineFactory {
    dependencies = [];
    slots = [];

    init() {}
}

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
        return resource.startsWith("state-engine:") ? StateEngineFactory : RenderEngineFactory;
    }
};
const services = { config, loader, modules: { shadowStyleSheets: [] } };

function createDefinition(state) {
    return { meta: { id: "x-contract-state-test" }, state };
}

function createContract(property) {
    return { properties: { value: { type: "any", ...property } } };
}

function createContext() {
    return { resourceDefinition: { moduleId: "test" }, services };
}

async function loadDefinition(loader, state, property) {
    capturedState = null;
    await loader.create("test.js", createContext(), { ...createDefinition(state), contract: createContract(property) });
    return capturedState;
}

for (const loader of loaders) {
    test(`${loader.name}: uses null, boolean, number, and string contract defaults`, async () => {
        for (const defaultValue of [null, true, 12, "contract"]) {
            const state = await loadDefinition(loader, { value: defaultValue }, { state: true, default: defaultValue });

            assert.equal(state.value, defaultValue);
        }
    });

    test(`${loader.name}: accepts an equal state-backed primitive default and uses the contract default`, async () => {
        const contractDefault = "contract";
        const state = await loadDefinition(loader, { value: "contract" }, { state: true, default: contractDefault });

        assert.equal(state.value, contractDefault);
    });

    test(`${loader.name}: rejects a different state-backed primitive default`, async () => {
        await assert.rejects(() => loadDefinition(loader, { value: "definition" }, { state: true, default: "contract" }), /different defaults.*value/);
    });

    test(`${loader.name}: accepts equivalent state-backed array defaults`, async () => {
        const contractDefault = ["one", { two: 2 }];
        const state = await loadDefinition(loader, { value: ["one", { two: 2 }] }, { state: true, default: contractDefault });

        assert.equal(state.value, contractDefault);
    });

    test(`${loader.name}: rejects different state-backed array defaults`, async () => {
        await assert.rejects(() => loadDefinition(loader, { value: ["one", "three"] }, { state: true, default: ["one", "two"] }), /different defaults.*value/);
    });

    test(`${loader.name}: accepts equivalent state-backed object defaults`, async () => {
        const contractDefault = { enabled: true, nested: { count: 2 } };
        const state = await loadDefinition(loader, { value: { nested: { count: 2 }, enabled: true } }, { state: true, default: contractDefault });

        assert.equal(state.value, contractDefault);
    });

    test(`${loader.name}: rejects different state-backed object defaults`, async () => {
        await assert.rejects(() => loadDefinition(loader, { value: { enabled: false } }, { state: true, default: { enabled: true } }), /different defaults.*value/);
    });

    test(`${loader.name}: rejects a public property in definition state when it is not state-backed`, async () => {
        await assert.rejects(() => loadDefinition(loader, { value: "contract" }, { state: false, default: "contract" }), /not state-backed/);
    });

    test(`${loader.name}: accepts private state with no matching public property`, async () => {
        const state = await loadDefinition(loader, { privateValue: null }, { state: true, default: null });

        assert.deepEqual(state, { value: null, privateValue: null });
    });
}
