const JSON_TYPES = {
    string: "string",
    number: "number",
    integer: "integer",
    boolean: "boolean",
    object: "object",
    array: "array"
};

export default class Commands {

    // options schema
    static optionsSchema = {
        type: "object",
        properties: {},
        additionalProperties: false
    }

    // vars
    #loader;
    #tasks;
    #jsonValidator;
    #config;

    // ctor
    constructor({loader, tasks, jsonValidator, config}, options) {
        this.#loader = loader;
        this.#tasks = tasks;
        this.#jsonValidator = jsonValidator;
        this.#config = config || {xshell: {}, modules: {}};
    }

    // methods
    list(options = {}) {
        // Validate the small synchronous discovery filter surface.
        if (!options || typeof options !== "object" || Array.isArray(options)) throw new TypeError("Command list options must be an object");
        const unexpected = Object.keys(options).find(name => !["moduleId", "category", "query"].includes(name));
        if (unexpected) throw new TypeError(`Unknown Command list option '${unexpected}'`);
        for (const name of ["moduleId", "category", "query"]) {
            if (options[name] !== undefined && typeof options[name] !== "string") throw new TypeError(`Command list option '${name}' must be a string`);
        }

        // Filter independent inventory projections without resolving or loading Command implementations.
        const query = options.query?.toLowerCase();
        const items = this.#discover().filter(item => {
            if (options.moduleId !== undefined && item.moduleId !== options.moduleId) return false;
            if (options.category !== undefined && item.category !== options.category) return false;
            return !query || [item.id, item.label, item.description, ...item.tags].some(value => value.toLowerCase().includes(query));
        });
        return Object.freeze(items);
    }
    getInfo(id) {
        // Reuse the canonical discovery projection so lookup and listing cannot diverge.
        if (typeof id !== "string" || !id.trim()) throw new TypeError("Command id must be a non-empty string");
        return this.list().find(item => item.id === id) || null;
    }
    async run({id, args = {}, background = true} = {}) {
        if (typeof id !== "string" || !id.trim()) throw new TypeError("Command id must be a non-empty string");
        if (!args || typeof args !== "object" || Array.isArray(args)) throw new TypeError("Command arguments must be an object");
        if (typeof background !== "boolean") throw new TypeError("Command background must be a boolean");

        const Command = await this.#loader.load(`command:${id}`);
        if (typeof Command !== "function") throw new Error(`Invalid command '${id}': loader did not return a Command class.`);

        const contract = Command.contract;
        if (!contract?.execute) throw new Error(`Command '${id}' has no execute contract.`);

        const parameters = contract.execute.parameters || [];
        const duplicate = parameters.find((parameter, index) =>
            parameters.findIndex(candidate => candidate.name === parameter.name) !== index);
        if (duplicate) throw new Error(`Duplicate argument '${duplicate.name}' in Command '${id}' contract.`);

        const parameterNames = new Set(parameters.map(parameter => parameter.name));
        const unexpected = Object.keys(args).find(name => !parameterNames.has(name));
        if (unexpected) throw new Error(`Unknown argument '${unexpected}' for Command '${id}'.`);

        const positionalArgs = parameters.map(parameter => {
            const supplied = Object.hasOwn(args, parameter.name);
            if (!supplied && !Object.hasOwn(parameter, "default")) {
                if (parameter.required === true) throw new Error(`Missing required argument '${parameter.name}' for Command '${id}'.`);
                return undefined;
            }

            const value = supplied ? args[parameter.name] : structuredClone(parameter.default);
            this.#validateArgument(id, parameter, contract.types || {}, value);
            return value;
        });

        return this.#tasks.run({
            title: contract.label || id,
            description: contract.description || contract.execute.description || "",
            background,
            handler: async taskContext => {
                // construct and execute one Command after Task execution begins
                let command = null;
                let result;
                let executionError;
                try {
                    command = new Command({task: taskContext});
                    result = await command.execute(...positionalArgs);
                } catch (error) {
                    executionError = error;
                }

                // settle execution before asking the Command to dispose its owned resources
                let disposalError;
                try {
                    if (command) await command.dispose();
                } catch (error) {
                    disposalError = error;
                }

                // preserve cancellation status while retaining cleanup failures in diagnostics
                if (disposalError && taskContext.signal.aborted) {
                    console.error(`Failed to dispose Services scope for canceled Command '${id}'.`, disposalError);
                }
                if (executionError && disposalError) {
                    throw new AggregateError([executionError, disposalError], `Command '${id}' execution and Services scope disposal both failed.`);
                }
                if (executionError) throw executionError;
                if (disposalError) throw disposalError;
                return result;
            }
        });
    }

    #discover() {
        // Scan the same effective framework and module inventories used to register bootstrap Command resolver entries.
        const items = [];
        const sources = [["xshell", this.#config.xshell], ...Object.entries(this.#config.modules || {})];
        for (const [moduleId, module] of sources) {
            if (!module?.assets?.path) continue;
            const commandsPath = module.assets.path + "/commands/";
            for (const file of module.files || []) {
                if (!file.path.startsWith(commandsPath) || !file.path.endsWith(".js")) continue;
                const id = file.path.substring(commandsPath.length).replace(/\.js$/, "");
                const resource = file.resource?.type === "command" ? file.resource : {};
                items.push(Object.freeze({
                    id,
                    moduleId,
                    label: resource.label || "",
                    description: resource.description || "",
                    tags: Object.freeze([...(resource.tags || [])]),
                    category: resource.category || moduleId,
                    icon: resource.icon || "",
                    path: file.path,
                    size: file.size ?? 0
                }));
            }
        }
        items.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        return items;
    }
    #validateArgument(commandId, parameter, types, value) {
        const namedType = parameter.ref ? types[parameter.ref] : null;
        if (parameter.ref && !namedType) {
            throw new Error(`Unknown argument type '${parameter.ref}' for '${parameter.name}' in Command '${commandId}'.`);
        }

        const type = parameter.type || namedType?.type;
        if (!type) throw new Error(`Argument '${parameter.name}' in Command '${commandId}' has no type.`);

        if (type === "function") {
            if (typeof value !== "function") throw new TypeError(`Invalid argument '${parameter.name}' for Command '${commandId}': expected function.`);
            return;
        }
        const constraints = parameter.schema ?? namedType?.schema;
        if (type === "any" && constraints === undefined && parameter.enum === undefined) return;
        const schema = {
            allOf: [
                constraints === undefined ? true : structuredClone(constraints),
                type === "any" ? true : type === "date" ? {type: "string", format: "date"} : {type: JSON_TYPES[type]}
            ]
        };
        if (parameter.enum !== undefined) schema.allOf.push({enum: structuredClone(parameter.enum)});

        if (type !== "any" && type !== "date" && !JSON_TYPES[type]) {
            throw new Error(`Unsupported argument type '${type}' for '${parameter.name}' in Command '${commandId}'.`);
        }

        let result;
        try {
            result = this.#jsonValidator.validate(value, schema);
        } catch (error) {
            throw new TypeError(`Invalid argument '${parameter.name}' for Command '${commandId}'.`, {cause: error});
        }
        if (!result.valid) {
            throw new TypeError(`Invalid argument '${parameter.name}' for Command '${commandId}'.`, {cause: result.errors});
        }
    }
}
