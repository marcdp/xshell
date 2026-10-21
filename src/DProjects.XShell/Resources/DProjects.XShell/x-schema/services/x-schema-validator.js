
// export 
export default class XSchemaValidator {

    // vars
    _jsonValidator = null;
    _loader = null;

    // constructor
    constructor( { jsonValidator, loader } ) {
        this._jsonValidator = jsonValidator;
        this._loader = loader;
    }

    // methods
    async validate(schema) {
        // get x-schema
        const xSchema = await this._loader.load("schema:x-schema");
        // validate schema against x-schema
        let result = this._jsonValidator.validate(schema, xSchema);
        if (result.valid === false) {
            return result;
        }
        // if schema is valid against x-schema, continue with further validation if needed
        
        // ... TODO semantic validation

        // return
        return result;
    }

}
