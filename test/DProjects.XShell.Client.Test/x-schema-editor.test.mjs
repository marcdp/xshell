import assert from "node:assert/strict";
import test from "node:test";

import EditorDefinition, { contract as editorContract } from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-schema/components/x-schema-editor.js";
import Sample from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-schema/samples/sample1.x-schema.json" with { type: "json" };
import SampleValue from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-schema/samples/sample1.json" with { type: "json" };

class FakeClassList {
    constructor() {
        this.values = new Set();
    }
    add(...values) {
        for (const value of values) this.values.add(value);
    }
    contains(value) {
        return this.values.has(value);
    }
}

class FakeElement {
    constructor(localName) {
        this.localName = localName;
        this.children = [];
        this.parentNode = null;
        this.attributes = new Map();
        this.classList = new FakeClassList();
        this.listeners = new Map();
        this.hidden = false;
    }
    append(...children) {
        for (const child of children) {
            child.parentNode = this;
            this.children.push(child);
        }
    }
    replaceChildren(...children) {
        for (const child of this.children) child.parentNode = null;
        this.children = [];
        this.append(...children);
    }
    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }
    removeAttribute(name) {
        this.attributes.delete(name);
    }
    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }
    hasAttribute(name) {
        return this.attributes.has(name);
    }
    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) ?? [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }
    removeEventListener(type, listener) {
        const listeners = this.listeners.get(type) ?? [];
        this.listeners.set(type, listeners.filter(item => item !== listener));
    }
    dispatchEvent(event) {
        if (!event.target) Object.defineProperty(event, "target", { value: this, configurable: true });
        for (const listener of [...(this.listeners.get(event.type) ?? [])]) listener(event);
        return true;
    }
    querySelector(selector) {
        return this.querySelectorAll(selector)[0] ?? null;
    }
    querySelectorAll(selector) {
        const result = [];
        const matches = element => {
            if (selector.startsWith(".")) return element.classList.contains(selector.substring(1));
            if (selector.startsWith("#")) return element.getAttribute("id") === selector.substring(1);
            return element.localName === selector;
        };
        const visit = element => {
            for (const child of element.children) {
                if (matches(child)) result.push(child);
                visit(child);
            }
        };
        visit(this);
        return result;
    }
}

class FakeEvent {
    constructor(type, { detail = undefined } = {}) {
        this.type = type;
        this.detail = detail;
        this.target = null;
        this.stopped = false;
    }
    stopPropagation() {
        this.stopped = true;
    }
}

const contracts = {
    "x-datafield": {
        events: { change: {} },
        properties: Object.fromEntries([
            "label", "placeholder", "maxlength", "type", "min", "max", "domain", "value",
            "disabled", "readonly", "required"
        ].map(name => [name, {}]))
    },
    "x-details": {
        events: {},
        properties: { label: {}, open: {}, disabled: {} }
    },
    "x-datafields": {
        events: { remove: {}, move: {} },
        properties: { remove: {}, move: {}, label: {}, columns: {} }
    },
    "x-button": {
        events: {},
        properties: { label: {}, icon: {}, command: {}, href: {}, autofocus: {} }
    },
    "x-test-container": {
        events: {},
        properties: { label: {}, enabled: {} }
    }
};

const registered = new Map(Object.entries(contracts).map(([tag, contract]) => [
    tag,
    class { static contract = contract; }
]));

globalThis.document = {
    createElement(tag) {
        return new FakeElement(tag);
    }
};
globalThis.customElements = {
    get(tag) {
        return registered.get(tag);
    }
};
globalThis.CustomEvent = FakeEvent;

function event(type, detail) {
    return new FakeEvent(type, { detail });
}

function findByProperty(root, tag, property, value) {
    return root.querySelectorAll(tag).find(element => element[property] === value);
}

async function settle() {
    await new Promise(resolve => setImmediate(resolve));
}

async function createHarness(schema, value) {
    const mount = new FakeElement("div");
    mount.classList.add("editor");
    const emitted = [];
    const host = new FakeElement("x-schema-editor");
    host.shadowRoot = {
        querySelector(selector) {
            return selector === ".editor" ? mount : null;
        }
    };
    host.dispatchEvent = emittedEvent => {
        emitted.push(emittedEvent);
        return true;
    };
    const state = {
        src: null,
        schema,
        value,
        validationResult: null,
        renderingError: null
    };
    const queued = [];
    const requests = [];
    const loader = {
        async load(resource) {
            requests.push(resource);
            const tag = resource.substring("component:".length);
            const componentClass = registered.get(tag);
            if (!componentClass) throw new Error(`Unknown test component ${tag}`);
            return componentClass;
        }
    };
    const controller = EditorDefinition.controller({
        events: { on() {} },
        loader,
        state,
        xSchemaValidator: { async validate() { return { valid: true, errors: [] }; } },
        host,
        commands: { enqueue(command, args) { queued.push({ command, args }); } }
    });
    controller.load();
    await controller.refresh();
    while (queued.length) {
        const item = queued.shift();
        await controller[item.command](item.args);
    }
    return { controller, emitted, host, loader, mount, requests, state };
}

function simpleDocument(children, types = {}) {
    return {
        version: "0",
        root: "Root",
        types: {
            Root: { kind: "object", children },
            ...types
        }
    };
}

test("the editor contract exposes a structured change event", () => {
    assert.deepEqual(Object.keys(editorContract.events), ["change"]);
    assert.deepEqual(Object.keys(editorContract.events.change.detail), ["path", "oldValue", "newValue", "value"]);
});

test("the canonical root renders real registered XShell components without mutating its schema", async () => {
    const schema = structuredClone(Sample);
    const before = structuredClone(schema);
    const harness = await createHarness(schema, structuredClone(SampleValue));

    assert.equal(harness.state.renderingError, null);
    assert.ok(harness.mount.querySelectorAll("x-datafield").length > 20);
    assert.ok(harness.mount.querySelectorAll("x-details").length >= 7);
    assert.ok(harness.mount.querySelectorAll("x-datafields").length > 0);
    assert.ok(harness.mount.querySelectorAll("x-button").length > 0);
    assert.deepEqual(schema, before);
    assert.equal(new Set(harness.requests).size, harness.requests.length, "component loads are cached for a render");
});

test("field attrs and props use their distinct DOM and property channels", async () => {
    const schema = simpleDocument([{
        kind: "field",
        bind: "name",
        tag: "x-datafield",
        attrs: { id: "name", tabindex: 1, hidden: false, "data-empty": null },
        props: { label: "Name", maxlength: 20 }
    }]);
    const harness = await createHarness(schema, { name: "Ada" });
    const field = harness.mount.querySelector("x-datafield");

    assert.equal(field.getAttribute("id"), "name");
    assert.equal(field.getAttribute("tabindex"), "1");
    assert.equal(field.hasAttribute("hidden"), false);
    assert.equal(field.hasAttribute("data-empty"), false);
    assert.equal(field.label, "Name");
    assert.equal(field.maxlength, 20);
    assert.equal(field.value, "Ada");
});

test("field changes mutate the existing value and emit the editor event", async () => {
    const value = { profile: { name: "Ada" } };
    const harness = await createHarness(simpleDocument([{
        kind: "field",
        bind: "profile.name",
        tag: "x-datafield"
    }]), value);
    const field = harness.mount.querySelector("x-datafield");
    field.dispatchEvent(event("change", { oldValue: "Ada", newValue: "Grace" }));

    assert.strictEqual(harness.state.value, value);
    assert.equal(value.profile.name, "Grace");
    assert.equal(harness.emitted.length, 1);
    assert.deepEqual(harness.emitted[0].detail, {
        path: "profile.name",
        oldValue: "Ada",
        newValue: "Grace",
        value
    });
});

test("inline, named, container, scoped, and omitted bindings preserve the documented contexts", async () => {
    const schema = simpleDocument([{
        kind: "container",
        tag: "x-test-container",
        props: { label: "Same context" },
        children: [{
            kind: "object",
            bind: "profile",
            children: [
                { kind: "field", bind: "$current.name", tag: "x-datafield", props: { label: "Current" } },
                { kind: "field", bind: "$parent.rootName", tag: "x-datafield", props: { label: "Parent" } },
                { kind: "field", bind: "$root.rootName", tag: "x-datafield", props: { label: "Root" } }
            ]
        }, {
            kind: "object",
            bind: "address",
            type: "Address"
        }]
    }], {
        Address: {
            kind: "object",
            children: [{ kind: "field", bind: "city", tag: "x-datafield", props: { label: "City" } }]
        }
    });
    const harness = await createHarness(schema, {
        rootName: "Root",
        profile: { name: "Current" },
        address: { city: "Barcelona" }
    });

    assert.equal(findByProperty(harness.mount, "x-datafield", "label", "Current").value, "Current");
    assert.equal(findByProperty(harness.mount, "x-datafield", "label", "Parent").value, "Root");
    assert.equal(findByProperty(harness.mount, "x-datafield", "label", "Root").value, "Root");
    assert.equal(findByProperty(harness.mount, "x-datafield", "label", "City").value, "Barcelona");

    const arrayHarness = await createHarness(simpleDocument([{
        kind: "array",
        bind: "names",
        item: { kind: "field", tag: "x-datafield", default: "" },
        default: []
    }]), { names: ["One"] });
    const item = arrayHarness.mount.querySelector("x-datafield");
    item.dispatchEvent(event("change", { newValue: "First" }));
    assert.deepEqual(arrayHarness.state.value.names, ["First"]);
});

test("local references populate x-datafield domain while opaque datasource references stay deferred", async () => {
    const schema = simpleDocument([{
        kind: "field",
        bind: "countryId",
        tag: "x-datafield",
        props: { type: "select" },
        reference: { source: "$root.countries", key: "id", label: "name" }
    }, {
        kind: "field",
        bind: "status",
        tag: "x-datafield",
        props: { type: "select" },
        reference: { source: "datasource:statuses", key: "id", label: "name" }
    }]);
    const harness = await createHarness(schema, {
        countryId: "ES",
        status: "A",
        countries: [{ id: "ES", name: "Spain" }]
    });
    const fields = harness.mount.querySelectorAll("x-datafield");
    assert.deepEqual(fields[0].domain, [{ value: "ES", label: "Spain" }]);
    assert.equal(fields[1].domain, undefined);
});

test("documented field, array, inline-object, and named-type creation values initialize missing data by clone", async () => {
    const schema = simpleDocument([{
        kind: "field",
        bind: "name",
        tag: "x-datafield",
        default: "New"
    }, {
        kind: "object",
        bind: "inline",
        create: { value: "inline" },
        children: [{ kind: "field", bind: "value", tag: "x-datafield" }]
    }, {
        kind: "object",
        bind: "named",
        type: "Named"
    }, {
        kind: "array",
        bind: "items",
        default: [{ value: "array" }],
        allowAdd: false,
        item: {
            kind: "object",
            children: [{ kind: "field", bind: "value", tag: "x-datafield" }]
        }
    }], {
        Named: {
            kind: "object",
            create: { value: "named" },
            children: [{ kind: "field", bind: "value", tag: "x-datafield" }]
        }
    });
    const value = {};
    const before = structuredClone(schema);
    await createHarness(schema, value);

    assert.deepEqual(value, {
        name: "New",
        inline: { value: "inline" },
        named: { value: "named" },
        items: [{ value: "array" }]
    });
    assert.notStrictEqual(value.inline, schema.types.Root.children[1].create);
    assert.notStrictEqual(value.named, schema.types.Named.create);
    assert.notStrictEqual(value.items, schema.types.Root.children[3].default);
    assert.deepEqual(schema, before);
});

test("conditions compose visibility, enabled, readonly, required, and refresh after changes", async () => {
    const schema = simpleDocument([{
        kind: "container",
        tag: "x-test-container",
        conditions: {
            visible: { path: "$root.show", equals: true },
            enabled: { path: "$root.enabled", equals: true },
            readonly: { path: "$root.locked", equals: true }
        },
        children: [{
            kind: "field",
            bind: "name",
            required: false,
            tag: "x-datafield",
            conditions: {
                required: { path: "$root.required", equals: true }
            }
        }, {
            kind: "field",
            bind: "show",
            tag: "x-datafield",
            props: { label: "Show" }
        }]
    }]);
    const value = { show: false, enabled: false, locked: true, required: true, name: "Ada" };
    const harness = await createHarness(schema, value);
    const container = harness.mount.querySelector("x-test-container");
    const name = harness.mount.querySelector("x-datafield");
    assert.equal(container.hidden, true);
    assert.equal(name.hidden, true);
    assert.equal(name.disabled, true);
    assert.equal(name.readonly, true);
    assert.equal(name.required, true);

    const show = findByProperty(harness.mount, "x-datafield", "label", "Show");
    value.enabled = true;
    value.locked = false;
    show.dispatchEvent(event("change", { newValue: true }));
    assert.equal(container.hidden, false);
    assert.equal(name.hidden, false);
    assert.equal(name.disabled, false);
    assert.equal(name.readonly, false);
});

test("condition evaluation supports every V0 predicate and logical form", async () => {
    const visibleConditions = [
        { path: "$root.equal", equals: "yes" },
        { path: "$root.present", exists: true },
        { path: "$root.choice", in: ["a", "b"] },
        { path: "$root.number", greaterThan: 1 },
        { path: "$root.number", greaterThanOrEqual: 2 },
        { path: "$root.number", lessThan: 3 },
        { path: "$root.number", lessThanOrEqual: 2 },
        { all: [{ path: "$root.equal", equals: "yes" }, { path: "$root.number", equals: 2 }] },
        { any: [{ path: "$root.equal", equals: "no" }, { path: "$root.number", equals: 2 }] },
        { not: { path: "$root.equal", equals: "no" } }
    ];
    const schema = simpleDocument(visibleConditions.map((visible, index) => ({
        kind: "field",
        bind: "equal",
        tag: "x-datafield",
        props: { label: `Predicate ${index}` },
        conditions: { visible }
    })));
    const harness = await createHarness(schema, {
        equal: "yes",
        present: false,
        choice: "b",
        number: 2
    });
    assert.ok(harness.mount.querySelectorAll("x-datafield").every(field => field.hidden === false));
});

test("arrays add, remove, and move with cloned creation values and refreshed item closures", async () => {
    const schema = simpleDocument([{
        kind: "array",
        bind: "items",
        tag: "x-details",
        props: { label: "Items", open: true },
        item: { kind: "object", type: "Item" },
        allowAdd: true,
        allowRemove: true,
        allowMove: true,
        minItems: 0,
        maxItems: 3,
        default: []
    }], {
        Item: {
            kind: "object",
            create: { name: "" },
            children: [{ kind: "field", bind: "name", tag: "x-datafield" }]
        }
    });
    const value = { items: [{ name: "One" }, { name: "Two" }] };
    const harness = await createHarness(schema, value);
    const wrapper = harness.mount.querySelector("x-details");
    const add = findByProperty(wrapper, "x-button", "label", "Add");
    add.dispatchEvent(event("click"));
    await settle();
    assert.deepEqual(value.items, [{ name: "One" }, { name: "Two" }, { name: "" }]);
    assert.notStrictEqual(value.items[2], schema.types.Item.create);

    let rows = wrapper.querySelectorAll("x-datafields");
    rows[0].dispatchEvent(event("move", { direction: "down" }));
    await settle();
    assert.deepEqual(value.items.map(item => item.name), ["Two", "One", ""]);

    rows = wrapper.querySelectorAll("x-datafields");
    rows[1].dispatchEvent(event("remove"));
    await settle();
    assert.deepEqual(value.items.map(item => item.name), ["Two", ""]);
    assert.equal(wrapper.querySelectorAll("x-datafields").length, 2);
});

test("rerender disposal removes listeners from the previous generated tree", async () => {
    const schema = simpleDocument([{ kind: "field", bind: "name", tag: "x-datafield" }]);
    const value = { name: "Ada" };
    const harness = await createHarness(schema, value);
    const oldField = harness.mount.querySelector("x-datafield");
    await harness.controller.refresh();
    await harness.controller.renderEditor({ revision: 2 });
    const newField = harness.mount.querySelector("x-datafield");

    oldField.dispatchEvent(event("change", { newValue: "Old listener" }));
    assert.equal(value.name, "Ada");
    newField.dispatchEvent(event("change", { newValue: "New listener" }));
    assert.equal(value.name, "New listener");
    assert.equal(harness.emitted.length, 1);
});

test("a missing field tag reports the V0 ambiguity instead of inventing a fallback", async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
        const harness = await createHarness(simpleDocument([{ kind: "field", bind: "name" }]), { name: "Ada" });
        assert.match(harness.state.renderingError, /has no tag.*no fallback component/);
        assert.equal(harness.mount.children.length, 0);
    } finally {
        console.error = originalError;
    }
});
