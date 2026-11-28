export default class LogReader {

    // Validate effective declarations before service construction.
    static optionsSchema = {
        type: "object",
        properties: {
            provider: {type: ["string", "null"], default: null},
            providers: {
                type: "object",
                default: {},
                additionalProperties: {
                    type: "object",
                    required: ["implementation"],
                    properties: {
                        implementation: {type: "string", pattern: "\\S"},
                        options: {type: "object", default: {}}
                    },
                    additionalProperties: false
                }
            }
        },
        additionalProperties: false
    };

    #dependencies;
    #options;
    #provider;

    constructor(dependencies, options = {}) {
        // Retain the declarations until the first read or subscription.
        this.#dependencies = dependencies;
        this.#options = options;
    }

    async query(options = {}) {
        // Keep configuration failures distinct from provider operation failures.
        const provider = await this.#getProvider();
        try {
            return await provider.query(options);
        } catch (cause) {
            throw new Error(`Service 'logReader' query failed: ${cause?.message ?? String(cause)}`, {cause});
        }
    }

    async subscribe(callback) {
        // Validate the callback and normalize both synchronous and asynchronous registration.
        if (typeof callback !== "function") throw new TypeError("Service 'logReader' requires a subscription callback.");
        const provider = await this.#getProvider();
        try {
            const unsubscribe = await provider.subscribe(callback);
            if (typeof unsubscribe !== "function") throw new TypeError("Expected an unsubscribe function.");
            return unsubscribe;
        } catch (cause) {
            throw new Error(`Service 'logReader' subscription failed: ${cause?.message ?? String(cause)}`, {cause});
        }
    }

    async getCategories() {
        // Use the same lazy provider and operation error handling as queries.
        const provider = await this.#getProvider();
        try {
            return await provider.getCategories();
        } catch (cause) {
            throw new Error(`Service 'logReader' category discovery failed: ${cause?.message ?? String(cause)}`, {cause});
        }
    }

    async #getProvider() {
        // Share an in-flight initialization and keep successful initialization for later operations.
        const {provider: id, providers = {}} = this.#options;
        if (id == null) throw new Error("No reader provider is configured for service 'logReader'.");
        if (!Object.hasOwn(providers, id)) throw new Error(`Service 'logReader' selects unknown provider '${id}'.`);
        const pending = this.#provider ??= this.#createProvider(id, providers[id]);
        try {
            return await pending;
        } catch (error) {
            if (this.#provider === pending) this.#provider = undefined;
            throw error;
        }
    }

    async #createProvider(id, {implementation, options = {}}) {
        // Load the module-owned implementation with the normal ESM loader and service dependencies.
        const context = `provider '${id}' from '${implementation}'`;
        let Implementation, provider;
        try {
            Implementation = await this.#dependencies.loader.load(`esm:${implementation}`);
        } catch (cause) {
            throw new Error(`Service 'logReader' could not load ${context}: ${cause?.message ?? String(cause)}`, {cause});
        }
        if (typeof Implementation !== "function" || !Implementation.prototype) {
            throw new TypeError(`Service 'logReader' has an invalid implementation for ${context}. Expected a default-exported class.`);
        }
        try {
            provider = new Implementation(this.#dependencies, structuredClone(options));
        } catch (cause) {
            throw new Error(`Service 'logReader' could not initialize ${context}: ${cause?.message ?? String(cause)}`, {cause});
        }
        if (typeof provider.query !== "function" || typeof provider.subscribe !== "function" || typeof provider.getCategories !== "function") {
            throw new TypeError(`Service 'logReader' has an invalid implementation for ${context}. Expected callable query(), subscribe() and getCategories() methods.`);
        }
        return provider;
    }
}
