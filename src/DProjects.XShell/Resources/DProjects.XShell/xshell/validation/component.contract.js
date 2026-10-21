import ComponentContractSchema from "../schemas/component.contract.schema.json" with { type: "json" };
import JsonValidator from "../services/json-validator.js"

// export
export default async function validateComponentContract(src, contract) {
    // validate
    const result = new JsonValidator().validate(contract, ComponentContractSchema);
    if (!result.valid) {
        console.error(`Invalid component contract: ${src}`, result.errors);
        throw new Error(`Invalid component contract: ${src}`, { cause: result.errors });
    }
}