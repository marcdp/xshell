const JSON_TYPES = {
    string: "string",
    number: "number",
    integer: "integer",
    boolean: "boolean",
    object: "object",
    array: "array"
};

export default class Commands {
    _loader;
    _tasks;
    _jsonValidator;

    // ctor
    constructor({loader, tasks, jsonValidator}) {
        this._loader = loader;
        this._tasks = tasks;
        this._jsonValidator = jsonValidator;
    }

    // methods
    async run({id, args = {}, background = true} = {}) {
        if (typeof id !== "string" || !id.trim()) throw new TypeError("Command id must be a non-empty string");
        if (!args || typeof args !== "object" || Array.isArray(args)) throw new TypeError("Command arguments must be an object");
        if (typeof background !== "boolean") throw new TypeError("Command background must be a boolean");

        const Command = await this._loader.load(`command:${id}`);
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
            this._validateArgument(id, parameter, contract.types || {}, value);
            return value;
        });

        return this._tasks.run({
            title: contract.label || id,
            description: contract.description || contract.execute.description || "",
            background,
            handler: async taskContext => {
                const command = new Command({task: taskContext});
                return await command.execute(...positionalArgs);
            }
        });
    }

    _validateArgument(commandId, parameter, types, value) {
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
            result = this._jsonValidator.validate(value, schema);
        } catch (error) {
            throw new TypeError(`Invalid argument '${parameter.name}' for Command '${commandId}'.`, {cause: error});
        }
        if (!result.valid) {
            throw new TypeError(`Invalid argument '${parameter.name}' for Command '${commandId}'.`, {cause: result.errors});
        }
    }
}
