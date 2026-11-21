import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ConfigSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/config.schema.json" with { type: "json" };
import DialogContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/dialog.json" with { type: "json" };
import dialogLayout from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-dialog.js";
import stackLayout from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-stack.js";
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
                services: { dialog: { contract: "dialog", implementation: "/services/dialog.js", lifetime: "singleton", options } }
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

    const metaClasses = Object.freeze(["size-medium", "size-narrow", "layout-fill", "dialog-size-wide", "stack-size-full", "page-style", "opened"]);
    const callerClasses = Object.freeze(["size-compact", "size-wide", "layout-fill", "dialog-layout-fill", "caller-style", "caller-style"]);
    page = { label: "Test Page", meta: { classes: metaClasses }, context: { classes: callerClasses } };
    pageHost.dispatchEvent(new Event("load"));
    assert.equal(nativeDialog.open, false);
    render();
    assert.deepEqual(rendered, ["size-compact layout-fill dialog-size-wide stack-size-full page-style dialog-layout-fill caller-style"]);
    render();
    assert.equal(className, "opened size-compact layout-fill dialog-size-wide stack-size-full page-style dialog-layout-fill caller-style");

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
    const rules = [...dialogLayout.style.matchAll(/dialog\.dialog-(size-[\w-]+)\s*\{\s*width:([^;]+);\s*min-width:0;([^}]*)\}/g)];
    assert.deepEqual(Object.fromEntries(rules.map(([, name, width]) => [name, width])), widths);
    assert.match(rules.at(-1)[3], /max-width:none;/);
    assert.match(dialogLayout.style, /dialog\s*\{\s*max-width:90vw;\s*min-width:25vw;/);
    assert.match(dialogLayout.style, /@media \(max-width: 768px\)\s*\{\s*dialog\s*\{\s*min-width:50vw;/);
    assert.doesNotMatch(dialogLayout.style, /dialog\.width\d+/);
});

test("the Stack layout applies caller classes before expanding and merges Page defaults after load", t => {
    const originalDocument = globalThis.document;
    const pageHost = new EventTarget();
    const caller = Object.freeze(["size-compact", "size-full", "caller-style", "caller-style", "layout-fill", "stack-layout-fill"]);
    const defaults = Object.freeze(["size-medium", "size-narrow", "stack-size-wide", "dialog-size-full", "page-style", "layout-fill"]);
    const state = { ...stackLayout.state, stackClasses: caller, expanded: false };
    let page;

    globalThis.document = { activeElement: null };
    t.after(() => { if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument; });
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const controller = stackLayout.controller({
        state, host: { getRootNode: () => ({ host: pageHost }) }, getPage: () => page,
        runtime: { uptimeMs: 1000 }, postRender() {}, events: new Events(method => controller[method]())
    });
    // Model the first connection while the destination Page is still loading.
    controller.load();
    controller.mount();
    assert.equal(state.expanded, false);
    assert.equal(state.pageClasses, "size-compact caller-style layout-fill stack-layout-fill");
    t.mock.timers.tick(50);
    assert.equal(state.expanded, true);
    assert.equal(state.pageClasses, "size-compact caller-style layout-fill stack-layout-fill");

    page = { meta: { classes: defaults } };
    pageHost.dispatchEvent(new Event("load"));
    assert.equal(state.pageClasses, "size-compact stack-size-wide dialog-size-full page-style layout-fill caller-style stack-layout-fill");
    state.stackClasses = ["custom-style"];
    controller.stateChange({ changes: [{ prop: "stackClasses" }] });
    assert.equal(state.pageClasses, "size-medium stack-size-wide dialog-size-full page-style layout-fill custom-style");
    page = {};
    pageHost.dispatchEvent(new Event("load"));
    assert.equal(state.pageClasses, "custom-style");
    state.stackClasses = [];
    controller.stateChange({ changes: [{ prop: "stackClasses" }] });
    assert.equal(state.pageClasses, "");
    controller.unmount();
});

test("Stack sizes override inherited depth widths on desktop while mobile uses the full viewport", async () => {
    const globalStyle = await readFile(new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x/styles/index.css", import.meta.url), "utf8");
    const [base, desktop, mobile] = stackLayout.style.split(/@media \([^)]+\)/);
    const widths = Object.fromEntries([...desktop.matchAll(/div\.panel:has\(> \.body\.stack-(size-[\w-]+)\)\s*\{--x-layout-stack-width:([^;]+);/g)]
        .map(([, name, width]) => [name, width]));
    assert.deepEqual(widths, {
        "size-compact": "clamp(22rem, 25vw, 34rem)", "size-narrow": "clamp(28rem, 40vw, 46rem)",
        "size-medium": "60vw", "size-wide": "75vw", "size-full": "100vw"
    });
    assert.match(base, /width:var\(--x-layout-stack-width\)/);
    assert.match(base, /max-width:100vw/);
    assert.match(stackLayout.style, /@media \(min-width: 769px\)/);
    assert.match(stackLayout.style, /@media \(max-width: 768px\)/);
    assert.match(mobile, /:host\s*\{\s*--x-layout-stack-width:100vw/);
    assert.doesNotMatch(mobile, /\.size-/);
    assert.deepEqual([...globalStyle.matchAll(/--x-layout-stack-width:\s*(\d+vw)/g)].map(([, width]) => width),
        ["75vw", "73vw", "71vw", "69vw", "67vw"]);
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
