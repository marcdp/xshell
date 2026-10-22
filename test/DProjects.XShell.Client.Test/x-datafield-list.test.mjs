import assert from "node:assert/strict";
import test from "node:test";

import datafieldDefinition, { contract } from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-datafield.js";

globalThis.HTMLElement = class {};
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.customElements = { get() {}, define() {} };
globalThis.window = { customElements: globalThis.customElements };

const { XTemplateRuntimeUtils } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/render-engines/x.js");

function createListController({ value = [], itemDefault = null } = {}) {
    let assignments = 0;
    const target = { value, itemDefault };
    const state = new Proxy(target, {
        set(object, property, newValue) {
            object[property] = newValue;
            if (property === "value") assignments++;
            return true;
        }
    });
    const controller = datafieldDefinition.controller({ state });

    return {
        controller,
        state,
        valueAssignments: () => assignments
    };
}

function createLifecycleController({ value, defaultValue } = {}) {
    const listeners = new Map();
    const dispatched = [];
    const target = {
        value,
        default: defaultValue,
        type: "",
        domainNormalized: [],
        langs: [],
        langIndex: 0,
        multiple: false,
        validated: false,
        errors: [],
        autofocus: false
    };
    const state = new Proxy(target, {
        get(object, property) {
            if (property === "addEventListener") {
                return (event, listener) => {
                    const handlers = listeners.get(event) ?? [];
                    handlers.push(listener);
                    listeners.set(event, handlers);
                };
            }
            return object[property];
        },
        set(object, property, newValue) {
            const oldValue = object[property];
            object[property] = newValue;
            if (!Object.is(oldValue, newValue)) {
                for (const listener of listeners.get(`change:${String(property)}`) ?? []) {
                    listener({ prop: property, oldValue, newValue });
                }
            }
            return true;
        }
    });
    const host = {
        isConnected: false,
        firstElementChild: null,
        dispatchEvent(event) { dispatched.push(event); },
        shadowRoot: { querySelector() { return null; } }
    };
    const events = {
        on(element, eventNames, listener) {
            for (const eventName of eventNames) element.addEventListener(eventName, listener);
        }
    };
    const controller = datafieldDefinition.controller({
        state,
        events,
        host,
        timer: { setTimeout() {} },
        loader: { load() { throw new Error("Unexpected loader call"); } },
        i18n: {
            getLangLabel(lang) { return lang; },
            formatText(text) { return text; },
            getMainLangs() { return []; }
        },
        temp: { getAbsoluteUrl(value) { return value; } },
        dialog: {}
    });

    return { controller, dispatched, host, state };
}

function listEvent(items, index, detail = {}) {
    const children = items.map(() => ({}));
    const target = children[index];
    target.parentNode = { children };
    return {
        event: {
            target,
            detail,
            stopPropagation() {}
        }
    };
}

test("x-datafield declares itemDefault as a state-backed property binding", () => {
    assert.deepEqual(contract.properties.itemDefault, {
        type: "any",
        default: null,
        attribute: false,
        state: true,
        description: "Default value used to initialize newly added list items."
    });
});

test("x-datafield declares default as a state-backed property-only binding", () => {
    assert.deepEqual(contract.properties.default, {
        type: "any",
        attribute: false,
        state: true,
        description: "Value used to initialize the field when value is undefined."
    });
    assert.equal(contract.properties.value.default, undefined);
});

test("x-datafield default initializes only an undefined value", async () => {
    for (const explicitValue of [null, false, 0, "", [], {}]) {
        const field = createLifecycleController({ value: explicitValue, defaultValue: "fallback" });

        await field.controller.load();

        assert.equal(field.state.value, explicitValue);
    }

    const field = createLifecycleController({ value: undefined, defaultValue: "fallback" });
    await field.controller.load();
    assert.equal(field.state.value, "fallback");
});

test("x-datafield deeply clones object and array defaults", async () => {
    const objectDefault = { nested: { values: [1, 2] } };
    const objectField = createLifecycleController({ defaultValue: objectDefault });
    const secondObjectField = createLifecycleController({ defaultValue: objectDefault });
    await objectField.controller.load();
    await secondObjectField.controller.load();

    assert.deepEqual(objectField.state.value, objectDefault);
    assert.notEqual(objectField.state.value, objectDefault);
    assert.notEqual(objectField.state.value, secondObjectField.state.value);
    assert.notEqual(objectField.state.value.nested, objectDefault.nested);
    assert.notEqual(objectField.state.value.nested, secondObjectField.state.value.nested);
    assert.notEqual(objectField.state.value.nested.values, objectDefault.nested.values);

    const arrayDefault = [{ enabled: true }];
    const arrayField = createLifecycleController({ defaultValue: arrayDefault });
    await arrayField.controller.load();

    assert.deepEqual(arrayField.state.value, arrayDefault);
    assert.notEqual(arrayField.state.value, arrayDefault);
    assert.notEqual(arrayField.state.value[0], arrayDefault[0]);
});

test("x-datafield applies a property-bound default at mount without emitting change", async () => {
    const field = createLifecycleController();
    await field.controller.load();
    field.state.default = { enabled: true };
    field.host.isConnected = true;

    await field.controller.mount({});

    assert.deepEqual(field.state.value, { enabled: true });
    assert.deepEqual(field.dispatched, []);
});

test("x-datafield does not reapply default after initialization", async () => {
    const field = createLifecycleController({ defaultValue: "initial" });
    await field.controller.load();
    field.host.isConnected = true;
    await field.controller.mount({});

    field.state.value = "changed";
    field.state.value = undefined;

    assert.equal(field.state.value, undefined);
    assert.equal(field.dispatched.length, 4);
    assert.deepEqual(field.dispatched.map(event => event.type), ["change", "datafield:change", "change", "datafield:change"]);
});

test("x-datafield list Add appends an empty object when itemDefault is omitted", async () => {
    const list = createListController({ value: null });

    await list.controller.listAdd({});

    assert.deepEqual(list.state.value, [{}]);
    assert.equal(list.valueAssignments(), 1);
});

test("x-datafield list Add deeply clones itemDefault for every new item", async () => {
    const itemDefault = {
        street: "",
        city: "",
        location: { country: "ES" },
        tags: [{ label: "home" }]
    };
    const list = createListController({ itemDefault });

    await list.controller.listAdd({});
    await list.controller.listAdd({});

    assert.deepEqual(list.state.value, [itemDefault, itemDefault]);
    assert.notEqual(list.state.value[0], list.state.value[1]);
    assert.notEqual(list.state.value[0].location, list.state.value[1].location);
    assert.notEqual(list.state.value[0].tags, list.state.value[1].tags);
    assert.notEqual(list.state.value[0].tags[0], list.state.value[1].tags[0]);

    assert.doesNotThrow(() => {
        XTemplateRuntimeUtils.expr.assign(list.state.value[0], [{ kind: "member", name: "street" }], "First");
        XTemplateRuntimeUtils.expr.assign(list.state.value[0], [{ kind: "member", name: "city" }], "Paris");
    });
    list.state.value[0].location.country = "FR";
    list.state.value[0].tags[0].label = "office";

    assert.equal(list.state.value[1].street, "");
    assert.equal(list.state.value[1].city, "");
    assert.equal(list.state.value[1].location.country, "ES");
    assert.equal(list.state.value[1].tags[0].label, "home");
    assert.deepEqual(itemDefault, {
        street: "",
        city: "",
        location: { country: "ES" },
        tags: [{ label: "home" }]
    });
    assert.equal(list.valueAssignments(), 2);
});

test("x-datafield list Add accepts a JSON-style reactive Proxy itemDefault", async () => {
    const original = {
        street: "",
        city: "",
        nested: { values: [1, 2] }
    };
    const itemDefault = new Proxy(original, {});
    const list = createListController({ itemDefault });

    await list.controller.listAdd({});

    assert.deepEqual(list.state.value, [original]);
    assert.notEqual(list.state.value[0], itemDefault);
    assert.notEqual(list.state.value[0].nested, original.nested);
    assert.notEqual(list.state.value[0].nested.values, original.nested.values);
    assert.deepEqual(original, {
        street: "",
        city: "",
        nested: { values: [1, 2] }
    });
});

test("x-datafield list controls keep immutable list updates after adding a default item", async () => {
    const list = createListController({
        value: [{ street: "First", city: "Madrid" }],
        itemDefault: { street: "", city: "" }
    });

    await list.controller.listAdd({});
    assert.deepEqual(list.state.value[1], { street: "", city: "" });

    list.state.value[1].street = "Second";
    await list.controller.listMove(listEvent(list.state.value, 1, { direction: "up" }));
    assert.deepEqual(list.state.value.map(item => item.street), ["Second", "First"]);

    await list.controller.listRemove(listEvent(list.state.value, 1));
    assert.deepEqual(list.state.value, [{ street: "Second", city: "" }]);
    assert.equal(list.valueAssignments(), 3);
});
