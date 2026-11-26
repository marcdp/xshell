const filters = ["moduleId", "category", "query"];

export default class Queries {

    // options schema
    static optionsSchema = {type: "object", additionalProperties: false};

    // vars
    #loader;
    #jsonValidator;
    #config;

    // ctor
    constructor({loader, jsonValidator, config}) {
        this.#loader = loader;
        this.#jsonValidator = jsonValidator;
        this.#config = config;
    }

    // methods
    list(options = {}) {
        // Validate and apply the discovery filters without loading implementations.
        if (!options || typeof options !== "object" || Array.isArray(options)) throw new TypeError("Query list options must be an object.");
        const unexpected = Object.keys(options).find(name => !filters.includes(name));
        if (unexpected !== undefined) throw new TypeError(`Unknown Query list option '${unexpected}'.`);
        for (const name of filters) {
            if (options[name] !== undefined && typeof options[name] !== "string") throw new TypeError(`Query list option '${name}' must be a string.`);
        }
        const query = options.query?.toLowerCase();
        const items = this.#discover().filter(item => {
            if (options.moduleId !== undefined && item.moduleId !== options.moduleId) return false;
            if (options.category !== undefined && item.category !== options.category) return false;
            return !query || [item.id, item.label, item.description, ...item.tags].some(value => value.toLowerCase().includes(query));
        });
        return Object.freeze(items);
    }

    getInfo(id) {
        // Use the same projection as list() for exact identifier lookups.
        if (typeof id !== "string" || !id.trim()) throw new TypeError("Query id must be a non-empty string.");
        return this.list().find(item => item.id === id) ?? null;
    }

    async run(options = {}) {
        // Resolve the class and validate arguments before acquiring an invocation scope.
        if (!options || typeof options !== "object" || Array.isArray(options)) throw new TypeError("Query run options must be an object.");
        const unexpected = Object.keys(options).find(name => name !== "id" && name !== "args");
        if (unexpected !== undefined) throw new TypeError(`Unknown Query run option '${unexpected}'.`);
        const {id, args = {}} = options;
        if (typeof id !== "string" || !id.trim()) throw new TypeError("Query id must be a non-empty string.");
        if (!args || typeof args !== "object" || Array.isArray(args)) throw new TypeError("Query arguments must be an object.");

        const Query = await this.#loader.load(`query:${id}`);
        if (typeof Query !== "function") throw new Error(`Invalid query '${id}': loader did not return a Query class.`);
        const contract = Query.contract;
        if (!contract?.query?.returns) throw new Error(`Query '${id}' has no return contract.`);
        const types = contract.types ?? {};
        const positionalArgs = this.#bindArguments(id, contract.query.parameters ?? [], types, args);
        const returnType = this.#resolveType(id, "return value", contract.query.returns, types);

        // Await execution and return validation before releasing the owned scope.
        const invocation = new Query({id});
        const errors = [];
        let result;
        try {
            result = await invocation.query(...positionalArgs);
            this.#validateValue(id, "return value", result, returnType);
        } catch (error) {
            errors.push(error);
        }
        try {
            await invocation.dispose();
        } catch (error) {
            errors.push(error);
        }
        if (errors.length > 1) throw new AggregateError(errors, `Query '${id}' execution and Services scope disposal both failed.`);
        if (errors.length === 1) throw errors[0];
        return result;
    }

    #discover() {
        // Project the effective framework and module file inventories in Query ID order.
        const items = [];
        const sources = [["xshell", this.#config.xshell], ...Object.entries(this.#config.modules ?? {})];
        for (const [moduleId, module] of sources) {
            if (!module?.assets?.path) continue;
            const prefix = `${module.assets.path}/queries/`;
            for (const file of module.files ?? []) {
                if (!file.path.startsWith(prefix) || !file.path.endsWith(".js")) continue;
                const resource = file.resource?.type === "query" ? file.resource : {};
                items.push(Object.freeze({
                    id: file.path.slice(prefix.length, -".js".length),
                    moduleId,
                    label: resource.label ?? "",
                    description: resource.description ?? "",
                    tags: Object.freeze([...(resource.tags ?? [])]),
                    category: resource.category || moduleId,
                    icon: resource.icon ?? "",
                    path: file.path,
                    size: file.size ?? 0
                }));
            }
        }
        return items.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    }

    #bindArguments(id, parameters, types, args) {
        // Reject ambiguous declarations and names the contract does not accept.
        const names = new Set();
        for (const {name} of parameters) {
            if (names.has(name)) throw new Error(`Duplicate argument '${name}' in Query '${id}' contract.`);
            names.add(name);
        }
        const unexpected = Object.keys(args).find(name => !names.has(name));
        if (unexpected !== undefined) throw new Error(`Unknown argument '${unexpected}' for Query '${id}'.`);

        // Pass values in declaration order and clone defaults for each invocation.
        return parameters.map(parameter => {
            const {name} = parameter;
            const label = `argument '${name}'`;
            const descriptor = this.#resolveType(id, label, parameter, types);
            const supplied = Object.hasOwn(args, name);
            if (!supplied && !Object.hasOwn(parameter, "default")) {
                if (parameter.required === true) throw new Error(`Missing required ${label} for Query '${id}'.`);
                return undefined;
            }
            const value = supplied ? args[name] : structuredClone(parameter.default);
            this.#validateValue(id, label, value, descriptor);
            return value;
        });
    }

    #resolveType(id, label, descriptor, types) {
        // Resolve references only against own entries of the Query contract.
        const {ref} = descriptor;
        if (ref === undefined) return descriptor;
        if (!Object.hasOwn(types, ref)) throw new Error(`Unknown type '${ref}' for ${label} in Query '${id}'.`);
        return {...types[ref], enum: descriptor.enum};
    }

    #validateValue(id, label, value, {type, schema, enum: allowedValues}) {
        const message = `Invalid ${label} for Query '${id}'.`;
        if ((type === "function" && typeof value !== "function") || (type === "void" && value !== undefined)) throw new TypeError(message);

        // Keep authored constraints at the schema root so local references retain their meaning.
        const constraints = [];
        if (type === "date") constraints.push({type: "string", format: "date"});
        else if (!["any", "function", "void"].includes(type)) constraints.push({type});
        if (allowedValues !== undefined) constraints.push({enum: allowedValues});
        if (schema === false) constraints.push(false);
        if (constraints.length === 0 && (schema === undefined || schema === true)) return;
        const valueSchema = {...schema, allOf: [...(schema?.allOf ?? []), ...constraints]};

        let validation;
        try {
            validation = this.#jsonValidator.validate(value, valueSchema);
        } catch (error) {
            throw new TypeError(message, {cause: error});
        }
        if (!validation.valid) throw new TypeError(message, {cause: validation.errors});
    }
}
