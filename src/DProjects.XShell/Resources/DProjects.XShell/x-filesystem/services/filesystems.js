

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
                propertyNames: { minLength: 1 },
                additionalProperties: {
                    type: "object",
                    required: ["implementation"],
                    properties: {
                        implementation: { type: "string", minLength: 1 },
                        cache: { type: "boolean" },
                        cacheMode: { type: "string", enum: ["full", "path"] }
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
    #commands;
    #editors;

    // constructor
    constructor({loader, config}, options = {}) {
        // Translate domain provider configuration into internal instance-js Loader definitions.
        const providers = {};
        for (const [pattern, provider] of Object.entries(options.providers ?? {})) {
            const definition = { src: provider.implementation, loader: "instance-js" };
            if (Object.hasOwn(provider, "cache")) definition.cache = provider.cache;
            if (Object.hasOwn(provider, "cacheMode")) definition.cacheMode = provider.cacheMode;
            providers[pattern] = definition;
        }

        // Store the Loader, create the local provider matcher, and snapshot configured Commands and editors.
        this.#loader = loader;
        this.#providerResolver = loader._createResourcePatternResolver(config.app.baseUrl, providers);
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
        // Resolve the provider locally before handing its internal resource identity to Loader.
        if (typeof url !== "string" || !url.trim()) {
            throw new TypeError("Filesystem URL must be a non-empty string.");
        }

        const resource = `filesystem:${url}`;
        return this.#loader._loadResolved(resource, this.#providerResolver.resolve(url));
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
}
