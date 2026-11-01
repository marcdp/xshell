//import ComponentSchema from "../schemas/component.schema.json" with { type: "json" };
import JsonValidator from "../services/json-validator.js"
import xshell from "../xshell.js"

// export
export default async function validatePage(src, definition) {
    // validate

    // use loader to load schema
    debugger
    const componentSchema = await xshell.loader.load("schema:page");

    debugger;
    const definitionObject = Object.fromEntries(Object.entries(definition).map(([key, value]) => [key, typeof value === "function" ? {} : value]));

    const result = new JsonValidator().validate(definitionObject, componentSchema);
    if (!result.valid) {
        console.error(`Invalid component: ${src}`, result.errors);
        throw new Error(`Invalid component: ${src}`, { cause: result.errors });
    }
}