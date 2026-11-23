
function formatValidationFailure(errors) {
    // Select the most specific validation detail using the same conventions as Services.
    const wrappers = new Set(["$ref", "anyOf", "oneOf", "allOf", "properties", "items", "false"]);
    const detail = errors?.findLast(error => error.instanceLocation && error.error && !wrappers.has(error.keyword)) ?? errors?.at(-1);
    if (!detail) return "";
    return ` at '${detail.instanceLocation ?? "#"}': ${detail.error}`;
}

//export
export default class LoaderInstanceJs {
    async load(src, context) {
        // Import the provider factory through its resolved physical module URL.
        const module = await import(src);
        const Provider = module.default;
        if (typeof Provider?.create !== "function") throw new TypeError(`Instance provider '${context.resource}' must expose static create().`);

        // Require a provider-owned JSON Schema before resolving services or constructing the instance.
        let schema;
        try {
            schema = Provider.optionsSchema;
        } catch (cause) {
            throw new Error(`Instance provider '${context.resource}' has an invalid static optionsSchema: ${cause.message}`, { cause });
        }
        if (schema === undefined) throw new Error(`Instance provider '${context.resource}' must define a static optionsSchema object.`);
        if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
            throw new Error(`Instance provider '${context.resource}' has an invalid static optionsSchema: expected a JSON Schema object.`);
        }

        // Resolve services lazily through the canonical runtime registry.
        const services = new Proxy({}, {
            get(target, property) {
                if (typeof property !== "string") return undefined;
                return context.services[property];
            }
        });

        // Validate a private options snapshot before invoking the provider factory.
        const options = structuredClone(context.resourceDefinition?.options ?? {});
        let optionsResult;
        try {
            optionsResult = services.jsonValidator.validate(options, schema);
        } catch (cause) {
            throw new Error(`Instance provider '${context.resource}' has an invalid static optionsSchema: ${cause.message}`, { cause });
        }
        if (!optionsResult.valid) {
            throw new Error(`Invalid provider options for '${context.resource}'${formatValidationFailure(optionsResult.errors)}.`, {
                cause: optionsResult.errors
            });
        }

        // Keep resource identity, runtime dependencies, and declarative configuration separate.
        const url = context.resource.substring(context.resource.indexOf(":") + 1);
        return Provider.create({ url, services, options });
    }
};
