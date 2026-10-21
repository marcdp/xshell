import ComponentSchema from "../schemas/component.schema.json" with { type: "json" };
import JsonValidator from "../services/json-validator.js"

// export
export default async function validateComponent(src, definition) {
    // validate
    const definitionObject = Object.fromEntries(Object.entries(definition).map(([key, value]) => [key, typeof value === "function" ? {} : value]));
    const result = new JsonValidator().validate(definitionObject, ComponentSchema);
    if (!result.valid) {
        console.error(`Invalid component: ${src}`, result.errors);
        throw new Error(`Invalid component: ${src}`, { cause: result.errors });
    }
}