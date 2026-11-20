import assert from "node:assert/strict";
import test from "node:test";

import CommandSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/command.schema.json" with { type: "json" };
import ComponentSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/component.schema.json" with { type: "json" };
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import PageSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/page.schema.json" with { type: "json" };
import ServiceSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/service.schema.json" with { type: "json" };
import { Validator } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/vendor/json-schema/4.1.1/json-schema.js";

function validator(schema) {
    const value = new Validator(schema, "2020-12");
    if (schema !== ContractSchema) value.addSchema(ContractSchema, new URL("./contract.schema.json", schema.$id).href);
    return value;
}

const definitions = [
    ["contract", ContractSchema, tags => ({ tags })],
    ["Component", ComponentSchema, tags => ({ contract: { tags } })],
    ["Page", PageSchema, tags => ({ contract: { tags } })],
    ["Command", CommandSchema, tags => ({ contract: { tags, execute: {} }, controller: {} })],
    ["Service", ServiceSchema, tags => ({ tags })]
];

test("public contract schemas accept optional ordered tags and empty arrays", () => {
    for (const [name, schema, definition] of definitions) {
        const validate = validator(schema);
        for (const tags of [[], ["ui"], ["data", "file-management", "cloud-storage"]]) {
            const result = validate.validate(definition(tags));
            assert.equal(result.valid, true, `${name}: ${JSON.stringify(result.errors)}`);
        }
    }
});

test("public contract schemas reject invalid tag types, values and duplicates", () => {
    const invalid = ["ui", [1], ["UI"], ["file management"], ["data", "data"], [""], ["data_analytics"]];
    for (const [name, schema, definition] of definitions) {
        const validate = validator(schema);
        for (const tags of invalid) {
            assert.equal(validate.validate(definition(tags)).valid, false, `${name}: ${JSON.stringify(tags)}`);
        }
    }
});

test("existing public definitions remain valid without tags", () => {
    for (const [name, schema, definition] of definitions) {
        const value = definition([]);
        if (value.contract) delete value.contract.tags;
        else delete value.tags;
        const result = validator(schema).validate(value);
        assert.equal(result.valid, true, `${name}: ${JSON.stringify(result.errors)}`);
    }
});
