//import ComponentSchema from "../schemas/component.schema.json" with { type: "json" };
import JsonValidator from "../services/json-validator.js"
import xshell from "../xshell.js"

// export
export default async function validateComponent(src, definition) {
    // validate
    const definitionObject = Object.fromEntries(Object.entries(definition).map(([key, value]) => [key, typeof value === "function" ? {} : value]));

    // use loader to load schema
    const componentSchema = await xshell.loader.load("schema:component");
    const result = new JsonValidator().validate(definitionObject, componentSchema);
    if (!result.valid) {
        console.error(`Invalid component: ${src}`, result.errors);
        throw new Error(`Invalid component: ${src}`, { cause: result.errors });
    }

    //  validate contract of the component
    const contractComponentSchema = await xshell.loader.load("schema:contract.component");
    const contractResult = new JsonValidator().validate(definitionObject.contract, contractComponentSchema);
    if (!contractResult.valid) {
        console.error(`Invalid component contract: ${src}`, contractResult.errors);
        throw new Error(`Invalid component contract: ${src}`, { cause: contractResult.errors });
    }

}