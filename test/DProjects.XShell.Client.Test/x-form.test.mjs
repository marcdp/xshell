import assert from "node:assert/strict";
import test from "node:test";

import datafieldDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-datafield.js";
import formDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-form.js";
import schemaDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-schema.js";
import invokeDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/invoke.js";
import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";

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
        loader: { load() { throw new Error("Unexpected load"); } },
        commands: { enqueue() {} }
    });

    await controller.refresh();

    assert.match(state.generated, /type="password"/);
});

function createInvoke(contract, initialArgs = {}, editorErrors = [], options = {}) {
    const calls = [];
    const closed = [];
    const contexts = [];
    let constructions = 0;
    class Command {
        static contract = contract;
        constructor(context) {
            constructions++;
            contexts.push(context);
            this.context = context;
        }
        execute(...args) {
            calls.push(args);
            return options.execute ? options.execute.call(this, ...args) : "done";
        }
    }
    const editor = { validate: detail => {
        assert.equal(detail, true);
        return editorErrors;
    } };
    const page = {
        host: { layout: options.layout || "page", querySelector: selector => selector === 'x-schema[ref="arguments"]' ? editor : null },
        close(value) { closed.push(value); },
        invalidate() {}
    };
    const state = { ...structuredClone(invokeDefinition.state), type: "command", id: "test", method: "execute", args: initialArgs };
    const tasks = options.tasks || new Tasks({ bus: null });
    const controller = invokeDefinition.controller({ state, page, tasks, loader: { load: async () => Command } });
    return { calls, closed, contexts, controller, page, state, tasks, get constructions() { return constructions; } };
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

    assert.equal(invoke.constructions, 0);
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
    assert.equal(invoke.constructions, 0);
    assert.equal(invoke.tasks.list().length, 0);
    assert.equal(invoke.state.error, "Name: Required");

    errors.length = 0;
    await invoke.controller.submit();
    assert.deepEqual(invoke.calls, [["Ada", 2, undefined]]);
    assert.equal(invoke.constructions, 1);
    assert.equal(invoke.state.completed, true);
    assert.equal(invoke.state.result, "done");

    await invoke.controller.submit();
    assert.equal(invoke.constructions, 2);
    assert.notEqual(invoke.contexts[0], invoke.contexts[1]);
});

test("invoke rejects unsupported and incompatible parameter schemas clearly", async () => {
    const unsupportedType = createInvoke({ execute: { parameters: [{ name: "options", type: "array" }] } });
    await unsupportedType.controller.load();
    assert.match(unsupportedType.state.error, /unsupported type 'array'/);
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
    assert.equal(failing.state.error, "");
    assert.equal(failing.state.taskStatus, "error");
    assert.equal(failing.state.taskError.message, "Command failed");
    assert.equal(failing.state.running, false);

    const dialog = createInvoke({ execute: { parameters: [], returns: { type: "string", format: "url" } } }, {}, [], {
        layout: "dialog", execute() { return "https://example.test/report.pdf"; }
    });
    await dialog.controller.load();
    dialog.controller.mount();
    await dialog.controller.submit();
    assert.deepEqual(dialog.closed, ["https://example.test/report.pdf"]);
    assert.equal(dialog.state.taskStatus, "finished");
});

test("invoke projects Command return metadata and selects presentation without value guessing", async () => {
    const cases = [
        [{ type: "object" }, { processed: 10 }, "object", ""],
        [{ type: "string", format: "text" }, "Operation completed", "string", "text"],
        [{ type: "string", format: "url" }, "https://example.test/report.pdf", "string", "url"],
        [{ type: "string", format: "blob-url" }, "blob:https://example.test/id", "string", "blob-url"],
        [{ type: "string" }, "https://example.test/plain", "string", ""]
    ];

    for (const [returns, result, type, format] of cases) {
        const invoke = createInvoke({ execute: { parameters: [], returns } }, {}, [], { execute() { return result; } });
        await invoke.controller.load();
        await invoke.controller.submit();
        assert.equal(invoke.state.resultType, type);
        assert.equal(invoke.state.resultFormat, format);
        assert.strictEqual(invoke.state.result, result);
    }

    assert.match(invokeDefinition.template, /<x-object[^>]*!state\.resultFormat[^>]*resultType == 'object'/s);
    assert.match(invokeDefinition.template, /<x-code[^>]*resultFormat == 'text'/s);
    assert.match(invokeDefinition.template, /<x-anchor[^>]*resultFormat == 'url'[^>]*resultFormat == 'blob-url'/s);
    assert.doesNotMatch(invokeDefinition.template, /startsWith|https?:|blob:/);
});

test("invoke resolves named return types for presentation", async () => {
    const invoke = createInvoke({
        types: { resourceUrl: { type: "string" } },
        execute: { parameters: [], returns: { ref: "resourceUrl", format: "url" } }
    });

    await invoke.controller.load();

    assert.equal(invoke.state.resultType, "string");
    assert.equal(invoke.state.resultFormat, "url");
});

test("invoke projects Command task reporting and result in output order", async () => {
    const invoke = createInvoke({
        label: "Reporting command",
        description: "Reports execution",
        execute: { parameters: [{ name: "value", type: "integer" }] }
    }, { value: 2 }, [], {
        execute(value) {
            const task = this.context.task;
            task.setDescription("Working");
            task.setProgress(1, value);
            task.out("first");
            task.err("second");
            task.setProgress(value, value);
            return 123;
        }
    });

    await invoke.controller.load();
    await invoke.controller.submit();

    const task = invoke.tasks.list()[0];
    assert.equal(task.background, false);
    assert.equal(invoke.contexts[0].task.signal, task._signal);
    assert.equal(task.description, "Working");
    assert.deepEqual(task.progress, { value: 2, max: 2 });
    assert.deepEqual((await task.getOutput()).entries.map(({ channel, text }) => ({ channel, text })), [
        { channel: "stdout", text: "first" },
        { channel: "stderr", text: "second" }
    ]);
    assert.equal(task.status, "finished");
    assert.equal(await task.getResult(), 123);
    assert.equal(invoke.state.taskStatus, "finished");
    assert.deepEqual(invoke.state.taskOutput.map(({ channel, text }) => ({ channel, text })), [
        { channel: "stdout", text: "first" },
        { channel: "stderr", text: "second" }
    ]);
    assert.equal(invoke.state.result, 123);
});

test("invoke creates a background Task when the Advanced option is selected", async () => {
    const invoke = createInvoke({ execute: { parameters: [] } });
    invoke.state.background = true;

    await invoke.controller.load();
    await invoke.controller.submit();

    assert.equal(invoke.tasks.list()[0].background, true);
});

test("invoke refreshes description, progress and output while a Command is running", async () => {
    let started, release;
    const running = new Promise(resolve => { started = resolve; });
    const blocked = new Promise(resolve => { release = resolve; });
    const invoke = createInvoke({ execute: { parameters: [] } }, {}, [], {
        async execute() {
            this.context.task.setDescription("Halfway");
            this.context.task.setProgress(1, 2);
            this.context.task.out("live output");
            started();
            await blocked;
            return "done";
        }
    });

    await invoke.controller.load();
    const submission = invoke.controller.submit();
    await running;
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(invoke.state.running, true);
    assert.equal(invoke.state.taskDescription, "Halfway");
    assert.deepEqual(invoke.state.taskProgress, { value: 1, max: 2 });
    assert.deepEqual(invoke.state.taskOutput.map(({ channel, text }) => ({ channel, text })), [
        { channel: "stdout", text: "live output" }
    ]);

    release();
    await submission;
});

test("invoke cancels a running Command through its task signal", async () => {
    let started;
    const running = new Promise(resolve => { started = resolve; });
    const invoke = createInvoke({ execute: { parameters: [] } }, {}, [], {
        async execute() {
            started();
            await new Promise((resolve, reject) => {
                this.context.task.signal.addEventListener("abort", () => reject(this.context.task.signal.reason), { once: true });
            });
            return "unreachable";
        }
    });

    await invoke.controller.load();
    const submission = invoke.controller.submit();
    await running;
    await invoke.controller.cancel();
    await submission;

    assert.equal(invoke.tasks.list()[0].status, "canceled");
    assert.equal(invoke.state.taskStatus, "canceled");
    assert.equal(invoke.state.completed, false);
    assert.equal(invoke.state.hasResult, false);
});

test("invoke unload detaches its listener and cancels its foreground Task", async () => {
    const baseTasks = new Tasks({ bus: null });
    let added = 0, removed = 0, started;
    const running = new Promise(resolve => { started = resolve; });
    const tasks = {
        run(options) {
            const task = baseTasks.run(options);
            const addEventListener = task.addEventListener.bind(task);
            const removeEventListener = task.removeEventListener.bind(task);
            task.addEventListener = (...args) => { added++; return addEventListener(...args); };
            task.removeEventListener = (...args) => { removed++; return removeEventListener(...args); };
            return task;
        },
        list: () => baseTasks.list()
    };
    const invoke = createInvoke({ execute: { parameters: [] } }, {}, [], {
        tasks,
        async execute() {
            started();
            await new Promise((resolve, reject) => {
                this.context.task.signal.addEventListener("abort", () => reject(this.context.task.signal.reason), { once: true });
            });
        }
    });

    await invoke.controller.load();
    const submission = invoke.controller.submit();
    await running;
    invoke.controller.unload();

    assert.equal(added, 1);
    assert.equal(removed, 1);

    await submission;
    assert.equal(baseTasks.list()[0].status, "canceled");
});

test("invoke unload lets a background Task continue to completion", async () => {
    let started, release;
    const running = new Promise(resolve => { started = resolve; });
    const blocked = new Promise(resolve => { release = resolve; });
    const invoke = createInvoke({ execute: { parameters: [] } }, {}, [], {
        async execute() {
            started();
            await blocked;
            return "completed";
        }
    });
    invoke.state.background = true;

    await invoke.controller.load();
    const submission = invoke.controller.submit();
    await running;
    const task = invoke.tasks.list()[0];
    invoke.controller.unload();

    assert.equal(task.background, true);
    assert.equal(task._signal.aborted, false);
    release();
    await submission;
    assert.equal(task.status, "finished");
    assert.equal(await task.getResult(), "completed");
});

test("invoke preserves shared Service invocation semantics", async () => {
    const calls = [];
    const instance = { run(value) { calls.push(value); return String(value * 2); } };
    const services = {
        getServiceInfo: id => id === "math" ? { contractId: "math-contract" } : null,
        resolve: id => id === "math" ? instance : null
    };
    const contracts = {
        getContractById: id => id === "math-contract" ? {
            label: "Math",
            methods: { run: { parameters: [{ name: "value", type: "integer" }], returns: { type: "string", format: "text" } } }
        } : null
    };
    const editor = { validate: () => [] };
    const page = {
        host: { layout: "page", querySelector: () => editor },
        invalidate() {}
    };
    const state = {
        ...structuredClone(invokeDefinition.state),
        type: "service", id: "math", method: "run", args: { value: 4 }
    };
    const controller = invokeDefinition.controller({ state, page, services, contracts });

    await controller.load();
    await controller.submit();

    assert.deepEqual(calls, [4]);
    assert.equal(state.result, "8");
    assert.equal(state.resultType, "string");
    assert.equal(state.resultFormat, "text");
    assert.equal(state.completed, true);
    assert.equal(state.taskStatus, "");
});
