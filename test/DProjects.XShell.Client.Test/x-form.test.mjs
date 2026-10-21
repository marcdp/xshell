import assert from "node:assert/strict";
import test from "node:test";

import datafieldDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-datafield.js";
import formDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-form.js";

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
