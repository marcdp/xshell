const PROVIDER_RESULT_PROPERTIES = new Set(["id", "label", "description", "icon", "category", "href", "open", "tags"]);
const OPEN_MODES = new Set(["top", "stack", "dialog", "dock"]);

export default class Search {

    // options schema
    static optionsSchema = {
        type: "object",
        required: ["providers"],
        properties: {
            providers: {
                type: "object",
                propertyNames: {type: "string", minLength: 1},
                additionalProperties: {
                    type: "object",
                    required: ["label", "implementation"],
                    properties: {
                        label: {type: "string", minLength: 1},
                        description: {type: "string"},
                        icon: {type: "string"},
                        implementation: {type: "string", minLength: 1},
                        mode: {type: "string", enum: ["default", "explicit"]},
                        prefixes: {type: "array", items: {type: "string", minLength: 1, not: {pattern: "\\s"}}, uniqueItems: true},
                        options: {type: "object"}
                    },
                    additionalProperties: false
                }
            }
        },
        additionalProperties: false
    };

    // vars
    #loader;
    #services;
    #providers;
    #instances = new Map();

    // ctor
    constructor({loader, services}, options = {}) {
        // Retain immutable declarative provider definitions without materializing implementations.
        this.#loader = loader;
        this.#services = services;
        this.#providers = Object.freeze(Object.entries(options.providers || {}).map(([id, provider]) => Object.freeze({
            id,
            label: provider.label,
            ...(provider.description !== undefined ? {description: provider.description} : {}),
            ...(provider.icon !== undefined ? {icon: provider.icon} : {}),
            implementation: provider.implementation,
            mode: provider.mode || "default",
            ...this.#preparePrefixes(id, provider.prefixes),
            options: structuredClone(provider.options || {})
        })));
    }

    // methods
    listProviders() {
        // Return new frozen projections so callers never retain the internal implementation configuration.
        return Object.freeze(this.#providers.map(({id, label, description, icon, mode, prefixes}) => Object.freeze({
            id, label, ...(description !== undefined ? {description} : {}), ...(icon !== undefined ? {icon} : {}), mode, prefixes
        })));
    }
    async query(text, options = {}) {
        // Validate the complete public request before selecting or loading providers.
        const request = this.#validateQuery(text, options);
        this.#throwIfAborted(request.signal);
        const expression = this.#parseExpression(request.text);
        request.text = expression.text;
        // A standalone prefix selects providers for unfiltered discovery.
        if (!request.text && expression.providers === null) return {results: [], errors: []};

        // Keep configuration order for prefix matches and caller order for direct ID selection.
        const selected = expression.providers !== null
            ? expression.providers.filter(provider => request.providerIds === null || request.providerIds.includes(provider.id))
            : request.providerIds === null
                ? this.#providers.filter(provider => provider.mode === "default")
                : request.providerIds.map(id => this.#providers.find(provider => provider.id === id));
        // Execute providers concurrently while retaining configuration order in the aggregate response.
        const operation = Promise.all(selected.map(provider => this.#queryProvider(provider, request))).then(entries => {
            this.#throwIfAborted(request.signal);
            const errors = entries.filter(entry => entry.error).map(entry => entry.error);
            const candidates = entries.flatMap((entry, providerIndex) => (entry.results || []).map((result, resultIndex) => ({
                result, providerIndex, resultIndex, score: this.#getScore(result, request.text)
            })));

            // Keep provider-defined order within equal relevance and discard only duplicate provider-local identities.
            candidates.sort((left, right) => right.score - left.score || left.providerIndex - right.providerIndex || left.resultIndex - right.resultIndex ||
                left.result.providerId.localeCompare(right.result.providerId) || left.result.id.localeCompare(right.result.id));
            const seen = new Set();
            const results = [];
            for (const candidate of candidates) {
                const key = `${candidate.result.providerId}\u0000${candidate.result.id}`;
                if (seen.has(key)) continue;
                seen.add(key);
                results.push(candidate.result);
                if (results.length === request.limit) break;
            }
            return {results, errors};
        });
        return await this.#withCancellation(operation, request.signal);
    }

    // methods (private)
    #preparePrefixes(id, prefixes = []) {
        // Compile literal matches and enforce case-insensitive uniqueness with the same matching rules.
        if (!Array.isArray(prefixes)) throw new TypeError(`Search provider '${id}' prefixes must be an array.`);
        const copy = [...prefixes];
        const patterns = [];
        for (const prefix of copy) {
            if (typeof prefix !== "string" || !prefix || /\s/.test(prefix)) {
                throw new TypeError(`Search provider '${id}' prefixes must be non-empty strings without whitespace.`);
            }
            if (patterns.some(pattern => pattern.exec(prefix)?.[0] === prefix)) {
                throw new TypeError(`Search provider '${id}' has duplicate prefix '${prefix}'.`);
            }
            const literal = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            patterns.push(new RegExp("^" + literal, "iu"));
        }
        return {prefixes: Object.freeze(copy), prefixPatterns: patterns};
    }
    #parseExpression(text) {
        // Collect providers for the longest leading match in configuration order.
        let length = 0;
        let providers = [];
        for (const provider of this.#providers) {
            for (const pattern of provider.prefixPatterns) {
                const match = pattern.exec(text);
                if (!match || match[0].length < length) continue;
                if (match[0].length > length) providers = [];
                length = match[0].length;
                providers.push(provider);
            }
        }
        return length ? {text: text.slice(length).trim(), providers} : {text, providers: null};
    }
    #validateQuery(text, options) {
        // Keep input validation independent from provider loading and provider-owned behavior.
        if (typeof text !== "string") throw new TypeError("Search text must be a string.");
        if (!options || typeof options !== "object" || Array.isArray(options)) throw new TypeError("Search options must be an object.");
        const unexpected = Object.keys(options).find(name => !["providers", "limit", "signal"].includes(name));
        if (unexpected) throw new TypeError(`Unknown Search option '${unexpected}'.`);
        const limit = options.limit ?? 50;
        if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new RangeError("Search limit must be an integer from 1 through 200.");
        let providerIds = null;
        if (options.providers !== undefined) {
            if (!Array.isArray(options.providers)) throw new TypeError("Search providers must be an array of provider IDs.");
            providerIds = [...options.providers];
            if (providerIds.some(id => typeof id !== "string" || !id.trim())) throw new TypeError("Search provider IDs must be non-empty strings.");
            if (new Set(providerIds).size !== providerIds.length) throw new TypeError("Search provider IDs must be unique.");
            const unknown = providerIds.find(id => !this.#providers.some(provider => provider.id === id));
            if (unknown) throw new Error(`Unknown Search provider '${unknown}'.`);
        }
        const signal = options.signal;
        if (signal !== undefined && (!signal || typeof signal !== "object" || typeof signal.aborted !== "boolean" ||
            typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function")) {
            throw new TypeError("Search signal must be an AbortSignal.");
        }
        return {text: text.trim(), providerIds, limit, signal};
    }
    async #queryProvider(provider, request) {
        // Initialization is shared independently from any one query's cancellation signal.
        try {
            this.#throwIfAborted(request.signal);
            const instance = await this.#getProvider(provider);
            this.#throwIfAborted(request.signal);
            const values = await instance.query(request.text, {signal: request.signal, limit: request.limit});
            this.#throwIfAborted(request.signal);
            if (!Array.isArray(values)) throw new TypeError(`Search provider '${provider.id}' must return an array.`);
            return {results: values.map(value => this.#normalizeResult(provider.id, value))};
        } catch (error) {
            if (request.signal?.aborted) this.#throwIfAborted(request.signal);
            return {error: {providerId: provider.id, message: `Unable to search ${provider.label}.`}};
        }
    }
    async #getProvider(provider) {
        // Reuse either the completed instance or one in-flight construction and remove failures for later retry.
        if (this.#instances.has(provider.id)) return await this.#instances.get(provider.id);
        const creation = (async () => {
            const Implementation = await this.#loader.load(`esm:${provider.implementation}`);
            if (typeof Implementation !== "function") throw new TypeError(`Search provider '${provider.id}' implementation must export a class.`);
            const services = this.#services;
            const dependencies = new Proxy({}, {
                get(target, property) {
                    if (property === "services") return services;
                    return typeof property === "string" ? services.resolve(property) : undefined;
                }
            });
            const instance = new Implementation(dependencies, structuredClone(provider.options));
            if (!instance || typeof instance.query !== "function") throw new TypeError(`Search provider '${provider.id}' must implement query().`);
            return instance;
        })();
        this.#instances.set(provider.id, creation);
        try {
            const instance = await creation;
            if (this.#instances.get(provider.id) === creation) this.#instances.set(provider.id, instance);
            return instance;
        } catch (error) {
            if (this.#instances.get(provider.id) === creation) this.#instances.delete(provider.id);
            throw error;
        }
    }
    #normalizeResult(providerId, value) {
        // Accept only plain serializable navigation records from provider implementations.
        if (!value || typeof value !== "object" || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
            throw new TypeError(`Search provider '${providerId}' returned a non-object result.`);
        }
        const unexpected = Object.keys(value).find(name => !PROVIDER_RESULT_PROPERTIES.has(name));
        if (unexpected) throw new TypeError(`Search provider '${providerId}' returned unknown result property '${unexpected}'.`);
        for (const name of ["id", "label", "href"]) {
            if (typeof value[name] !== "string" || !value[name].trim()) throw new TypeError(`Search provider '${providerId}' result '${name}' must be a non-empty string.`);
        }
        for (const name of ["description", "icon", "category"]) {
            if (value[name] !== undefined && typeof value[name] !== "string") throw new TypeError(`Search provider '${providerId}' result '${name}' must be a string.`);
        }
        if (value.open !== undefined && !OPEN_MODES.has(value.open)) throw new TypeError(`Search provider '${providerId}' result has an invalid open mode.`);
        if (value.tags !== undefined && (!Array.isArray(value.tags) || value.tags.some(tag => typeof tag !== "string"))) {
            throw new TypeError(`Search provider '${providerId}' result tags must be an array of strings.`);
        }
        return {
            id: value.id.trim(), providerId, label: value.label.trim(), href: value.href.trim(),
            ...(value.description !== undefined ? {description: value.description} : {}),
            ...(value.icon !== undefined ? {icon: value.icon} : {}),
            ...(value.category !== undefined ? {category: value.category} : {}),
            ...(value.tags !== undefined ? {tags: [...value.tags]} : {}),
            open: value.open || "top"
        };
    }
    #getScore(result, text) {
        // Rank common result fields consistently while preserving provider order inside each relevance tier.
        if (!text) return 0;
        const query = text.toLowerCase();
        const id = result.id.toLowerCase();
        const label = result.label.toLowerCase();
        if (id === query || label === query) return 5;
        if (label.startsWith(query)) return 4;
        if (label.includes(query)) return 3;
        if ((result.description || "").toLowerCase().includes(query) || (result.tags || []).some(tag => tag.toLowerCase().includes(query))) return 2;
        return 1;
    }
    #throwIfAborted(signal) {
        // Preserve the AbortSignal's reason when available so cancellation never becomes a provider failure.
        if (!signal?.aborted) return;
        throw signal.reason ?? new DOMException("The Search query was aborted.", "AbortError");
    }
    async #withCancellation(operation, signal) {
        // Let a query reject promptly without canceling provider initialization shared by independent queries.
        if (!signal) return await operation;
        this.#throwIfAborted(signal);
        let onAbort;
        const canceled = new Promise((resolve, reject) => {
            onAbort = () => reject(signal.reason ?? new DOMException("The Search query was aborted.", "AbortError"));
            signal.addEventListener("abort", onAbort, {once: true});
        });
        try { return await Promise.race([operation, canceled]); }
        finally { signal.removeEventListener("abort", onAbort); }
    }
}
