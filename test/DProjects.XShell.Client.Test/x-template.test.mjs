import assert from "node:assert/strict";
import test from "node:test";

import templateDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-template.js";

function createTemplate({ elements = [], renderingError = "", editor = true } = {}) {
    const renderedEditor = editor ? {
        querySelectorAll(selector) {
            assert.equal(selector, "x-datafield, x-form-assert");
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
