import assert from "node:assert/strict";
import test from "node:test";

import datafieldDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-datafield.js";
import formDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-form.js";
import schemaDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-schema.js";
import invokeDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/invoke.js";

globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.CustomEvent = class {
    constructor(type, options = {}) {
        this.type = type;
        Object.assign(this, options);
    }
};

function validator(errors) {
    return {
        calls: 0,
        validate(detail) {
            this.calls++;
            assert.equal(detail, true);
            return errors;
        }
    };
}

function createForm({ fields = [], assertions = [], wizard = false, current = [] } = {}) {
    const listeners = new Map();
    const dispatched = [];
    const panel = { querySelectorAll: selector => selector === "x-datafield, x-form-assert" ? current : [] };
    const host = {
        dataset: { recordId: "42" },
        shadowRoot: {
            adoptedStyleSheets: [],
            addEventListener(name, listener) { listeners.set(name, listener); }
        },
        querySelector(selector) { return selector.startsWith(":scope > *:nth-child(") ? panel : null; },
        querySelectorAll(selector) {
            if (selector === "x-datafield, x-form-assert") return [...fields, ...assertions];
            if (selector === ":scope > *[label]") return [];
            return [];
        },
        dispatchEvent(event) { dispatched.push(event); return true; }
    };
    const state = {
        wizard, wizardDirection: "", wizardIndex: 0,
        wizardPanels: wizard ? [{ index: 1 }] : [],
        validated: false, command: "submit", errors: [], loading: false,
        loadingLabel: "Working", loadingMessage: "Please wait..."
    };
    const controller = formDefinition.controller({ state, host });
    return {
        controller, dispatched, state,
        emit(name, event = {}) { listeners.get(name)?.(event); }
    };
}

test("x-form aggregates data-field and assertion errors", () => {
    const field = validator([{ type: "error", label: "Name", message: "Required" }]);
    const passingAssertion = validator([]);
    const failingAssertion = validator([{ type: "error", label: "Range", path: "", message: "Invalid range" }]);
    const form = createForm({ fields: [field], assertions: [passingAssertion, failingAssertion] });

    assert.deepEqual(form.controller.validate(), [
        { type: "error", label: "Name", message: "Required" },
        { type: "error", label: "Range", path: "", message: "Invalid range" }
    ]);
    assert.equal(form.state.validated, true);
    assert.equal(field.calls, 1);
    assert.equal(passingAssertion.calls, 1);
    assert.equal(failingAssertion.calls, 1);
});

test("x-form revalidates on assert changes only after its first validation", () => {
    const assertion = validator([]);
    const form = createForm({ assertions: [assertion] });
    form.controller.load();
    form.emit("assert:change");
    assert.equal(assertion.calls, 0);
    form.controller.validate();
    form.emit("assert:change");
    assert.equal(assertion.calls, 2);
});

test("x-form wizard validation includes only the current panel assertions", () => {
    const currentField = validator([]);
    const currentAssertion = validator([{ type: "error", label: "Current", message: "Failed" }]);
    const otherAssertion = validator([{ type: "error", label: "Other", message: "Must be ignored" }]);
    const form = createForm({ assertions: [otherAssertion], wizard: true, current: [currentField, currentAssertion] });

    assert.deepEqual(form.controller.validate(), [{ type: "error", label: "Current", message: "Failed" }]);
    assert.equal(currentField.calls, 1);
    assert.equal(currentAssertion.calls, 1);
    assert.equal(otherAssertion.calls, 0);
});

test("x-form submission is blocked by a failed assertion and proceeds when valid", () => {
    const assertion = validator([{ type: "error", label: "Rule", message: "Failed" }]);
    const form = createForm({ assertions: [assertion] });
    form.controller.submit();
    assert.deepEqual(form.dispatched, []);

    assertion.validate = function(detail) {
        this.calls++;
        assert.equal(detail, true);
        return [];
    };
    form.controller.submit();
    assert.equal(form.dispatched.length, 1);
    assert.equal(form.dispatched[0].type, "command");
    assert.deepEqual(form.dispatched[0].detail, { command: "submit", data: { recordId: "42" } });
    assert.equal(form.dispatched[0].bubbles, true);
    assert.equal(form.dispatched[0].composed, true);
});

test("x-datafield required validation remains field-specific", () => {
    const state = { type: "text", value: "", required: true, errors: [], validated: false };
    const controller = datafieldDefinition.controller({ state, host: { label: "Name" } });
    assert.deepEqual(controller.validate(), [{ type: "error", label: "Name", message: "Required" }]);
    assert.equal(state.validated, true);
});

test("x-datafield x-template validation preserves and prefixes nested paths", () => {
    const nestedError = { type: "error", label: "City", path: "Address", message: "Required" };
    const template = validator([nestedError]);
    const form = { localName: "x-form", parentNode: null };
    const section = { localName: "x-datafields", label: "Profile", parentNode: form };
    const host = {
        label: "Customer",
        parentNode: section,
        shadowRoot: { querySelector: selector => selector === "x-template" ? template : null }
    };
    const state = { type: "x-template", value: {}, errors: [], validated: false };
    const controller = datafieldDefinition.controller({ state, host });

    assert.deepEqual(controller.validate(true), [{
        type: "error", label: "City", path: "Profile / Customer / Address", message: "Required"
    }]);
    assert.equal(template.calls, 1);
});

test("x-datafield delegates only the exact x-template type", () => {
    const template = validator([{ type: "error", label: "Nested", message: "Failed" }]);
    const host = {
        label: "Other",
        shadowRoot: { querySelector: selector => selector === "x-template" ? template : null }
    };
    const state = { type: "custom-x-template", value: {}, errors: [], validated: false };
    const controller = datafieldDefinition.controller({ state, host });

    assert.deepEqual(controller.validate(true), []);
    assert.equal(template.calls, 0);
});

test("x-schema renders write-only strings as password fields", async () => {
    const state = {
        schema: { type: "object", properties: { secret: { type: "string", writeOnly: true } }, required: [] },
        src: "", value: {}, generated: "", error: ""
    };
    const controller = schemaDefinition.controller({
        state,
        events: { on() {} },
        host: { shadowRoot: { querySelector() { return null; } }, dispatchEvent() {} },
        loader: { load() { throw new Error("Unexpected load"); } }
    });

    await controller.refresh();

    assert.match(state.generated, /type="password"/);
});

function createInvoke(contract, initialArgs = {}, editorErrors = [], options = {}) {
    const calls = [];
    const closed = [];
    class Command {
        static contract = contract;
        execute(...args) {
            calls.push(args);
            return options.execute ? options.execute(...args) : "done";
        }
    }
    const editor = { validate: detail => {
        assert.equal(detail, true);
        return editorErrors;
    } };
    const page = {
        host: { layout: options.layout || "page", querySelector: selector => selector === 'x-schema[ref="arguments"]' ? editor : null },
        close(value) { closed.push(value); }
    };
    const state = { ...structuredClone(invokeDefinition.state), type: "command", id: "test", method: "execute", args: initialArgs };
    const controller = invokeDefinition.controller({ state, page, loader: { load: async () => Command } });
    return { calls, closed, controller, page, state };
}

test("invoke converts command parameters to x-schema and applies defaults", async () => {
    const invoke = createInvoke({
        label: "Example",
        types: { count: { type: "integer", description: "Number of retries", schema: { minimum: 1, maximum: 5 } } },
        execute: { parameters: [
            { name: "src", label: "Filesystem", type: "string", required: true, schema: { minLength: 2 } },
            { name: "count", ref: "count", default: 3 },
            { name: "password", type: "string", description: "Secret", required: true },
            { name: "mode", type: "string", enum: ["safe", "fast"], default: "safe" }
        ] }
    }, { src: "local", password: "secret" });

    await invoke.controller.load();

    assert.deepEqual(invoke.state.schema, {
        type: "object",
        properties: {
            src: { type: "string", minLength: 2, title: "Filesystem" },
            count: { minimum: 1, maximum: 5, type: "integer", description: "Number of retries", default: 3 },
            password: { type: "string", description: "Secret", writeOnly: true },
            mode: { type: "string", default: "safe", enum: ["safe", "fast"] }
        },
        required: ["src", "password"]
    });
    assert.deepEqual(invoke.state.args, { count: 3, mode: "safe", src: "local", password: "secret" });
    assert.equal(invoke.state.ready, true);
});

test("invoke validates x-schema before executing and preserves positional arguments", async () => {
    const errors = [{ label: "Name", message: "Required" }];
    const invoke = createInvoke({ execute: { parameters: [
        { name: "name", type: "string", required: true },
        { name: "count", type: "integer" },
        { name: "note", type: "string" }
    ] } }, { name: "Ada", count: 2 }, errors);
    await invoke.controller.load();

    await invoke.controller.submit();
    assert.deepEqual(invoke.calls, []);
    assert.equal(invoke.state.error, "Name: Required");

    errors.length = 0;
    await invoke.controller.submit();
    assert.deepEqual(invoke.calls, [["Ada", 2, undefined]]);
    assert.equal(invoke.state.completed, true);
    assert.equal(invoke.state.resultText, '"done"');
});

test("invoke rejects unsupported and incompatible parameter schemas clearly", async () => {
    const unsupportedType = createInvoke({ execute: { parameters: [{ name: "options", type: "object" }] } });
    await unsupportedType.controller.load();
    assert.match(unsupportedType.state.error, /unsupported type 'object'/);
    assert.equal(unsupportedType.state.ready, false);

    const unsupportedConstraint = createInvoke({ execute: { parameters: [
        { name: "name", type: "string", schema: { minItems: 1 } }
    ] } });
    await unsupportedConstraint.controller.load();
    assert.match(unsupportedConstraint.state.error, /unsupported schema keyword 'minItems'/);

    const unknownType = createInvoke({ types: {}, execute: { parameters: [{ name: "value", ref: "missing" }] } });
    await unknownType.controller.load();
    assert.match(unknownType.state.error, /Unknown parameter type 'missing'/);
});

test("invoke displays execution errors and closes dialogs with successful results", async () => {
    const failing = createInvoke({ execute: { parameters: [] } }, {}, [], {
        execute() { throw new Error("Command failed"); }
    });
    await failing.controller.load();
    await failing.controller.submit();
    assert.equal(failing.state.error, "Command failed");
    assert.equal(failing.state.running, false);

    const dialog = createInvoke({ execute: { parameters: [] } }, {}, [], { layout: "dialog" });
    await dialog.controller.load();
    dialog.controller.mount();
    await dialog.controller.submit();
    assert.deepEqual(dialog.closed, ["done"]);
    assert.equal(dialog.state.completed, false);
});
