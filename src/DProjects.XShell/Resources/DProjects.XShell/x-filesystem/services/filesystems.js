

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
                        type: { type: "string", enum: ["file", "directory"] },
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
            }
        },
        additionalProperties: false
    };

    // fields
    #loader;
    #commands;

    // constructor
    constructor({loader}, options = {}) {
        // Store the Loader and snapshot configured file commands.
        this.#loader = loader;
        this.#commands = structuredClone(options.commands ?? []);
    }

    // properties
    get commands() {
        return structuredClone(this.#commands);
    }

    // methods
    async create(url) {
        // Create or resolve a Filesystem using the existing Resolver and Loader pipeline.
        if (typeof url !== "string" || !url.trim()) {
            throw new TypeError("Filesystem URL must be a non-empty string.");
        }

        return this.#loader.load(`filesystem:${url}`);
    }
}
