import assert from "node:assert/strict";
import test from "node:test";

import ConfigSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/config.schema.json" with { type: "json" };
import Dialog from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/dialog.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";

function createDialogServices(options) {
    // Configure the real lazy service lifecycle with runtime dependencies
    const navigation = { calls: [], async navigate(value) { this.calls.push(value); return value; } };
    const i18n = { config: { langs: [{ id: "en", label: "English" }, { id: "es", label: "Spanish" }] } };
    const services = new Services({
        config: {
            app: { baseUrl: "https://example.test/" },
            modules: {},
            xshell: {
                files: [{ path: "/services/dialog.js", size: 1 }],
                services: { dialog: { contract: "dialog", implementation: "/services/dialog.js", options } }
            }
        },
        loader: { async load() { return Dialog; } },
        contracts: { getContractItemById(id) { return { id, contract: { methods: {}, properties: {} } }; } },
        resolver: { resolve() { return { definition: { moduleId: "xshell" } }; } }
    });
    services.register("navigation", navigation);
    services.register("i18n", i18n);
    return { i18n, navigation, services };
}

test("Dialog options schema accepts optional page references and rejects invalid values", () => {
    // Validate defaults, partial options, invalid types, and unknown properties
    const validator = new JsonValidator();
    assert.equal(validator.validate({}, Dialog.optionsSchema).valid, true);
    assert.equal(validator.validate({ confirm: null, message: "/message.js", prompt: null, picker: "/picker.js" }, Dialog.optionsSchema).valid, true);
    assert.equal(validator.validate({ confirm: 1 }, Dialog.optionsSchema).valid, false);
    assert.equal(validator.validate({ unknown: null }, Dialog.optionsSchema).valid, false);
});

test("global UI configuration no longer accepts Dialog service options", () => {
    // Keep Dialog configuration out of the closed global UI schema
    assert.equal(ConfigSchema.$defs.xshellUi.additionalProperties, false);
    assert.equal(ConfigSchema.$defs.xshellUi.required.includes("dialog"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs.xshellUi.properties, "dialog"), false);
    assert.equal(Object.hasOwn(ConfigSchema.$defs, "xshellUiDialog"), false);
});

test("Dialog is resolved lazily once with injected navigation and i18n services", async () => {
    // Initialize registration without constructing the configured service
    const options = { confirm: "/confirm.js", message: "/message.js", prompt: "/prompt.js", picker: "/picker.js" };
    const { navigation, services } = createDialogServices(options);
    await services.init();
    assert.equal(services.getServiceInfo("dialog").state, "registered");

    // Resolve one singleton and exercise both injected dependencies
    const dialog = services.resolve("dialog");
    assert.strictEqual(services.resolve("dialog"), dialog);
    assert.equal(services.getServiceInfo("dialog").state, "created");
    assert.equal(await dialog.language({ current: ["en"] }), navigation.calls[0]);
    assert.equal(navigation.calls[0].href, "/picker.js");
    assert.deepEqual(navigation.calls[0].context.domain, [{ value: "es", label: "Spanish (es)" }]);
});

test("Dialog standard helpers use their configured page references", async () => {
    // Capture navigation requests from every standard helper
    const calls = [];
    const navigation = { async navigate(value) { calls.push(value); return calls.length; } };
    const dialog = new Dialog({ navigation, i18n: { config: { langs: [] } } }, {
        confirm: "/confirm.js", message: "/message.js", prompt: "/prompt.js", picker: "/picker.js"
    });

    assert.equal(await dialog.confirm({ title: "Confirm", message: "Continue?", variant: "yes-no" }), 1);
    assert.equal(await dialog.message({ type: "info", title: "Message", message: "Done" }), 2);
    assert.equal(await dialog.prompt({ title: "Prompt", message: "Name", value: "A", inputType: "text", placeholder: "Name", required: true }), 3);
    assert.equal(await dialog.picker({ title: "Picker", message: "Choose", value: "a", inputType: "select", placeholder: "One", domain: ["a"], multiple: false, required: true }), 4);
    assert.deepEqual(calls.map(call => call.href), ["/confirm.js", "/message.js", "/prompt.js", "/picker.js"]);
    assert.deepEqual(calls.map(call => call.open), ["dialog", "dialog", "dialog", "dialog"]);
});

test("Dialog missing page options and open preserve navigation behavior", async () => {
    // Keep optional page references undefined and pass explicit open metadata unchanged
    const calls = [];
    const navigation = { async navigate(value) { calls.push(value); return "result"; } };
    const dialog = new Dialog({ navigation, i18n: { config: { langs: [] } } });
    assert.equal(await dialog.confirm({ title: "Confirm", message: "Continue?", variant: "yes-no" }), "result");
    assert.equal(calls[0].href, undefined);
    assert.equal(await dialog.open({ href: "/custom.js", params: { id: 1 }, title: "Custom", breadcrumb: "Root", icon: "x", context: { value: 2 } }), "result");
    assert.deepEqual(calls[1], {
        href: "/custom.js", params: { id: 1 }, open: "dialog",
        nav: { title: "Custom", breadcrumb: "Root", icon: "x" }, context: { value: 2 }
    });
});

test("Dialog invalid configured options fail on first resolution", async () => {
    // Reject bad service options before constructing the singleton
    for (const options of [{ confirm: 1 }, { unknown: null }]) {
        const { services } = createDialogServices(options);
        await services.init();
        assert.throws(() => services.resolve("dialog"), /Invalid options for service 'dialog'/);
        assert.equal(services.getServiceInfo("dialog").state, "registered");
    }
});
