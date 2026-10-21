import { Validator } from "../vendor/json-schema/4.1.1/json-schema.js";

export default class JsonValidator {

    // vars
    _validators = new WeakMap();

    // methods
    validate(data, schema) {
        let validator = this._validators.get(schema);

        if (!validator) {
            validator = new Validator(schema, "2020-12");
            this._validators.set(schema, validator);
        }

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
