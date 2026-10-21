import { Validator } from "../vendor/json-schema/4.1.1/json-schema.js";

export default class JsonValidator {

    validate(data, schema) {
        const validator = new Validator(schema, "2020-12");
        return validator.validate(data);
    }

    assert(data, schema) {
        const result = this.validate(data, schema);

        if (!result.valid) {
            throw new Error("JSON Schema validation failed", {
                cause: result.errors
            });
        }

        return data;
    }
}