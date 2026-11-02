import assert from "node:assert/strict";
import test from "node:test";

import createProxyStateEngineFactory from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/state-engines/proxy.js";

function createState(skeleton, changeDetection = {}) {
    const notifications = [];
    const state = new createProxyStateEngineFactory(skeleton, {}, { changeDetection }).create({
        stateChange(prop, oldValue, newValue) { notifications.push({ type: "stateChange", prop, oldValue, newValue }); },
        invalidate(prop) { notifications.push({ type: "invalidate", prop }); }
    });
    const events = [];
    state.addEventListener("change:value", event => events.push(event));
    return { state, notifications, events };
}

test("properties without structural detection retain identity behavior", () => {
    for (const changeDetection of [{}, { value: "identity" }]) {
        const value = { nested: { count: 1 } };
        const { state, notifications, events } = createState({ value }, changeDetection);

        state.value.nested.count = 2;
        state.value = state.value;

        assert.equal(events.length, 0);
        assert.equal(notifications.length, 0);
    }
});

test("structural detection reports same-reference mutations with the previous snapshot", () => {
    const { state, notifications, events } = createState({ value: { nested: { count: 1 } } }, { value: "structural" });
    const value = state.value;

    value.nested.count = 2;
    state.value = value;

    assert.deepEqual(events, [{ prop: "value", oldValue: { nested: { count: 1 } }, newValue: value }]);
    assert.deepEqual(notifications, [
        { type: "stateChange", prop: "value", oldValue: { nested: { count: 1 } }, newValue: value },
        { type: "invalidate", prop: "value" }
    ]);
    assert.notEqual(events[0].oldValue, value);
});

test("structural detection avoids notifications for unchanged contents and accepts the assigned reference", () => {
    const { state, notifications, events } = createState({ value: { count: 1 } }, { value: "structural" });
    const replacement = { count: 1 };

    state.value = replacement;

    assert.equal(state.value, replacement);
    assert.equal(events.length, 0);
    assert.equal(notifications.length, 0);
});

test("structurally different object assignments notify", () => {
    const { state, events } = createState({ value: { count: 1 } }, { value: "structural" });

    state.value = { count: 2 };

    assert.equal(events.length, 1);
    assert.deepEqual(events[0].oldValue, { count: 1 });
    assert.deepEqual(events[0].newValue, { count: 2 });
});

test("structural detection handles null and arrays", () => {
    const { state, events } = createState({ value: null }, { value: "structural" });

    state.value = null;
    state.value = [1, { count: 2 }];
    state.value[1].count = 3;
    state.value = state.value;
    state.value = [1, { count: 3 }];
    state.value = null;

    assert.equal(events.length, 3);
    assert.deepEqual(events.map(event => event.oldValue), [null, [1, { count: 2 }], [1, { count: 3 }]]);
});

test("structural snapshots are isolated between state instances", () => {
    const factory = new createProxyStateEngineFactory({ value: { count: 1 } }, {}, { changeDetection: { value: "structural" } });
    const firstEvents = [];
    const secondEvents = [];
    const first = factory.create({ stateChange() {}, invalidate() {} });
    const second = factory.create({ stateChange() {}, invalidate() {} });
    first.addEventListener("change:value", event => firstEvents.push(event));
    second.addEventListener("change:value", event => secondEvents.push(event));

    first.value.count = 2;
    first.value = first.value;
    second.value = second.value;

    assert.equal(firstEvents.length, 1);
    assert.equal(secondEvents.length, 0);
    assert.deepEqual(second.value, { count: 1 });
});

test("x-json receives change:value after a modified same-reference value is reassigned", async () => {
    class FakeElement {
        attributes = [];
        attachShadow() {
            this.shadowRoot = { adoptedStyleSheets: [] };
            return this.shadowRoot;
        }
    }
    const registry = new Map();
    globalThis.HTMLElement = FakeElement;
    globalThis.CSSStyleSheet = class { replaceSync() {} };
    globalThis.MutationObserver = class { observe() {} };
    globalThis.window = {
        location: { origin: "https://example.test" },
        customElements: {
            get(name) { return registry.get(name); },
            define(name, type) { registry.set(name, type); }
        }
    };
    globalThis.customElements = globalThis.window.customElements;

    const { createComponentClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/component-js.js");
    const { default: xshell } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/xshell.js");
    const { default: xJsonDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-json.js");
    const { default: filesystemEditDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/pages/edit.js");
    let receivedOptions;
    class StateEngineFactory {
        constructor(stateSkeleton, context, options) {
            receivedOptions = options;
            return new createProxyStateEngineFactory(stateSkeleton, context, options);
        }
    }
    class RenderEngineFactory {
        dependencies = [];
        slots = [];
        init() {}
    }
    xshell._config = { modules: { test: { defaults: { component: { stateEngine: "proxy", renderEngine: "test" } } } } };
    xshell._loader = {
        async load(resource) {
            if (resource === "schema:component") return {};
            return resource.startsWith("state-engine:") ? StateEngineFactory : RenderEngineFactory;
        }
    };
    xshell._services = { resolve() { return null; } };
    xshell._modules = { getModuleById() { return {}; } };

    const Component = await createComponentClassFromJsDefinition("https://example.test/x-json.js", {
        resourceDefinition: { moduleId: "test" }
    }, { ...xJsonDefinition, meta: { id: "x-json-structural-test" } });
    const xJson = new Component();
    const events = [];
    xJson._state.addEventListener("change:value", event => events.push(event));
    xJson.value = { value: "Initial" };
    events.length = 0;

    const value = xJson.value;
    value.value = "Updated";
    xJson.value = value;

    assert.deepEqual(receivedOptions, { changeDetection: { value: "structural" } });
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].oldValue, { value: "Initial" });
    assert.equal(events[0].newValue, value);
    assert.match(xJson._state.jsonColorized, /Updated/);
    assert.match(filesystemEditDefinition.template, /<x-json x-prop:value="state\.value"><\/x-json>/);
});
