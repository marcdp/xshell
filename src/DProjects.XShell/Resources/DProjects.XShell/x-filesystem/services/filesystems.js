const DEFINITION_PREFIX = "x-filesystem:filesystem:";
const CREDENTIAL_PREFIX = "x-filesystem:credentials:";
const DEFINITION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const NAMED_SCHEME = "named";

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
                propertyNames: { pattern: "^(?!named$)[a-z][a-z0-9+.-]*$" },
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
    #bus;
    #jsonValidator;
    #preferences;
    #secrets;
    #services;
    #logger;
    #providers = new Map();
    #instances = new Map();
    #namedInstances = new Map();
    #commands;
    #editors;

    // constructor
    constructor({bus, config, jsonValidator, preferences, secrets, services, logger}, options = {}) {
        // Normalize the scheme-keyed provider configuration and resolve implementation URLs once.
        for (const [scheme, provider] of Object.entries(options.providers ?? {})) {
            if (scheme.toLowerCase() === NAMED_SCHEME) throw new Error(`Filesystem provider scheme is reserved: ${NAMED_SCHEME}`);
            const isAbsoluteUrl = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(provider.implementation);
            const definition = {implementation: isAbsoluteUrl ? provider.implementation
                : new URL(provider.implementation.replace(/^\/+/, ""), config.app.baseUrl).href};
            if (Object.hasOwn(provider, "options")) definition.options = structuredClone(provider.options);
            this.#providers.set(scheme.toLowerCase(), definition);
        }

        // Retain the owning Services context and snapshot configured Commands and editors.
        this.#bus = bus;
        this.#jsonValidator = jsonValidator;
        this.#preferences = preferences;
        this.#secrets = secrets;
        this.#services = services;
        this.#logger = logger;
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
    async listProviders() {
        // Import configured providers and expose only cloned schemas and authored defaults for management UI.
        return await Promise.all([...this.#providers.keys()].sort().map(async id => {
            const provider = this.#providers.get(id);
            const Implementation = await this.#importProvider(id, provider);
            const optionsDefinition = this.#getProviderOptionsDefinition(id, Implementation);
            const optionsSchema = this.#getProviderOptionsSchema(id, optionsDefinition);
            const credentialsDefinition = this.#getProviderCredentialsDefinition(id, Implementation);
            return {
                id,
                label: id,
                optionsSchema: structuredClone(optionsSchema),
                credentialsSchema: credentialsDefinition === undefined ? null : structuredClone(credentialsDefinition.schema),
                defaults: structuredClone(provider.options ?? {})
            };
        }));
    }
    async listDefinitions() {
        // Project Preferences records into sorted domain definitions without exposing storage metadata.
        const records = await this.#preferences.list(DEFINITION_PREFIX);
        return records.map(record => {
            const value = structuredClone(record.value);
            return {name: value.name, label: value.label, description: value.description ?? "", provider: value.provider, options: value.options};
        }).sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    }
    async getDefinition(name) {
        // Load one definition and its separately stored credentials for management editing.
        this.#validateDefinitionName(name);
        const stored = await this.#preferences.get(DEFINITION_PREFIX + name, null);
        if (stored === null) return null;

        const resolved = await this.#resolveDefinition(stored);
        const credentialsDefinition = this.#getProviderCredentialsDefinition(resolved.definition.provider, resolved.Implementation);
        let credentials = null;
        if (credentialsDefinition !== undefined) {
            const storedCredentials = await this.#secrets.get(CREDENTIAL_PREFIX + name);
            credentials = this.#validateCredentials(resolved.definition.provider, credentialsDefinition, storedCredentials);
        }
        return {...structuredClone(resolved.definition), credentials};
    }
    async saveDefinition(definition, credentials = undefined) {
        // Validate the registration and optional credentials before changing either persistence boundary.
        const resolved = await this.#resolveDefinition(definition);
        const credentialsDefinition = this.#getProviderCredentialsDefinition(resolved.definition.provider, resolved.Implementation);
        const validatedCredentials = credentials === undefined || credentials === null
            ? credentials : this.#validateCredentials(resolved.definition.provider, credentialsDefinition, credentials);

        // Establish interactive vault access before applying an explicitly requested credential operation.
        if (validatedCredentials !== undefined) {
            const credentialName = CREDENTIAL_PREFIX + resolved.definition.name;
            if (validatedCredentials === null) {
                if (await this.#secrets.has(credentialName)) {
                    await this.#secrets.get(credentialName);
                    await this.#secrets.delete(credentialName);
                }
            } else {
                await this.#secrets.get(credentialName);
                await this.#secrets.set(credentialName, validatedCredentials, {
                    label: `${resolved.definition.label} credentials`,
                    description: `Credentials for filesystem '${resolved.definition.name}'.`
                });
            }
        }

        // Persist only authored options and invalidate the runtime identity after every requested write succeeds.
        await this.#preferences.set(DEFINITION_PREFIX + resolved.definition.name, structuredClone(resolved.definition));
        this.#namedInstances.delete(resolved.definition.name);
        this.#notifyDefinitionsChanged(resolved.definition.name, "saved");
    }
    async removeDefinition(name) {
        // Remove deterministic credentials for an existing definition without resolving its provider.
        this.#validateDefinitionName(name);
        const stored = await this.#preferences.get(DEFINITION_PREFIX + name, null);
        if (stored !== null) {
            const credentialName = CREDENTIAL_PREFIX + name;
            if (await this.#secrets.has(credentialName)) {
                await this.#secrets.get(credentialName);
                await this.#secrets.delete(credentialName);
            }
        }

        // Delete the registration and invalidate its separate runtime identity.
        await this.#preferences.delete(DEFINITION_PREFIX + name);
        this.#namedInstances.delete(name);
        if (stored !== null) this.#notifyDefinitionsChanged(name, "removed");
    }
    async openNamed(name) {
        // Share all lookup and construction work by registration name, independently from raw URL cache identity.
        this.#validateDefinitionName(name);
        if (this.#namedInstances.has(name)) return await this.#namedInstances.get(name);

        const creation = (async () => {
            const stored = await this.#preferences.get(DEFINITION_PREFIX + name, null);
            if (stored === null) throw new Error(`Filesystem definition not found: ${name}`);
            const resolved = await this.#resolveDefinition(stored);
            const credentialsDefinition = this.#getProviderCredentialsDefinition(resolved.canonicalUrl, resolved.Implementation);
            const storedCredentials = credentialsDefinition === undefined ? undefined : await this.#secrets.get(CREDENTIAL_PREFIX + name);
            const credentials = this.#validateCredentials(resolved.canonicalUrl, credentialsDefinition, storedCredentials);
            return await this.#createProvider(resolved.definition.provider, resolved.canonicalUrl, resolved.options, resolved.Implementation, credentialsDefinition, credentials);
        })();
        this.#namedInstances.set(name, creation);
        try {
            const instance = await creation;
            if (this.#namedInstances.get(name) === creation) this.#namedInstances.set(name, instance);
            return instance;
        } catch (error) {
            if (this.#namedInstances.get(name) === creation) this.#namedInstances.delete(name);
            throw error;
        }
    }
    async open(url) {
        // Resolve and materialize the provider entirely within the Filesystems domain.
        if (typeof url !== "string" || !url.trim()) {
            throw new TypeError("Filesystem URL must be a non-empty string.");
        }
        const scheme = this.#getScheme(url);
        if (scheme === NAMED_SCHEME) {
            // Resolve named filesystem references through the existing registration boundary.
            return this.openNamed(url.substring(url.indexOf(":") + 1));
        }
        const definition = scheme ? this.#providers.get(scheme) : null;
        const diagnosticUrl = this.#getDiagnosticUrl(url);
        if (!definition) throw new Error(`Filesystem provider not found: ${diagnosticUrl}`);

        const Implementation = await this.#importProvider(scheme, definition, diagnosticUrl);
        const optionsDefinition = this.#getProviderOptionsDefinition(diagnosticUrl, Implementation);
        const credentialsDefinition = this.#getProviderCredentialsDefinition(diagnosticUrl, Implementation);
        const parsedOptions = this.#parseProviderUrl(url, diagnosticUrl, optionsDefinition);
        const options = this.#mergeProviderOptions(definition, parsedOptions);
        this.#validateProviderOptions(diagnosticUrl, optionsDefinition, options);
        const canonicalUrl = this.#getProviderUrl(diagnosticUrl, optionsDefinition, options);
        const cacheKey = this.#getCacheKey(canonicalUrl, Implementation);
        if (cacheKey !== null && this.#instances.has(cacheKey)) return await this.#instances.get(cacheKey);

        const creation = this.#createProvider(scheme, diagnosticUrl, options, Implementation, credentialsDefinition);
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
    #validateDefinitionName(name) {
        // Keep the storage-key suffix constrained by the public definition naming rule.
        if (typeof name !== "string" || !DEFINITION_NAME_PATTERN.test(name)) throw new TypeError("Filesystem definition name is invalid.");
    }
    #formatValidationFailure(errors) {
        // Select the most specific validation detail using the same conventions as Services.
        const wrappers = new Set(["$ref", "anyOf", "oneOf", "allOf", "properties", "items", "false"]);
        const detail = errors?.findLast(error => error.instanceLocation && error.error && !wrappers.has(error.keyword)) ?? errors?.at(-1);
        return detail ? ` at '${detail.instanceLocation ?? "#"}': ${detail.error}` : "";
    }
    #getDiagnosticUrl(url) {
        // Remove URL user information before a provider identifier reaches diagnostics.
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
    #getProviderCredentialsDefinition(url, Implementation) {
        // Resolve the optional provider-owned credentials descriptor and compile its schema.
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
            this.#jsonValidator.validate({}, schema);
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' has an invalid static credentialsDefinition.schema: ${cause.message}`, {cause});
        }
        return credentialsDefinition;
    }
    #validateCredentials(url, credentialsDefinition, credentials) {
        // Clone and validate supplied credentials at the internal provider-construction boundary.
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
            result = this.#jsonValidator.validate(copy, credentialsDefinition.schema);
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' has an invalid static credentialsDefinition.schema: ${cause.message}`, {cause});
        }
        if (!result.valid) {
            throw new Error(`Invalid Filesystem provider credentials for '${url}'${this.#formatValidationFailure(result.errors)}.`, {cause: result.errors});
        }
        return copy;
    }
    async #importProvider(providerId, definition, url = providerId) {
        // Import the implementation class before asking it to deserialize provider configuration.
        try {
            return (await import(definition.implementation)).default;
        } catch (cause) {
            this.#logger.error("Filesystems: provider import failed", {providerId});
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
    #getProviderOptionsSchema(url, optionsDefinition) {
        // Resolve and compile the provider-owned options schema without validating a partial defaults object.
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
        try {
            this.#jsonValidator.validate({}, schema);
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' has an invalid static optionsDefinition.schema: ${cause.message}`, {cause});
        }
        return schema;
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
        const schema = this.#getProviderOptionsSchema(url, optionsDefinition);

        // Validate the merged declarative configuration before projecting its canonical URL.
        let result;
        try {
            result = this.#jsonValidator.validate(options, schema);
        } catch (cause) {
            throw new Error(`Filesystem provider '${url}' has an invalid static optionsDefinition.schema: ${cause.message}`, {cause});
        }
        if (!result.valid) {
            throw new Error(`Invalid Filesystem provider options for '${url}'${this.#formatValidationFailure(result.errors)}.`, {cause: result.errors});
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
    async #createProvider(providerId, url, options, Implementation, credentialsDefinition, credentials = null) {
        // Validate credentials separately before resolving dependencies or constructing the provider.
        const validatedCredentials = this.#validateCredentials(url, credentialsDefinition, credentials);

        // Resolve provider dependencies lazily and construct from cloned options plus cloned credentials.
        const services = this.#services;
        const dependencies = new Proxy({}, {
            get(target, property) {
                if (property === "services") return services;
                return typeof property === "string" ? services.resolve(property) : undefined;
            }
        });
        // Log instance materialization with the scheme only. Provider errors can contain paths or credentials.
        try {
            const provider = new Implementation(dependencies, structuredClone(options), validatedCredentials);
            this.#logger.debug("Filesystems: provider initialized", {providerId});
            return provider;
        } catch (error) {
            this.#logger.error("Filesystems: provider initialization failed", {providerId});
            throw error;
        }
    }
    #getScheme(url) {
        // Treat provider identity as a domain URL and dispatch only by its normalized scheme.
        return url.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)?.[1].toLowerCase() ?? null;
    }
    #getCacheKey(url, Implementation) {
        // Raw URL opening uses provider-defined canonical URL identity independently from named registration identity.
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
    #notifyDefinitionsChanged(name, action) {
        // Keep committed persistence successful when a notification listener fails.
        try { this.#bus?.emit("filesystems:definitions-changed", {name, action}); }
        catch {
            this.#logger.warn("Filesystems: change notification failed", {action});
        }
    }
    async #resolveDefinition(definition) {
        // Normalize the persisted shape without mutating the caller or retaining non-domain fields.
        if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
            throw new TypeError("Filesystem definition must be a non-null object.");
        }
        if (typeof definition.name !== "string" || !DEFINITION_NAME_PATTERN.test(definition.name)) {
            throw new TypeError("Filesystem definition name is invalid.");
        }
        if (definition.label !== undefined && typeof definition.label !== "string") {
            throw new TypeError("Filesystem definition label must be a string.");
        }
        if (definition.description !== undefined && typeof definition.description !== "string") {
            throw new TypeError("Filesystem definition description must be a string.");
        }
        if (typeof definition.provider !== "string" || !definition.provider.trim()) {
            throw new TypeError("Filesystem definition provider must be a non-empty string.");
        }
        const sourceOptions = definition.options === undefined ? {} : definition.options;
        if (!sourceOptions || typeof sourceOptions !== "object" || Array.isArray(sourceOptions)) {
            throw new TypeError("Filesystem definition options must be a non-null object.");
        }

        let ownOptions;
        try {
            ownOptions = structuredClone(sourceOptions);
        } catch (cause) {
            throw new TypeError(`Filesystem definition options cannot be cloned: ${cause.message}`, {cause});
        }
        const provider = definition.provider.trim().toLowerCase();
        const normalized = {
            name: definition.name,
            label: definition.label?.trim() ? definition.label : definition.name,
            description: definition.description?.trim() || "",
            provider,
            options: ownOptions
        };

        // Validate effective options and require the canonical URL to dispatch back to the selected provider.
        const providerDefinition = this.#providers.get(provider);
        if (!providerDefinition) throw new Error(`Filesystem provider not found: ${provider}`);
        const Implementation = await this.#importProvider(provider, providerDefinition);
        const optionsDefinition = this.#getProviderOptionsDefinition(provider, Implementation);
        const options = this.#mergeProviderOptions(providerDefinition, ownOptions);
        this.#validateProviderOptions(provider, optionsDefinition, options);
        const canonicalUrl = this.#getProviderUrl(provider, optionsDefinition, options);
        if (this.#getScheme(canonicalUrl) !== provider) {
            throw new Error(`Filesystem provider '${provider}' generated a URL for a different provider: ${canonicalUrl}`);
        }
        return {definition: normalized, Implementation, options, canonicalUrl};
    }
}
