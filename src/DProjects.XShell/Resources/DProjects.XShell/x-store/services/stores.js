export default class Stores {

    // options schema
    static optionsSchema = {
        type: "object",
        properties: {
            providers: {
                type: "object",
                propertyNames: { minLength: 1 },
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
    #loader;
    #providerResolver;

    // constructor
    constructor({loader, config}, options = {}) {
        // Translate domain provider configuration into internal instance-js Loader definitions.
        const providers = {};
        for (const [pattern, provider] of Object.entries(options.providers ?? {})) {
            const definition = { src: provider.implementation, loader: "instance-js" };
            if (Object.hasOwn(provider, "cache")) definition.cache = provider.cache;
            if (Object.hasOwn(provider, "cacheMode")) definition.cacheMode = provider.cacheMode;
            if (Object.hasOwn(provider, "options")) definition.options = structuredClone(provider.options);
            providers[pattern] = definition;
        }

        // Store the Loader and create an isolated provider matcher.
        this.#loader = loader;
        this.#providerResolver = loader._createResourcePatternResolver(config.app.baseUrl, providers);
    }

    // methods
    async open(url) {
        // Resolve the provider locally before handing its complete internal resource identity to Loader.
        if (typeof url !== "string" || !url.trim()) throw new TypeError("Store URL must be a non-empty string.");
        const resource = `store:${url}`;
        return this.#loader._loadResolved(resource, this.#providerResolver.resolve(url));
    }
}
