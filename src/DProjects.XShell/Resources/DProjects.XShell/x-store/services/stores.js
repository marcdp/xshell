export default class Stores {

    // options schema
    static optionsSchema = {
        type: "object",
        properties: {
            providers: {
                type: "object",
                propertyNames: { pattern: "^[a-z][a-z0-9+.-]*$" },
                additionalProperties: {
                    type: "object",
                    required: ["implementation"],
                    properties: {
                        implementation: { type: "string", minLength: 1 },
                        cache: { type: "boolean" },
                        cacheMode: { type: "string", enum: ["full", "path"] },
                        options: { type: "object" }
                    },
                    additionalProperties: false
                }
            }
        },
        additionalProperties: false
    };

    // fields
    #jsonValidator;
    #services;
    #providers = new Map();
    #instances = new Map();

    // constructor
    constructor({config, jsonValidator, services}, options = {}) {
        // Normalize the scheme-keyed provider configuration and resolve implementation URLs once.
        for (const [scheme, provider] of Object.entries(options.providers ?? {})) {
            const isAbsoluteUrl = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(provider.implementation);
            const definition = {implementation: isAbsoluteUrl ? provider.implementation
                : new URL(provider.implementation.replace(/^\/+/, ""), config.app.baseUrl).href};
            if (Object.hasOwn(provider, "cache")) definition.cache = provider.cache;
            if (Object.hasOwn(provider, "cacheMode")) definition.cacheMode = provider.cacheMode;
            if (Object.hasOwn(provider, "options")) definition.options = structuredClone(provider.options);
            this.#providers.set(scheme.toLowerCase(), definition);
        }

        // Retain the owning Services context for lazy provider dependencies.
        this.#jsonValidator = jsonValidator;
        this.#services = services;
    }

    // methods
    async open(url) {
        // Resolve and materialize the provider entirely within the Stores domain.
        if (typeof url !== "string" || !url.trim()) throw new TypeError("Store URL must be a non-empty string.");
        const scheme = this.#getScheme(url);
        const definition = scheme ? this.#providers.get(scheme) : null;
        if (!definition) throw new Error(`Store provider not found: ${url}`);

        const cacheKey = this.#getCacheKey(url, definition);
        if (definition.cache && this.#instances.has(cacheKey)) return await this.#instances.get(cacheKey);

        const creation = this.#createProvider(url, definition);
        if (definition.cache) this.#instances.set(cacheKey, creation);
        try {
            const instance = await creation;
            if (definition.cache && this.#instances.get(cacheKey) === creation) this.#instances.set(cacheKey, instance);
            return instance;
        } catch (error) {
            if (definition.cache && this.#instances.get(cacheKey) === creation) this.#instances.delete(cacheKey);
            throw error;
        }
    }

    // private methods
    async #createProvider(url, definition) {
        // Import the implementation and require its implementation-owned options schema.
        let module;
        try {
            module = await import(definition.implementation);
        } catch (cause) {
            throw new Error(`Store provider '${url}' could not import implementation '${definition.implementation}': ${cause.message}`, {cause});
        }
        const Implementation = module.default;
        let schema;
        try {
            schema = Implementation?.optionsSchema;
        } catch (cause) {
            throw new Error(`Store provider '${url}' has an invalid static optionsSchema: ${cause.message}`, {cause});
        }
        if (schema === undefined) throw new Error(`Store provider '${url}' must define a static optionsSchema object.`);
        if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
            throw new Error(`Store provider '${url}' has an invalid static optionsSchema: expected a JSON Schema object.`);
        }

        // Validate a private authored-options snapshot before adding the domain-owned URL.
        const options = structuredClone(definition.options ?? {});
        let result;
        try {
            result = this.#jsonValidator.validate(options, schema);
        } catch (cause) {
            throw new Error(`Store provider '${url}' has an invalid static optionsSchema: ${cause.message}`, {cause});
        }
        if (!result.valid) throw new Error(`Invalid Store provider options for '${url}'${this.#formatValidationFailure(result.errors)}.`, {cause: result.errors});

        // Resolve provider dependencies lazily through this singleton's owning Services context.
        const services = this.#services;
        const dependencies = new Proxy({}, {
            get(target, property) {
                if (property === "services") return services;
                return typeof property === "string" ? services.resolve(property) : undefined;
            }
        });
        return new Implementation(dependencies, {...options, url});
    }
    #formatValidationFailure(errors) {
        // Select the most specific validation detail using the same conventions as Services.
        const wrappers = new Set(["$ref", "anyOf", "oneOf", "allOf", "properties", "items", "false"]);
        const detail = errors?.findLast(error => error.instanceLocation && error.error && !wrappers.has(error.keyword)) ?? errors?.at(-1);
        return detail ? ` at '${detail.instanceLocation ?? "#"}': ${detail.error}` : "";
    }
    #getScheme(url) {
        // Treat provider identity as a domain URL and dispatch only by its normalized scheme.
        return url.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)?.[1].toLowerCase() ?? null;
    }
    #getCacheKey(url, definition) {
        // Preserve the former Loader full/path provider identity behavior.
        const cacheMode = definition.cacheMode ?? "full";
        if (cacheMode === "full") return url;
        if (cacheMode === "path") {
            const queryIndex = url.indexOf("?");
            const fragmentIndex = url.indexOf("#");
            return queryIndex === -1 || (fragmentIndex !== -1 && queryIndex > fragmentIndex)
                ? url : url.substring(0, queryIndex) + (fragmentIndex === -1 ? "" : url.substring(fragmentIndex));
        }
        throw new Error(`Unsupported cache mode '${cacheMode}'.`);
    }
}
