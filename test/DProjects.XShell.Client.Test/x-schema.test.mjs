import assert from "node:assert/strict";
import test from "node:test";

import XSchemaValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-schema/services/x-schema-validator.js";
import XSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-schema/schemas/x-schema.schema.json" with { type: "json" };
import Sample from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-schema/samples/sample1.x-schema.json" with { type: "json" };
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";

function objectType(children = []) {
    return { kind: "object", children };
}

function documentWithChildren(children, extraTypes = {}) {
    return {
        version: "0",
        root: "Root",
        types: {
            Root: objectType(children),
            ...extraTypes
        }
    };
}

function createHarness(jsonValidator = new JsonValidator()) {
    const requests = [];
    const loader = {
        async load(resource) {
            requests.push(resource);
            assert.equal(resource, "schema:x-schema");
            return XSchema;
        }
    };

    return {
        requests,
        validator: new XSchemaValidator({ jsonValidator, loader })
    };
}

async function validate(document) {
    return createHarness().validator.validate(document);
}

async function assertValid(document) {
    const result = await validate(document);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(result.errors, []);
    return result;
}

async function assertInvalid(document, message) {
    const result = await validate(document);
    assert.equal(result.valid, false, message);
    assert.ok(Array.isArray(result.errors));
    assert.ok(result.errors.length > 0, "invalid results contain validation errors");
    return result;
}

function errorPaths(result) {
    return result.errors.map(error => error.path);
}

test("the canonical X-Schema V0 sample is valid", async () => {
    await assertValid(Sample);
});

test("required top-level properties are enforced", async () => {
    for (const property of ["version", "types", "root"]) {
        const document = structuredClone(Sample);
        delete document[property];
        await assertInvalid(document, `missing ${property} must be rejected`);
    }
});

test("unsupported X-Schema versions are rejected", async () => {
    const document = structuredClone(Sample);
    document.version = "1";
    await assertInvalid(document);
});

test("unknown element kinds are rejected", async () => {
    const document = structuredClone(Sample);
    document.types.Root.children[0].kind = "widget";
    await assertInvalid(document);
});

test("named object types reject occurrence-specific presentation properties", async () => {
    for (const [property, value] of Object.entries({
        tag: "x-panel",
        attrs: {},
        props: {},
        conditions: {}
    })) {
        const document = structuredClone(Sample);
        document.types.Address[property] = value;
        await assertInvalid(document, `types.Address.${property} must be rejected`);
    }
});

test("named object references require the object discriminator and type-only structure", async () => {
    await assertValid(documentWithChildren([
        { kind: "object", type: "Item", bind: "item", tag: "x-panel" }
    ], {
        Item: objectType()
    }));

    for (const reference of [
        { type: "Item" },
        { kind: "object" },
        { kind: "object", type: "Item", children: [] },
        { kind: "object", type: "Item", create: {} }
    ]) {
        await assertInvalid(
            documentWithChildren([reference], { Item: objectType() }),
            `invalid named object reference ${JSON.stringify(reference)} must be rejected`
        );
    }
});

test("invalid condition predicates are rejected", async () => {
    for (const condition of [
        { path: "$root.active", notEquals: true },
        { path: "$root.active", exists: false },
        { path: "$root.active", equals: true, exists: true },
        { path: "$root.status", in: [] }
    ]) {
        const document = structuredClone(Sample);
        document.types.Root.children[0].conditions.visible = condition;
        await assertInvalid(document, `condition ${JSON.stringify(condition)} must be rejected`);
    }
});

test("conditions expose only the V0 presentation states", async () => {
    for (const property of ["visible", "enabled", "readonly", "required"]) {
        const document = structuredClone(Sample);
        document.types.Root.children[0].conditions = {
            [property]: { path: "$root.active", equals: true }
        };
        await assertValid(document);
    }

    for (const property of ["hidden", "disabled"]) {
        const document = structuredClone(Sample);
        document.types.Root.children[0].conditions = {
            [property]: { path: "$root.active", equals: true }
        };
        await assertInvalid(document, `conditions.${property} must be rejected`);
    }
});

test("field references require a non-empty opaque string source", async () => {
    const referenceField = Sample.types.Root.children.find(element => element.reference);

    for (const source of ["$root.countries", "datasource:countries"]) {
        const document = structuredClone(Sample);
        const field = document.types.Root.children.find(element => element.bind === referenceField.bind);
        field.reference.source = source;
        await assertValid(document);
    }

    for (const source of ["", { kind: "entity", name: "Country" }]) {
        const document = structuredClone(Sample);
        const field = document.types.Root.children.find(element => element.bind === referenceField.bind);
        field.reference.source = source;
        await assertInvalid(document, `reference source ${JSON.stringify(source)} must be rejected`);
    }
});

test("containers cannot be used as array items", async () => {
    await assertInvalid(documentWithChildren([{
        kind: "array",
        bind: "items",
        item: { kind: "container", tag: "x-panel", children: [] }
    }]));
});

test("array editing options remain flat and retain their schema defaults", async () => {
    const document = documentWithChildren([{
        kind: "array",
        item: { kind: "field", dataType: "string" },
        allowAdd: true,
        allowRemove: false,
        allowMove: true,
        minItems: 1,
        maxItems: 3
    }]);
    await assertValid(document);

    document.types.Root.children[0].array = { allowAdd: true };
    await assertInvalid(document, "a nested array options wrapper must be rejected");

    const properties = XSchema.$defs.array.properties;
    assert.equal(properties.allowAdd.default, true);
    assert.equal(properties.allowRemove.default, true);
    assert.equal(properties.allowMove.default, false);
    assert.equal("arrayOptions" in XSchema.$defs, false);
});

test("nested arrays, inline objects, named objects, and containers are valid", async () => {
    const document = documentWithChildren([{
        kind: "container",
        tag: "x-panel",
        children: [{
            kind: "object",
            bind: "profile",
            children: [{
                kind: "array",
                bind: "groups",
                item: {
                    kind: "object",
                    children: [{
                        kind: "container",
                        tag: "x-panel",
                        children: [{ kind: "object", type: "Address", bind: "address" }]
                    }]
                }
            }]
        }]
    }, {
        kind: "array",
        bind: "matrix",
        item: {
            kind: "array",
            item: { kind: "field", dataType: "number" }
        }
    }], {
        Address: objectType([{ kind: "field", bind: "street", dataType: "string" }])
    });

    await assertValid(document);
});

test("an existing root type passes semantic validation", async () => {
    await assertValid(documentWithChildren([]));
});

test("an unknown root type reports an error at /root", async () => {
    const document = documentWithChildren([]);
    document.root = "Missing";

    const result = await assertInvalid(document);
    assert.ok(errorPaths(result).includes("/root"));
});

test("valid named object references pass semantic validation", async () => {
    await assertValid(documentWithChildren([
        { kind: "object", type: "Address" }
    ], {
        Address: objectType()
    }));
});

test("unknown named object types report the reference's /type path", async () => {
    const result = await assertInvalid(documentWithChildren([
        { kind: "object", type: "Missing" }
    ]));

    assert.ok(errorPaths(result).includes("/types/Root/children/0/type"));
});

test("unknown named types are found inside nested inline objects", async () => {
    const result = await assertInvalid(documentWithChildren([{
        kind: "object",
        children: [{ kind: "object", type: "Missing" }]
    }]));

    assert.ok(errorPaths(result).includes("/types/Root/children/0/children/0/type"));
});

test("unknown named types are found inside containers", async () => {
    const result = await assertInvalid(documentWithChildren([{
        kind: "container",
        tag: "x-panel",
        children: [{ kind: "object", type: "Missing" }]
    }]));

    assert.ok(errorPaths(result).includes("/types/Root/children/0/children/0/type"));
});

test("unknown named types are found in array items", async () => {
    const result = await assertInvalid(documentWithChildren([{
        kind: "array",
        item: { kind: "object", type: "Missing" }
    }]));

    assert.ok(errorPaths(result).includes("/types/Root/children/0/item/type"));
});

test("unused named type definitions are semantically validated", async () => {
    const result = await assertInvalid(documentWithChildren([], {
        Unused: objectType([{ kind: "object", type: "Missing" }])
    }));

    assert.ok(errorPaths(result).includes("/types/Unused/children/0/type"));
});

test("array minimums below or equal to maximums are valid", async () => {
    for (const [minItems, maxItems] of [[1, 2], [2, 2]]) {
        await assertValid(documentWithChildren([{
            kind: "array",
            minItems,
            maxItems,
            item: { kind: "field" }
        }]));
    }
});

test("array minimums above maximums report an error at /minItems", async () => {
    const result = await assertInvalid(documentWithChildren([{
        kind: "array",
        minItems: 3,
        maxItems: 2,
        item: { kind: "field" }
    }]));

    assert.ok(errorPaths(result).includes("/types/Root/children/0/minItems"));
});

test("invalid bounds are found in nested arrays", async () => {
    const result = await assertInvalid(documentWithChildren([{
        kind: "array",
        item: {
            kind: "array",
            minItems: 2,
            maxItems: 1,
            item: { kind: "field" }
        }
    }]));

    assert.ok(errorPaths(result).includes("/types/Root/children/0/item/minItems"));
});

test("direct recursive named object references are valid", async () => {
    await assertValid(documentWithChildren([
        { kind: "object", type: "Root", bind: "child" }
    ]));
});

test("indirect recursive named object references are valid", async () => {
    await assertValid(documentWithChildren([
        { kind: "object", type: "Branch" }
    ], {
        Branch: objectType([{ kind: "object", type: "Root" }])
    }));
});

test("validation results expose valid and errors", async () => {
    const validResult = await validate(documentWithChildren([]));
    assert.equal(validResult.valid, true);
    assert.deepEqual(validResult.errors, []);

    const invalidDocument = documentWithChildren([]);
    invalidDocument.root = "Missing";
    const invalidResult = await validate(invalidDocument);
    assert.equal(invalidResult.valid, false);
    assert.ok(Array.isArray(invalidResult.errors));
    assert.ok(invalidResult.errors.length > 0);
});

test("multiple independent semantic errors are reported together", async () => {
    const document = documentWithChildren([
        { kind: "object", type: "Missing" },
        { kind: "array", minItems: 2, maxItems: 1, item: { kind: "field" } }
    ]);
    document.root = "AlsoMissing";

    const result = await assertInvalid(document);
    assert.deepEqual(errorPaths(result), [
        "/root",
        "/types/Root/children/0/type",
        "/types/Root/children/1/minItems"
    ]);
});

test("semantic validation is skipped when structural validation fails", async () => {
    const structuralResult = {
        valid: false,
        errors: [{ path: "/version", message: "Invalid version." }]
    };
    const jsonValidator = {
        validate(data, schema) {
            assert.equal(data, null);
            assert.equal(schema, XSchema);
            return structuralResult;
        }
    };
    const { validator } = createHarness(jsonValidator);

    assert.equal(await validator.validate(null), structuralResult);
});

test("validation does not mutate the input document", async () => {
    const document = structuredClone(Sample);
    const before = structuredClone(document);

    await assertValid(document);

    assert.deepEqual(document, before);
});

test("the canonical schema is requested once and cached across sequential validations", async () => {
    const { validator, requests } = createHarness();

    await validator.validate(documentWithChildren([]));
    await validator.validate(documentWithChildren([{ kind: "field", bind: "name" }]));

    assert.deepEqual(requests, ["schema:x-schema"]);
});
