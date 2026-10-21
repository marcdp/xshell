import XSchemaSchema from "../schemas/x-schema.schema.json" with { type: "json" };
//import { Validator } from "../vendor/json-schema/4.1.1/json-schema.js"

// vars
//const validator = new Validator(XSchemaSchema, "2020-12");

// export
export default async function validateXSchema(src, definition) {
    // validate
    debugger;
    //const result = validator.validate(definition);
    //if (!result.valid) {
    //    console.error(`Invalid dataset: ${src}`, result.errors);
    //    throw new Error(`Invalid dataset: ${src}`, { cause: result.errors });
    //}
}
