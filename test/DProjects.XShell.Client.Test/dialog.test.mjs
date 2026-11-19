import assert from "node:assert/strict";
import test from "node:test";

import ConfigSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/config.schema.json" with { type: "json" };
import DialogContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/dialog.json" with { type: "json" };
import dialogLayout from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-dialog.js";
import Dialog from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/dialog.js";
import Events from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/scoped/events.js";
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
    assert.equal(services.getServiceInfo("dialog").state, "");

    // Resolve one singleton and exercise both injected dependencies
    const dialog = services.resolve("dialog");
    assert.strictEqual(services.resolve("dialog"), dialog);
    assert.equal(services.getServiceInfo("dialog").state, "created");
    assert.equal(await dialog.language({ current: ["en"] }), navigation.calls[0]);
    assert.equal(navigation.calls[0].href, "/picker.js");
    assert.deepEqual(navigation.calls[0].context.domain, [{ value: "es", label: "Spanish (es)" }]);
});

test("Dialog standard helpers use their configured page references", async () => {
    // Compare navigation requests with and without presentation classes.
    const calls = [];
    const navigation = { async navigate(value) { calls.push(value); return calls.length; } };
    const dialog = new Dialog({ navigation, i18n: { config: { langs: [] } } }, {
        confirm: "/confirm.js", message: "/message.js", prompt: "/prompt.js", picker: "/picker.js"
    });

    const cases = {
        confirm: { title: "Confirm", message: "Continue?", variant: "yesno" },
        message: { type: "info", title: "Message", message: "Done" },
        prompt: { title: "Prompt", message: "Name", value: "A", inputType: "text", placeholder: "Name", required: true },
        picker: { title: "Picker", message: "Choose", value: "a", inputType: "select", placeholder: "One", domain: ["a"], multiple: false, required: true }
    };
    const classes = Object.freeze(["size-compact", "custom-style"]);
    for (const [method, options] of Object.entries(cases)) {
        const href = `/${method}.js`;
        const result = await dialog[method](options);
        assert.equal(result, calls.length);
        assert.deepEqual(calls.at(-1), { href, open: "dialog", context: options });
        assert.equal(await dialog[method]({ ...options, classes }), result + 1);
        assert.deepEqual(calls.at(-1), { href, open: "dialog", context: { ...options, classes } });
    }
});

test("Dialog language passes classes and selection options to the radios picker", async () => {
    const { navigation, services } = createDialogServices({ picker: "/picker.js" });
    await services.init();
    const dialog = services.resolve("dialog");
    const classes = ["size-narrow"];
    const options = { current: ["en"], value: "es", classes };

    assert.equal(await dialog.language(options), navigation.calls[0]);
    assert.deepEqual(navigation.calls[0], {
        href: "/picker.js", open: "dialog",
        context: {
            title: "Select language", message: "Language", value: "es", inputType: "radios", placeholder: undefined, multiple: undefined,
            required: true, domain: [{ value: "es", label: "Spanish (es)" }], classes
        }
    });
    await dialog.language();
    assert.equal(Object.hasOwn(navigation.calls[1].context, "classes"), false);
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

test("Dialog open merges classes into a copy of the custom Page context", async () => {
    const calls = [];
    const result = { accepted: true, value: "Example" };
    const navigation = { async navigate(value) { calls.push(value); return result; } };
    const dialog = new Dialog({ navigation });
    const context = Object.freeze({ message: "Hello", value: "Example", classes: Object.freeze(["size-medium"]) });
    const classes = Object.freeze(["size-wide"]);
    const options = { href: "/custom.js", title: "Custom", context };

    assert.strictEqual(await dialog.open(options), result);
    assert.strictEqual(calls[0].context, context);
    assert.strictEqual(await dialog.open({ ...options, classes }), result);
    assert.deepEqual(calls[1], {
        href: "/custom.js", params: undefined, open: "dialog", nav: { title: "Custom", breadcrumb: undefined, icon: undefined },
        context: { message: "Hello", value: "Example", classes }
    });
    await dialog.open({ href: "/custom.js", classes });
    assert.deepEqual(calls[2].context, { classes });
    await dialog.open({ href: "/custom.js" });
    assert.equal(calls[3].context, undefined);
});

test("all Dialog method contracts describe optional arrays of nonempty class names", () => {
    const validator = new JsonValidator();
    for (const method of ["confirm", "message", "prompt", "picker", "language", "open"]) {
        const { schema } = DialogContract.methods[method].parameters[0];
        assert.ok(Object.hasOwn(schema.properties, "classes"), method);
        for (const options of [{}, { classes: [] }, { classes: ["size-wide", "custom-style"] }]) {
            assert.equal(validator.validate(options, schema).valid, true, method);
        }
        for (const classes of ["size-wide", [""], [2]]) {
            assert.equal(validator.validate({ classes }, schema).valid, false, method);
        }
    }
});

test("the dialog layout resolves classes on Page load and renders them before showing the native dialog", t => {
    const pageHost = new EventTarget();
    const rendered = [];
    const pending = [];
    const state = { ...dialogLayout.state, opened: false };
    let page;
    let className = "";
    const nativeDialog = {
        open: false,
        showModal() {
            rendered.push(className);
            this.open = true;
        }
    };
    const host = Object.assign(new EventTarget(), {
        getRootNode: () => ({ host: pageHost }),
        invalidate() {},
        shadowRoot: { querySelector: () => nativeDialog }
    });
    const controller = dialogLayout.controller({
        state, host, getPage: () => page, postRender: method => pending.push(method),
        events: new Events(method => controller[method]())
    });
    const render = () => {
        // Apply the template's class binding before running post-render commands.
        className = (state.opened ? "opened " : "") + state.pageClasses;
        for (const method of pending.splice(0)) controller[method]();
    };
    const previousDocument = globalThis.document;
    globalThis.document = { activeElement: null };
    t.after(() => {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });

    // An early render cannot show the modal while the Page is loading.
    controller.mount();
    render();
    assert.equal(nativeDialog.open, false);

    const metaClasses = Object.freeze(["size-medium", "size-narrow", "fill", "page-style", "opened"]);
    const callerClasses = Object.freeze(["size-compact", "size-wide", "fill", "caller-style", "caller-style"]);
    page = { label: "Test Page", meta: { classes: metaClasses }, context: { classes: callerClasses } };
    pageHost.dispatchEvent(new Event("load"));
    assert.equal(nativeDialog.open, false);
    render();
    assert.deepEqual(rendered, ["size-compact fill page-style caller-style"]);
    render();
    assert.equal(className, "opened size-compact fill page-style caller-style");

    // Loading another Page preserves its own default and discards previous classes.
    page = { meta: { classes: ["size-medium", "page-style"] }, context: { classes: ["another-style"] } };
    pageHost.dispatchEvent(new Event("load"));
    render();
    assert.equal(className, "opened size-medium page-style another-style");
    page = {};
    pageHost.dispatchEvent(new Event("load"));
    render();
    assert.equal(className.trim(), "opened");
    assert.equal(rendered.length, 1);

    // A native cancel still delegates the close request to the Page host.
    let queried = false;
    host.addEventListener("queryClose", event => { queried = event.composed; });
    const event = new Event("cancel", { cancelable: true });
    controller.queryClose({ event });
    assert.equal(event.defaultPrevented, true);
    assert.equal(queried, true);
    controller.unmount();
    pageHost.dispatchEvent(new Event("load"));
    assert.deepEqual(pending, []);
});

test("dialog styles define responsive semantic widths and omit numeric width selectors", () => {
    const widths = {
        "size-compact": "24rem", "size-narrow": "34rem", "size-medium": "48rem", "size-wide": "64rem", "size-full": "calc(100vw - 2rem)"
    };
    const rules = [...dialogLayout.style.matchAll(/dialog\.(size-[\w-]+)\s*\{\s*width:([^;]+);\s*min-width:0;([^}]*)\}/g)];
    assert.deepEqual(Object.fromEntries(rules.map(([, name, width]) => [name, width])), widths);
    assert.match(rules.at(-1)[3], /max-width:none;/);
    assert.match(dialogLayout.style, /dialog\s*\{\s*max-width:90vw;\s*min-width:25vw;/);
    assert.match(dialogLayout.style, /@media \(max-width: 768px\)\s*\{\s*dialog\s*\{\s*min-width:50vw;/);
    assert.doesNotMatch(dialogLayout.style, /dialog\.width\d+/);
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
