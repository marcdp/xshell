import assert from "node:assert/strict";
import test from "node:test";

import XSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-schema/schemas/x-schema.schema.json" with { type: "json" };
import Customers from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-schema/samples/customers.json" with { type: "json" };
import Demo from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/pages/01-components/06-x-schema.js";
import { Validator } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/vendor/json-schema/4.1.1/json-schema.js";

const validator = new Validator(XSchema, "2020-12");

function assertValid(document) {
    const result = validator.validate(document);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
}

function assertInvalid(document, message) {
    assert.equal(validator.validate(document).valid, false, message);
}

function documentWithArrayItem(item, extraTypes = {}) {
    return {
        version: "0",
        root: "Root",
        types: {
            Root: {
                kind: "object",
                children: [{ kind: "array", bind: "items", item }]
            },
            ...extraTypes
        }
    };
}

test("canonical customer sample and x-demo use the X-Schema V0 contract", () => {
    assertValid(Customers);
    assertValid(Demo.state.schema);
    assert.equal(Demo.state.schema.version, "0");
    assert.equal("$schema" in Demo.state.schema, false);
});

test("named object types contain structure rather than presentation defaults", () => {
    for (const property of ["tag", "attrs", "props", "conditions"]) {
        const document = structuredClone(Customers);
        document.types.Address[property] = property === "tag" ? "x-panel" : {};
        assertInvalid(document, `objectType.${property} must be rejected`);
    }

    const document = structuredClone(Customers);
    document.types.Root.children.push({
        type: "Address",
        bind: "billingAddress",
        required: true,
        attrs: { class: "billing" },
        props: { label: "Billing address" },
        conditions: { visible: { path: "$root.advanced", equals: true } },
        create: { street: "", city: "", countryId: null },
        meta: { source: "test" }
    });
    assertValid(document);
});

test("conditions expose only visible, enabled, readonly and required UI states", () => {
    for (const property of ["hidden", "disabled"]) {
        const document = structuredClone(Customers);
        document.types.Root.children[0].conditions = {
            [property]: { path: "$root.advanced", equals: true }
        };
        assertInvalid(document, `conditions.${property} must be rejected`);
    }

    for (const property of ["visible", "enabled", "readonly", "required"]) {
        const document = structuredClone(Customers);
        document.types.Root.children[0].conditions = {
            [property]: { path: "$root.advanced", equals: true }
        };
        assertValid(document);
    }
});

test("path conditions reject inverse predicates and retain logical not", () => {
    for (const property of ["notEquals", "notIn"]) {
        const document = structuredClone(Customers);
        document.types.Root.children[0].conditions = {
            visible: { path: "$root.advanced", [property]: property === "notIn" ? [true] : true }
        };
        assertInvalid(document, `${property} must be rejected`);
    }

    const document = structuredClone(Customers);
    document.types.Root.children[0].conditions = {
        visible: { not: { path: "$root.advanced", equals: false } }
    };
    assertValid(document);
});

test("data references use non-empty opaque string sources", () => {
    const document = structuredClone(Customers);
    const reference = document.types.Address.children[2].reference;
    reference.source = "datasource:countries";
    assertValid(document);

    for (const source of ["", { kind: "entity", name: "Country" }, { kind: "resource", resource: "countries.json" }]) {
        reference.source = source;
        assertInvalid(document, `source ${JSON.stringify(source)} must be rejected`);
    }
});

test("array items accept every data node kind but reject presentation containers", () => {
    const itemType = { kind: "object", children: [] };
    for (const item of [
        { type: "Item" },
        { kind: "field", dataType: "string" },
        { kind: "object", children: [] },
        { kind: "array", item: { kind: "field", dataType: "string" } }
    ]) {
        assertValid(documentWithArrayItem(item, { Item: itemType }));
    }

    assertInvalid(documentWithArrayItem({
        kind: "container",
        tag: "x-panel",
        children: []
    }), "containerNode must not be accepted as an array item");
});

test("array editing options are flat and retain their defaults", () => {
    const document = documentWithArrayItem({ kind: "field", dataType: "string" });
    Object.assign(document.types.Root.children[0], {
        allowAdd: true,
        allowRemove: false,
        allowMove: true,
        minItems: 1,
        maxItems: 3
    });
    assertValid(document);

    document.types.Root.children[0].array = { allowAdd: true };
    assertInvalid(document, "the nested array options wrapper must be rejected");

    const properties = XSchema.$defs.arrayNode.properties;
    assert.equal(properties.allowAdd.default, true);
    assert.equal(properties.allowRemove.default, true);
    assert.equal(properties.allowMove.default, false);
    assert.equal("arrayOptions" in XSchema.$defs, false);
});
