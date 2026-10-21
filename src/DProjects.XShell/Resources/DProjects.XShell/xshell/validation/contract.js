import ContractSchema from "../schemas/contract.schema.json" with { type: "json" };
import JsonValidator from "../services/json-validator.js"

// export
export default async function validateContract(src, definition) {
    // validate
    const definitionObject = Object.fromEntries(Object.entries(definition).map(([key, value]) => [key, typeof value === "function" ? {} : value]));
    const result = new JsonValidator().validate(definitionObject, ContractSchema);
    if (!result.valid) {
        console.error(`Invalid contract: ${src}`, result.errors);
        throw new Error(`Invalid contract: ${src}`, { cause: result.errors });
    }
}