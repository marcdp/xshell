import test from "node:test";
import assert from "node:assert/strict";
import Code from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-code.js";

function createController({value = "", content = "", language = ""} = {}) {
    // Provide the Component state and services needed by the controller.
    const state = {value, language, normalize:true, wrap:false, copyable:true, contentValue:"", displayValue:"", highlighted:"", playable:false};
    const host = {textContent:content};
    const events = {on() {}};
    const opened = [];
    const services = {resolve(name) {
        assert.equal(name, "dialog");
        return {open(options) {opened.push(options);}};
    }};
    const controller = Code.controller({state, host, events, services});
    return {controller, state, opened};
}

test("x-code displays normalized inline source when value is empty", () => {
    // Capture source at mount time because light DOM children are attached after construction.
    const {controller, state} = createController({
        language:"html",
        content:`
            <p>{{ state.message }}</p>
        `
    });
    controller.load();
    controller.mount();

    assert.equal(state.displayValue, "<p>{{ state.message }}</p>");
    assert.match(state.highlighted, /token tag/);
    assert.match(state.highlighted, /\{\{ state\.message \}\}/);
    assert.equal(state.playable, true);
});

test("x-code value overrides inline source", () => {
    // Keep the explicit public property authoritative when both source forms are present.
    const {controller, state} = createController({value:"const value = 1;", content:"ignored", language:"javascript"});
    controller.load();
    controller.mount();

    assert.equal(state.displayValue, "const value = 1;");
    assert.match(state.highlighted, /token keyword/);
    assert.doesNotMatch(state.highlighted, /ignored/);
    assert.equal(state.playable, false);
});

test("x-code opens HTML source in the XTemplate playground", async () => {
    // Pass the normalized displayed source through the playground Page context.
    const {controller, opened} = createController({language:"HTML", content:"\n    <p>Preview</p>\n"});
    controller.load();
    controller.mount();
    await controller.play();

    assert.deepEqual(opened, [{
        href:"page:x:/pages/playground.js",
        context:{template:"<p>Preview</p>"}
    }]);
});
