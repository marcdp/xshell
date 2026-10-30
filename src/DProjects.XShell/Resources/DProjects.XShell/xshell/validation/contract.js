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

    // resolve contract-local named type references after structural validation
    const references = [];
    for (const [name, descriptor] of Object.entries(definitionObject.properties || {})) {
        references.push([descriptor, `properties.${name}.ref`]);
    }
    for (const [methodName, method] of Object.entries(definitionObject.methods || {})) {
        for (const [index, parameter] of (method.parameters || []).entries()) {
            references.push([parameter, `methods.${methodName}.parameters[${index}].ref`]);
        }
        if (method.returns) references.push([method.returns, `methods.${methodName}.returns.ref`]);
    }
    for (const [eventName, event] of Object.entries(definitionObject.events || {})) {
        for (const [name, descriptor] of Object.entries(event.detail || {})) {
            references.push([descriptor, `events.${eventName}.detail.${name}.ref`]);
        }
    }

    for (const [descriptor, location] of references) {
        if (descriptor.ref !== undefined && !Object.hasOwn(definitionObject.types || {}, descriptor.ref)) {
            const error = new Error(`Undefined type reference '${descriptor.ref}' at '${location}'.`);
            console.error(`Invalid contract: ${src}`, error.message);
            throw new Error(`Invalid contract: ${src}: ${error.message}`, { cause: error });
        }
    }
}
