import DatasetSchema from "../schemas/dataset.schema.json" with { type: "json" };
import JsonValidator from "../services/json-validator.js"

// export
export default async function validateDataset(src, definition) {
    // validate
    const result = new JsonValidator().validate(definition, DatasetSchema);
    if (!result.valid) {
        console.error(`Invalid dataset: ${src}`, result.errors);
        throw new Error(`Invalid dataset: ${src}`, { cause: result.errors });
    }
}
