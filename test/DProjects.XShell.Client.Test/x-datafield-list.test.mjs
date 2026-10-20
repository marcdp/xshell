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
