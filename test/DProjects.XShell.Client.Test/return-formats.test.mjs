import assert from "node:assert/strict";
import test from "node:test";

import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import { Validator } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/vendor/json-schema/4.1.1/json-schema.js";

const validateReturn = (returns, types = {}) => {
    const validator = new Validator(ContractSchema, "2020-12");
    return validator.validate({ types, methods: { execute: { returns } } });
};

test("return contracts accept standardized semantic formats and ordinary structured results", () => {
    for (const returns of [
        { type: "string", format: "text" },
        { type: "string", format: "url" },
        { type: "string", format: "blob-url" },
        { type: "object" }
    ]) {
        assert.equal(validateReturn(returns).valid, true, JSON.stringify(returns));
    }
});

test("return contracts reject unknown formats and incompatible direct types", () => {
    assert.equal(validateReturn({ type: "string", format: "unsupported" }).valid, false);
    assert.equal(validateReturn({ type: "object", format: "url" }).valid, false);
});

test("return formats coexist with named string types without changing valueType", () => {
    assert.equal(validateReturn({ ref: "resourceUrl", format: "url" }, { resourceUrl: { type: "string" } }).valid, true);
    assert.deepEqual(ContractSchema.$defs.valueType.enum,
        ["string", "number", "integer", "boolean", "object", "array", "function", "date", "any"]);
});
