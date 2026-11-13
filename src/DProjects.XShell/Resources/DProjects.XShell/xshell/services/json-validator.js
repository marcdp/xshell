import { Validator } from "../vendor/json-schema/4.1.1/json-schema.js";

export default class JsonValidator {

    // vars
    _validators = new WeakMap();

    // methods
    validate(data, schema, schemas) {
        // Compile a private mutable schema because the vendor validator annotates schema objects.
        let validator = this._validators.get(schema);
        if (!validator) {
            validator = new Validator(structuredClone(schema), "2020-12");
            this._validators.set(schema, validator);
        }

        // Clone referenced schemas too because addSchema() may annotate them.
        if (schemas) {
            for (const [path, referencedSchema] of Object.entries(schemas)) {
                validator.addSchema(structuredClone(referencedSchema), new URL(path, schema.$id).href);
            }
        }

        return validator.validate(data);
    }
    assert(data, schema) {
        const result = this.validate(data, schema);
        if (!result.valid) {
            throw new Error("JSON Schema validation failed", {cause: result.errors});
        }
        return data;
    }
}
