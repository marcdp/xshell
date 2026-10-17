import DatasetSchema from "../schemas/dataset.schema.json" with { type: "json" };
import { Validator } from "../vendor/json-schema/4.1.1/json-schema.js"

// vars
const validator = new Validator(DatasetSchema, "2020-12");

// export
export default async function validateDataset(src, definition) {
    // validate
    const definitionObject = Object.fromEntries(Object.entries(definition).map(([key, value]) => [key, typeof value === "function" ? {} : value]));
    const result = validator.validate(definitionObject);
    if (!result.valid) {
        console.error(`Invalid dataset: ${src}`, result.errors);
        throw new Error(`Invalid dataset: ${src}`, { cause: result.errors });
    }
}
