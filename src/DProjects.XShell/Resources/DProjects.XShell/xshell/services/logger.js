export default class Logger {

    // Validate effective declarations before the service is constructed.
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

    // fields
    #dependencies;
    #options;
    #provider;

    // ctor
    constructor(dependencies, options = {}) {
        // Retain the service dependencies for provider construction during initialization.
        this.#dependencies = dependencies;
        this.#options = options;
    }

    // methods
    async init() {
        // Resolve only the selected declaration and pass through its effective options.
        const {provider: id, providers = {}} = this.#options;
        if (id == null) return;
        if (!Object.hasOwn(providers, id)) throw new Error(`Service 'logger' selects unknown provider '${id}'.`);
        const {implementation, options = {}} = providers[id];
        try {
            const Implementation = await this.#dependencies.loader.load(`esm:${implementation}`);
            if (typeof Implementation !== "function") throw new TypeError("Expected a default-exported class.");
            const provider = new Implementation(this.#dependencies, structuredClone(options));
            if (typeof provider.log !== "function") throw new TypeError("Expected a callable log() method.");
            this.#provider = provider;
        } catch (cause) {
            throw new Error(`Service 'logger' could not initialize provider '${id}' from '${implementation}': ${cause?.message ?? String(cause)}`, {cause});
        }
    }

    // Forward each call synchronously with the original arguments.
    trace(...args) { this.#log("trace", args); }
    debug(...args) { this.#log("debug", args); }
    info(...args) { this.#log("info", args); }
    warn(...args) { this.#log("warn", args); }
    error(...args) { this.#log("error", args); }

    #log(level, args) {
        // A synchronous provider failure must not interrupt the operation being logged.
        try {
            this.#provider?.log(level, ...args);
        } catch {}
    }
}
