// Select the most specific validation detail using the same conventions as Services.
function formatValidationFailure(errors) {
    const wrappers = new Set(["$ref", "anyOf", "oneOf", "allOf", "properties", "items", "false"]);
    const detail = errors?.findLast(error => error.instanceLocation && error.error && !wrappers.has(error.keyword)) ?? errors?.at(-1);
    return detail ? ` at '${detail.instanceLocation ?? "#"}': ${detail.error}` : "";
}

// Remove URL user information before a provider identifier reaches diagnostics.
function getDiagnosticUrl(url) {
    try {
        const parsed = new URL(url);
        if (!parsed.username && !parsed.password) return url;
        parsed.username = "";
        parsed.password = "";
        return parsed.href;
    } catch {
        return url;
    }
}

// Resolve the optional provider-owned credentials descriptor and compile its schema.
function getProviderCredentialsDefinition(jsonValidator, url, Implementation) {
    let credentialsDefinition;
    try {
        credentialsDefinition = Implementation?.credentialsDefinition;
    } catch (cause) {
        throw new Error(`Filesystem provider '${url}' has an invalid static credentialsDefinition: ${cause.message}`, {cause});
    }
    if (credentialsDefinition === undefined) return undefined;
    if (!credentialsDefinition || typeof credentialsDefinition !== "object" || Array.isArray(credentialsDefinition)) {
        throw new Error(`Filesystem provider '${url}' has an invalid static credentialsDefinition: expected an object.`);
    }

    let schema;
    try {
        schema = credentialsDefinition.schema;
    } catch (cause) {
        throw new Error(`Filesystem provider '${url}' has an invalid static credentialsDefinition.schema: ${cause.message}`, {cause});
    }
    if (schema === undefined) throw new Error(`Filesystem provider '${url}' must define static credentialsDefinition.schema.`);
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
        throw new Error(`Filesystem provider '${url}' has an invalid static credentialsDefinition.schema: expected a JSON Schema object.`);
    }

    // Compile the schema without treating absent raw-open credentials as a payload validation failure.
    try {
        jsonValidator.validate({}, schema);
    } catch (cause) {
        throw new Error(`Filesystem provider '${url}' has an invalid static credentialsDefinition.schema: ${cause.message}`, {cause});
    }
    return credentialsDefinition;
}

// Clone and validate supplied credentials at the internal provider-construction boundary.
function validateCredentials(jsonValidator, url, credentialsDefinition, credentials) {
    if (credentials === null || credentials === undefined) return null;
    if (credentialsDefinition === undefined) throw new Error(`Filesystem provider '${url}' does not support credentials.`);

    let copy;
    try {
        copy = structuredClone(credentials);
    } catch {
        // Do not surface clone diagnostics because they can contain credential material.
        throw new Error(`Filesystem provider '${url}' credentials cannot be cloned.`);
    }

    let result;
    try {
        result = jsonValidator.validate(copy, credentialsDefinition.schema);
    } catch (cause) {
        throw new Error(`Filesystem provider '${url}' has an invalid static credentialsDefinition.schema: ${cause.message}`, {cause});
    }
    if (!result.valid) {
        throw new Error(`Invalid Filesystem provider credentials for '${url}'${formatValidationFailure(result.errors)}.`, {cause: result.errors});
    }
    return copy;
}

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
        const diagnosticUrl = getDiagnosticUrl(url);
        if (!definition) throw new Error(`Filesystem provider not found: ${diagnosticUrl}`);

        const Implementation = await this.#importProvider(diagnosticUrl, definition);
        const optionsDefinition = this.#getProviderOptionsDefinition(diagnosticUrl, Implementation);
        const credentialsDefinition = getProviderCredentialsDefinition(this.#jsonValidator, diagnosticUrl, Implementation);
        const parsedOptions = this.#parseProviderUrl(url, diagnosticUrl, optionsDefinition);
        const options = this.#mergeProviderOptions(definition, parsedOptions);
        this.#validateProviderOptions(diagnosticUrl, optionsDefinition, options);
        const canonicalUrl = this.#getProviderUrl(diagnosticUrl, optionsDefinition, options);
        const cacheKey = this.#getCacheKey(canonicalUrl, Implementation);
        if (cacheKey !== null && this.#instances.has(cacheKey)) return await this.#instances.get(cacheKey);

        const creation = this.#createProvider(diagnosticUrl, options, Implementation, credentialsDefinition);
        if (cacheKey !== null) this.#instances.set(cacheKey, creation);
        try {
            const instance = await creation;
            if (cacheKey !== null && this.#instances.get(cacheKey) === creation) this.#instances.set(cacheKey, instance);
            return instance;
        } catch (error) {
            if (cacheKey !== null && this.#instances.get(cacheKey) === creation) this.#instances.delete(cacheKey);
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
    async #importProvider(url, definition) {
        // Import the implementation class before asking it to deserialize provider configuration.
        try {
            return (await import(definition.implementation)).default;
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' could not import implementation '${definition.implementation}': ${cause.message}`, {cause});
        }
    }
    #getProviderOptionsDefinition(url, Implementation) {
        // Resolve and validate the provider-owned options definition once per materialization.
        let optionsDefinition;
        try {
            optionsDefinition = Implementation?.optionsDefinition;
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' has an invalid static optionsDefinition: ${cause.message}`, {cause});
        }
        if (optionsDefinition === undefined) throw new Error(`Filesystem provider '${url}' must define a static optionsDefinition object.`);
        if (!optionsDefinition || typeof optionsDefinition !== "object" || Array.isArray(optionsDefinition)) {
            throw new Error(`Filesystem provider '${url}' has an invalid static optionsDefinition: expected an object.`);
        }
        return optionsDefinition;
    }
    #parseProviderUrl(url, diagnosticUrl, optionsDefinition) {
        // Require provider-owned URL deserialization to return one declarative options object.
        let parseUrl;
        try {
            parseUrl = optionsDefinition.parseUrl;
        } catch (cause) {
            throw new Error(`Filesystem provider '${diagnosticUrl}' has an invalid static optionsDefinition.parseUrl: ${cause.message}`, {cause});
        }
        if (parseUrl === undefined) throw new Error(`Filesystem provider '${diagnosticUrl}' must define static optionsDefinition.parseUrl().`);
        if (typeof parseUrl !== "function") throw new Error(`Filesystem provider '${diagnosticUrl}' has an invalid static optionsDefinition.parseUrl: expected a function.`);

        let options;
        try {
            options = optionsDefinition.parseUrl(url);
        } catch (cause) {
            throw new Error(`Filesystem provider '${diagnosticUrl}' static optionsDefinition.parseUrl() failed: ${cause.message}`, {cause});
        }
        if (!options || typeof options !== "object" || Array.isArray(options)) {
            throw new Error(`Filesystem provider '${diagnosticUrl}' static optionsDefinition.parseUrl() must return a non-null options object.`);
        }

        try {
            return structuredClone(options);
        } catch (cause) {
            throw new Error(`Filesystem provider '${diagnosticUrl}' static optionsDefinition.parseUrl() returned options that cannot be cloned: ${cause.message}`, {cause});
        }
    }
    #mergeProviderOptions(definition, parsedOptions) {
        // Merge private snapshots so URL-derived configuration wins without mutating authored defaults.
        return {...structuredClone(definition.options ?? {}), ...structuredClone(parsedOptions)};
    }
    #validateProviderOptions(url, optionsDefinition, options) {
        // Require the definition-owned configuration schema before URL projection or construction.
        let schema;
        try {
            schema = optionsDefinition.schema;
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' has an invalid static optionsDefinition.schema: ${cause.message}`, {cause});
        }
        if (schema === undefined) throw new Error(`Filesystem provider '${url}' must define static optionsDefinition.schema.`);
        if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
            throw new Error(`Filesystem provider '${url}' has an invalid static optionsDefinition.schema: expected a JSON Schema object.`);
        }

        // Validate the merged declarative configuration before projecting its canonical URL.
        let result;
        try {
            result = this.#jsonValidator.validate(options, schema);
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' has an invalid static optionsDefinition.schema: ${cause.message}`, {cause});
        }
        if (!result.valid) {
            throw new Error(`Invalid Filesystem provider options for '${url}'${formatValidationFailure(result.errors)}.`, {cause: result.errors});
        }
    }
    #getProviderUrl(url, optionsDefinition, options) {
        // Project validated configuration into the single canonical runtime URL.
        let getUrl;
        try {
            getUrl = optionsDefinition.getUrl;
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' has an invalid static optionsDefinition.getUrl: ${cause.message}`, {cause});
        }
        if (getUrl === undefined) throw new Error(`Filesystem provider '${url}' must define static optionsDefinition.getUrl().`);
        if (typeof getUrl !== "function") throw new Error(`Filesystem provider '${url}' has an invalid static optionsDefinition.getUrl: expected a function.`);

        let canonicalUrl;
        try {
            canonicalUrl = optionsDefinition.getUrl(structuredClone(options));
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' static optionsDefinition.getUrl() failed: ${cause.message}`, {cause});
        }
        if (typeof canonicalUrl !== "string" || !canonicalUrl.trim()) {
            throw new Error(`Filesystem provider '${url}' static optionsDefinition.getUrl() must return a non-empty string.`);
        }
        return canonicalUrl;
    }
    async #createProvider(url, options, Implementation, credentialsDefinition, credentials = null) {
        // Validate credentials separately before resolving dependencies or constructing the provider.
        const validatedCredentials = validateCredentials(this.#jsonValidator, url, credentialsDefinition, credentials);

        // Resolve provider dependencies lazily and construct from cloned options plus cloned credentials.
        const services = this.#services;
        const dependencies = new Proxy({}, {
            get(target, property) {
                if (property === "services") return services;
                return typeof property === "string" ? services.resolve(property) : undefined;
            }
        });
        return new Implementation(dependencies, structuredClone(options), validatedCredentials);
    }
    #getScheme(url) {
        // Treat provider identity as a domain URL and dispatch only by its normalized scheme.
        return url.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)?.[1].toLowerCase() ?? null;
    }
    #getCacheKey(url, Implementation) {
        // Raw URL opening uses provider-defined canonical URL identity; future named registrations may require separate registration identity.
        let getCacheKey;
        try {
            getCacheKey = Implementation?.getCacheKey;
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' has an invalid static getCacheKey: ${cause.message}`, {cause});
        }
        if (getCacheKey === undefined) return null;
        if (typeof getCacheKey !== "function") throw new Error(`Filesystem provider '${url}' has an invalid static getCacheKey: expected a function.`);
        let cacheKey;
        try {
            cacheKey = getCacheKey.call(Implementation, url);
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' static getCacheKey failed: ${cause.message}`, {cause});
        }
        if (cacheKey === null) return null;
        if (typeof cacheKey !== "string" || !cacheKey) {
            throw new Error(`Filesystem provider '${url}' static getCacheKey must return a non-empty string or null.`);
        }
        return cacheKey;
    }
}
