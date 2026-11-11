import JsonValidator from "./services/json-validator.js";

export default class Registry {

    // vars
    _items = null;
    _config = null;
    _loader = null;
    _resolver = null;

    // ctor
    constructor({ config, loader, resolver }) {
        this._config = config;
        this._items = config.xshell.registry;
        this._loader = loader;
        this._resolver = resolver;
    }

    // props
    get registry() {
        return Object.freeze(Object.fromEntries(
            Object.entries(this._items).map(([name, item]) => [
                name,
                Object.freeze({
                    schema: item.schema,
                    contributions: item.contributions ?? []
                })
            ])
        ));
    }

    // methods
    async init() {
        const validator = new JsonValidator();
        for (const [name, item] of Object.entries(this._items)) {
            const schemaPath = item.schema;
            let schema;
            try {
                const resource = this._schemaResource(schemaPath);
                schema = await this._loader.load(resource);
            } catch (cause) {
                throw new Error(`Failed to load schema '${schemaPath}' for registry '${name}': ${cause.message}`, { cause });
            }

            for (const [index, contribution] of (item.contributions ?? []).entries()) {
                let result;
                try {
                    result = validator.validate(contribution, schema);
                } catch (cause) {
                    throw new Error(`Failed to validate contribution ${index} in registry '${name}' against schema '${schemaPath}': ${cause.message}`, { cause });
                }
                if (!result.valid) {
                    throw new Error(`Invalid contribution ${index} in registry '${name}' against schema '${schemaPath}': ${result.errors.map(error => error.error).join("; ")}`, { cause: result.errors });
                }
            }
        }
    }

    has(name) {
        return Object.hasOwn(this._items, name);
    }
    get(name) {
        return this._items[name];
    }

    _schemaResource(schemaPath) {
        if (typeof schemaPath !== "string" || !schemaPath.startsWith("/")) {
            throw new Error(`Unknown schema asset path '${schemaPath}'.`);
        }

        const owners = [
            ["xshell", this._config.xshell.assets.path],
            ...Object.entries(this._config.modules).map(([id, module]) => [id, module.assets.path])
        ];
        for (const [id, assetsPath] of owners) {
            if (!schemaPath.startsWith(assetsPath + "/")) continue;
            const relativePath = schemaPath.substring(assetsPath.length);
            if (relativePath.substring(1).split("/").some(segment => !segment || segment === "." || segment === "..")) break;
            const resources = id === "xshell"
                ? Object.entries(this._config.xshell.resolver.schema ?? {})
                    .filter(([, definition]) => definition.src === schemaPath && definition.loader === "schema-json")
                    .map(([name]) => `schema:${name}`)
                : [`schema:${id}:${relativePath}`];
            for (const resource of resources) {
                const resolved = this._resolver.resolve(resource);
                if (resolved?.path === schemaPath && resolved.definition.loader === "schema-json") return resource;
            }
            break;
        }
        throw new Error(`Unknown schema asset path '${schemaPath}'.`);
    }
}
