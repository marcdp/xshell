
export default class XSchemaValidator {

    // vars
    _jsonValidator = null;
    _loader = null;
    _schema = null;

    // constructor
    constructor({ jsonValidator, loader }) {
        this._jsonValidator = jsonValidator;
        this._loader = loader;
    }

    // methods
    async validate(data) {

        // load canonical X-Schema definition once
        this._schema ??= await this._loader.load("schema:x-schema");

        // phase 1: structural validation
        const result = this._jsonValidator.validate(data, this._schema);

        if (!result.valid) {
            return result;
        }

        // phase 1: semantic validation
        const errors = [];
        const types = data.types;

        const addError = (path, message) => {
            errors.push({ path, message });
        };

        const escapePath = value =>
            String(value).replace(/~/g, "~0").replace(/\//g, "~1");

        // validate root type
        if (!Object.hasOwn(types, data.root)) {
            addError(
                "/root",
                `Unknown root type '${data.root}'.`
            );
        }

        // recursively validate elements
        const validateElement = (element, path) => {
            switch (element.kind) {

                case "object":
                    if (element.type !== undefined) {
                        if (!Object.hasOwn(types, element.type)) {
                            addError(
                                `${path}/type`,
                                `Unknown object type '${element.type}'.`
                            );
                        }
                    } else {
                        validateChildren(element.children, path);
                    }
                    break;

                case "array":
                    if (element.minItems !== undefined &&
                        element.maxItems !== undefined &&
                        element.minItems > element.maxItems) {

                        addError(
                            `${path}/minItems`,
                            "minItems cannot exceed maxItems."
                        );
                    }

                    validateElement(element.item, `${path}/item`);
                    break;

                case "container":
                    validateChildren(element.children, path);
                    break;

                case "field":
                    break;
            }
        };

        const validateChildren = (children, path) => {
            if (!children) return;

            children.forEach((element, index) => {
                validateElement(
                    element,
                    `${path}/children/${index}`
                );
            });
        };

        // validate all named type definitions
        for (const [name, definition] of Object.entries(types)) {
            validateChildren(
                definition.children,
                `/types/${escapePath(name)}`
            );
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
