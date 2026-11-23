import assert from "node:assert/strict";
import test from "node:test";

import templateDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-template.js";

function createTemplate({ elements = [], renderingError = "", editor = true } = {}) {
    const renderedEditor = editor ? {
        querySelectorAll(selector) {
            assert.equal(selector, "x-datafield, x-form-assert, x-schema");
            return elements;
        }
    } : null;
    const host = {
        shadowRoot: {
            querySelector(selector) {
                assert.equal(selector, ".editor");
                return renderedEditor;
            }
        }
    };
    const state = { renderingError };
    const controller = templateDefinition.controller({ state, host });
    return { controller, state };
}

test("x-template validates rendered data fields and assertions", () => {
    const calls = [];
    const field = {
        validate(detail) {
            calls.push(["field", detail]);
            return [{ type: "error", label: "City", path: "Address", message: "Required" }];
        }
    };
    const assertion = {
        validate(detail) {
            calls.push(["assertion", detail]);
            return [{ type: "error", label: "Rule", path: "", message: "Failed" }];
        }
    };
    const template = createTemplate({ elements: [field, assertion] });

    assert.deepEqual(template.controller.validate(true), [
        { type: "error", label: "City", path: "Address", message: "Required" },
        { type: "error", label: "Rule", path: "", message: "Failed" }
    ]);
    assert.deepEqual(calls, [["field", true], ["assertion", true]]);
});

test("x-template reports rendering failures as validation errors", () => {
    const template = createTemplate({ renderingError: "Unable to parse XTemplate.", editor: false });

    assert.deepEqual(template.controller.validate(), [{
        type: "error", label: "", message: "Unable to parse XTemplate."
    }]);
});

test("x-template recovers from invalid source and disposes each replaced renderer", async t => {
    globalThis.requestAnimationFrame = callback => callback();
    globalThis.document = { baseURI: "https://example.test/" };
    t.after(() => {
        delete globalThis.requestAnimationFrame;
        delete globalThis.document;
    });
    const editor = { replaceChildren: t.mock.fn() };
    const dispatched = [];
    const host = {
        shadowRoot: { querySelector: selector => selector === ".editor" ? editor : null },
        dispatchEvent(event) { dispatched.push(event); }
    };
    const state = { template: "<p>{{ state.name }}</p>", value: { name: "Ada" }, renderingError: "" };
    const listeners = new Map();
    const renderers = [];
    const loadedDependencies = [];
    const renderContexts = [];
    const navigation = { mode: "hash" };
    const renderEngineXClient = (source, context) => {
        renderContexts.push(context);
        if (source === "<invalid>") throw new Error("Unable to parse XTemplate.");
        return {
            dependencies: ["component:x-card"],
            async init() {},
            create(options) {
                const renderer = { options, mount: t.mock.fn(), render: t.mock.fn(), unmount: t.mock.fn() };
                renderers.push(renderer);
                return renderer;
            }
        };
    };
    const controller = templateDefinition.controller({
        state, host,
        events: { on(target, name, listener) { listeners.set(name, listener); } },
        dependencies: { renderEngineXClient },
        loader: { async load(resources) { loadedDependencies.push(resources); } },
        getPage: () => null,
        postRender() {},
        i18n: { id: "i18n" },
        navigation
    });
    controller.load();

    await controller.refresh();
    assert.equal(renderers.length, 1);
    assert.deepEqual(Object.keys(renderContexts[0]), ["resourceName", "resourcePath", "resourceDefinition", "appBasePath", "componentLazy", "i18n", "navigationMode"]);
    assert.equal(Object.hasOwn(renderContexts[0], "services"), false);
    assert.equal(Object.hasOwn(renderContexts[0], "navigation"), false);
    assert.equal(renderContexts[0].i18n.id, "i18n");
    assert.equal(renderContexts[0].navigationMode, "hash");
    navigation.mode = "path";
    assert.equal(renderContexts[0].navigationMode, "path");
    assert.deepEqual(loadedDependencies, [["component:x-card"]]);
    assert.equal(renderers[0].mount.mock.callCount(), 1);
    assert.equal(renderers[0].render.mock.callCount(), 1);

    renderers[0].options.handler("save", { event: { detail: { id: 7 } } });
    assert.equal(dispatched[0].type, "command");
    assert.deepEqual(dispatched[0].detail, { name: "save", detail: { id: 7 } });

    renderers[0].options.state.name = "Grace";
    renderers[0].options.invalidate();
    assert.equal(renderers[0].render.mock.callCount(), 2);
    assert.equal(dispatched[1].type, "change");
    assert.equal(dispatched[1].detail.newValue.name, "Grace");

    state.template = "<invalid>";
    await controller.refresh();
    assert.equal(renderers[0].unmount.mock.callCount(), 0);
    assert.equal(state.renderingError, "Unable to parse XTemplate.");

    state.template = "<p>Hello {{ state.name }}</p>";
    await controller.refresh();
    assert.equal(state.renderingError, "");
    assert.equal(renderers.length, 2);
    assert.equal(renderers[0].unmount.mock.callCount(), 1);
    assert.equal(renderers[1].mount.mock.callCount(), 1);

    controller.unmount();
    assert.equal(renderers[1].unmount.mock.callCount(), 1);
    assert.equal(dispatched.length, 2);
    assert.deepEqual([...listeners.keys()], ["change:value", "change:template"]);
});
