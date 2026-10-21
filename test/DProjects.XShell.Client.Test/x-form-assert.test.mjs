import assert from "node:assert/strict";
import test from "node:test";

import assertionDefinition, { contract } from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-form-assert.js";

globalThis.CustomEvent = class {
    constructor(type, options = {}) {
        this.type = type;
        Object.assign(this, options);
    }
};

function createAssertion(overrides = {}) {
    const state = { test: true, label: "", path: "", message: "", validated: false, ...overrides };
    const dispatched = [];
    let testChange;
    const host = {
        textContent: "  Fallback validation message.  ",
        dispatchEvent(event) { dispatched.push(event); return true; }
    };
    const events = {
        on(target, name, listener) {
            assert.equal(target, state);
            assert.equal(name, "change:test");
            testChange = listener;
        }
    };
    const controller = assertionDefinition.controller({ events, state, host });
    controller.load();
    return { controller, dispatched, state, testChange: event => testChange(event) };
}

test("x-form-assert exposes its validation contract", () => {
    assert.equal(contract.description.length > 0, true);
    assert.deepEqual(contract.properties.test, {
        type: "boolean", default: true, attribute: true, state: true,
        description: "Condition that must evaluate to true for the assertion to pass."
    });
    assert.deepEqual(Object.fromEntries(["label", "path", "message"].map(name => [name, {
        type: contract.properties[name].type,
        default: contract.properties[name].default
    }])), {
        label: { type: "string", default: "" },
        path: { type: "string", default: "" },
        message: { type: "string", default: "" }
    });
    assert.ok(contract.methods.validate);
    assert.ok(contract.slots[""]);
    assert.deepEqual(contract.events["assert:change"].detail, {
        oldValue: { type: "boolean" },
        newValue: { type: "boolean" }
    });
});

test("x-form-assert passes when test is true and marks itself validated", () => {
    const assertion = createAssertion({ test: true });
    assert.equal(assertion.state.validated, false);
    assert.deepEqual(assertion.controller.validate(), []);
    assert.equal(assertion.state.validated, true);
});

test("x-form-assert returns one form-level error when test is false", () => {
    const assertion = createAssertion({ test: false, label: "Range", path: "Schedule", message: "End must not precede start." });
    assert.deepEqual(assertion.controller.validate(), [{
        type: "error", label: "Range", path: "Schedule", message: "End must not precede start."
    }]);
    assert.equal(assertion.state.validated, true);
});

test("x-form-assert prefers message and otherwise trims its fallback slot text", () => {
    const explicit = createAssertion({ test: false, message: "Explicit message." });
    const fallback = createAssertion({ test: false });
    assert.equal(explicit.controller.validate()[0].message, "Explicit message.");
    assert.equal(fallback.controller.validate()[0].message, "Fallback validation message.");
});

test("x-form-assert inline error follows validation and test state", () => {
    const assertion = createAssertion({ test: false });
    const inlineErrorVisible = () => assertion.state.validated && !assertion.state.test;
    assert.equal(inlineErrorVisible(), false);
    assertion.controller.validate();
    assert.equal(inlineErrorVisible(), true);
    assertion.state.test = true;
    assert.equal(inlineErrorVisible(), false);
    assert.match(assertionDefinition.template, /x-if="state\.validated && !state\.test"/);
    assert.match(assertionDefinition.template, /<span x-if="state\.message" x-text="state\.message"><\/span>\s*<slot x-else><\/slot>/);
});

test("x-form-assert emits one bubbling, non-composed change event for a semantic change", () => {
    const assertion = createAssertion();
    assertion.testChange({ oldValue: true, newValue: false });
    assertion.testChange({ oldValue: false, newValue: false });
    assert.equal(assertion.dispatched.length, 1);
    assert.equal(assertion.dispatched[0].type, "assert:change");
    assert.deepEqual(assertion.dispatched[0].detail, { oldValue: true, newValue: false });
    assert.equal(assertion.dispatched[0].bubbles, true);
    assert.equal(assertion.dispatched[0].composed, false);
});
