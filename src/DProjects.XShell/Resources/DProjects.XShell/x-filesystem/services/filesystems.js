export default class Filesystems {

    // options schema
    static optionsSchema = {
        type: "object",
        properties: {
            commands: {
                type: "array",
                items: {
                    type: "object",
                    required: ["id", "label", "type"],
                    properties: {
                        id: { type: "string", minLength: 1 },
                        label: { type: "string", minLength: 1 },
                        icon: { type: "string" },
                        type: { type: "string", enum: ["file", "directory", "entry"] },
                        extensions: {
                            type: "array",
                            items: { type: "string", minLength: 1 },
                        },
                        actions: {
                            type: "array",
                            items: { type: "string", minLength: 1 },
                            uniqueItems: true
                        }
                    },
                    additionalProperties: false
                }
            },
            editors: {
                type: "object",
                propertyNames: { minLength: 1 },
                additionalProperties: {
                    type: "object",
                    required: ["page", "label", "extensions"],
                    properties: {
                        page: { type: "string", minLength: 1 },
                        label: { type: "string", minLength: 1 },
                        icon: { type: "string" },
                        extensions: {
                            type: "array",
                            minItems: 1,
                            items: { type: "string", minLength: 1, pattern: "^[A-Za-z0-9]+(?:\\.[A-Za-z0-9]+)*$" },
                            uniqueItems: true
                        }
                    },
                    additionalProperties: false
                }
            },
            providers: {
                type: "object",
                propertyNames: { pattern: "^[a-z][a-z0-9+.-]*$" },
                additionalProperties: {
                    type: "object",
                    required: ["implementation"],
                    properties: {
                        implementation: { type: "string", minLength: 1 },
                        cache: { type: "boolean" },
                        cacheAnonymous: { type: "boolean" },
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
    #commands;
    #editors;

    // constructor
    constructor({config, jsonValidator, services}, options = {}) {
        // Normalize the scheme-keyed provider configuration and resolve implementation URLs once.
        for (const [scheme, provider] of Object.entries(options.providers ?? {})) {
            const isAbsoluteUrl = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(provider.implementation);
            const definition = {implementation: isAbsoluteUrl ? provider.implementation
                : new URL(provider.implementation.replace(/^\/+/, ""), config.app.baseUrl).href};
            if (Object.hasOwn(provider, "cache")) definition.cache = provider.cache;
            if (Object.hasOwn(provider, "cacheAnonymous")) definition.cacheAnonymous = provider.cacheAnonymous;
            if (Object.hasOwn(provider, "cacheMode")) definition.cacheMode = provider.cacheMode;
            if (Object.hasOwn(provider, "options")) definition.options = structuredClone(provider.options);
            this.#providers.set(scheme.toLowerCase(), definition);
        }

        // Retain the owning Services context and snapshot configured Commands and editors.
        this.#jsonValidator = jsonValidator;
        this.#services = services;
        this.#commands = structuredClone(options.commands ?? []);
        this.#editors = structuredClone(options.editors ?? {});
    }

    // properties
    get commands() {
        return structuredClone(this.#commands);
    }
    get editors() {
        return structuredClone(this.#editors);
    }

    // methods
    async open(url) {
        // Resolve and materialize the provider entirely within the Filesystems domain.
        if (typeof url !== "string" || !url.trim()) {
            throw new TypeError("Filesystem URL must be a non-empty string.");
        }
        const scheme = this.#getScheme(url);
        const definition = scheme ? this.#providers.get(scheme) : null;
        if (!definition) throw new Error(`Filesystem provider not found: ${url}`);

        const shouldCache = definition.cache && (!this.#isAnonymousUrl(url, scheme) || definition.cacheAnonymous !== false);
        const cacheKey = this.#getCacheKey(url, definition);
        if (shouldCache && this.#instances.has(cacheKey)) return await this.#instances.get(cacheKey);

        const creation = this.#createProvider(url, definition);
        if (shouldCache) this.#instances.set(cacheKey, creation);
        try {
            const instance = await creation;
            if (shouldCache && this.#instances.get(cacheKey) === creation) this.#instances.set(cacheKey, instance);
            return instance;
        } catch (error) {
            if (shouldCache && this.#instances.get(cacheKey) === creation) this.#instances.delete(cacheKey);
            throw error;
        }
    }
    getEditor(path) {
        // Select the longest real extension match, then use the stable editor ID to break ties.
        if (typeof path !== "string" || !path) return null;
        const normalizedPath = path.toLowerCase();
        const matches = [];
        for (const [id, editor] of Object.entries(this.#editors)) {
            for (const extension of editor.extensions) {
                if (normalizedPath.endsWith(`.${extension.toLowerCase()}`)) matches.push({ id, extension, editor });
            }
        }
        matches.sort((a, b) => b.extension.length - a.extension.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        return matches.length ? structuredClone(matches[0].editor) : null;
    }

    // private methods
    async #createProvider(url, definition) {
        // Import the implementation and require its implementation-owned options schema.
        let module;
        try {
            module = await import(definition.implementation);
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' could not import implementation '${definition.implementation}': ${cause.message}`, {cause});
        }
        const Implementation = module.default;
        let schema;
        try {
            schema = Implementation?.optionsSchema;
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' has an invalid static optionsSchema: ${cause.message}`, {cause});
        }
        if (schema === undefined) throw new Error(`Filesystem provider '${url}' must define a static optionsSchema object.`);
        if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
            throw new Error(`Filesystem provider '${url}' has an invalid static optionsSchema: expected a JSON Schema object.`);
        }

        // Validate a private authored-options snapshot before adding the domain-owned URL.
        const options = structuredClone(definition.options ?? {});
        let result;
        try {
            result = this.#jsonValidator.validate(options, schema);
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' has an invalid static optionsSchema: ${cause.message}`, {cause});
        }
        if (!result.valid) {
            throw new Error(`Invalid Filesystem provider options for '${url}'${this.#formatValidationFailure(result.errors)}.`, {cause: result.errors});
        }

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
    #isAnonymousUrl(url, scheme) {
        // Ignore query and fragment state when identifying the scheme-only provider identity.
        const fragmentIndex = url.indexOf("#");
        if (fragmentIndex !== -1) url = url.substring(0, fragmentIndex);
        const queryIndex = url.indexOf("?");
        if (queryIndex !== -1) url = url.substring(0, queryIndex);
        return url.toLowerCase() === `${scheme}:`;
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
