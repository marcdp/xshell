import assert from "node:assert/strict";
import test from "node:test";

import formDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-form.js";
import wizardDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-wizard.js";
import wizardHeaderDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-wizard-header.js";

globalThis.CustomEvent ??= class {
    constructor(type, options = {}) {
        this.type = type;
        Object.assign(this, options);
    }
};

test("x-wizard-header renders the panels property without rebuilding it from light DOM", () => {
    const panels = [{label: "Account", message: "Enter account details", icon: "user", index: 1}];
    const state = {index: 0, panels};
    const controller = wizardHeaderDefinition.controller({
        state,
        host: {
            querySelectorAll() {
                throw new Error("x-wizard-header must not query light-DOM panels");
            },
            dispatchEvent() {}
        }
    });

    assert.equal(wizardHeaderDefinition.contract.properties.panels.attribute, undefined);
    assert.equal(wizardHeaderDefinition.contract.properties.panels.state, true);
    assert.match(wizardHeaderDefinition.template, /x-for="panel in state\.panels"/);
    assert.deepEqual(state.panels, panels);
    assert.deepEqual(Object.keys(controller), ["click"]);
});

test("x-wizard and x-form pass panel metadata to x-wizard-header as properties", () => {
    assert.match(wizardDefinition.template,
        /<x-wizard-header\b[^>]*x-prop:panels="state\.panels"[^>]*><\/x-wizard-header>/);
    assert.doesNotMatch(wizardDefinition.template, /<div x-for="panel in state\.panels"/);

    assert.match(formDefinition.template,
        /<x-wizard-header\b[^>]*x-prop:panels="state\.wizardPanels"[^>]*><\/x-wizard-header>/);
    assert.doesNotMatch(formDefinition.template, /<div x-for="wizardPanel in state\.wizardPanels"/);
    assert.equal(formDefinition.contract.properties.wizardPanels.attribute, undefined);
});

test("x-wizard-header emits its navigation event only for an earlier step", () => {
    const events = [];
    const state = {index: 2, panels: []};
    const controller = wizardHeaderDefinition.controller({
        state,
        host: {dispatchEvent(event) { events.push(event); }}
    });

    controller.click({event: {currentTarget: {dataset: {index: "1"}}}});
    controller.click({event: {currentTarget: {dataset: {index: "2"}}}});
    controller.click({event: {currentTarget: {dataset: {index: "3"}}}});

    assert.equal(events.length, 1);
    assert.equal(events[0].type, "indexset");
    assert.deepEqual(events[0].detail, {index: 1});
    assert.equal(events[0].bubbles, false);
    assert.equal(events[0].composed, false);
});
