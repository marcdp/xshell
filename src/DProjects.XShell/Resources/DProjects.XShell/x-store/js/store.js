function assertName(value, label) {
    // Require stable, non-empty string identifiers at the provider boundary.
    if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} must be a non-empty string`);
    return value;
}

function assertJson(value, path = "document", seen = new Set()) {
    // Reject values that structured cloning accepts but JSON documents cannot represent.
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") {
        if (!Number.isFinite(value)) throw new TypeError(`${path} contains a non-finite number`);
        return;
    }
    if (typeof value !== "object") throw new TypeError(`${path} contains a non-JSON value`);
    if (seen.has(value)) throw new TypeError(`${path} contains a circular reference`);
    seen.add(value);
    if (Array.isArray(value)) value.forEach((item, index) => assertJson(item, `${path}[${index}]`, seen));
    else {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path} must contain only plain JSON objects`);
        for (const [name, item] of Object.entries(value)) assertJson(item, `${path}.${name}`, seen);
    }
    seen.delete(value);
}

export function cloneDocument(document) {
    // Validate before cloning so unsupported values cannot be silently discarded.
    assertJson(document);
    if (!document || Array.isArray(document)) throw new TypeError("document must be a JSON object");
    return structuredClone(document);
}

export default class Store {
    constructor({ schema, schemaDefinition, jsonValidator } = {}) {
        // Validate and snapshot Store metadata once so providers and callers cannot mutate it.
        if (!schemaDefinition) throw new TypeError("schemaDefinition is required");
        if (!jsonValidator?.validate) throw new TypeError("jsonValidator with validate() is required");
        const result = jsonValidator.validate(schema, schemaDefinition);
        if (!result.valid) throw new Error("Invalid Store schema", { cause: result.errors });
        this._jsonValidator = jsonValidator;
        this._schema = structuredClone(schema);
    }

    get schema() {
        // Expose a defensive snapshot of the provider-independent Store description.
        return structuredClone(this._schema);
    }

    collection(collection) {
        // Resolve a declared collection and reject provider-specific implicit collections.
        assertName(collection, "collection");
        const definition = this._schema.collections[collection];
        if (!definition) throw new Error(`Unknown Store collection '${collection}'`);
        return definition;
    }

    validate(collection, document) {
        // Validate a JSON document against its collection schema without changing provider state.
        const definition = this.collection(collection);
        const copy = cloneDocument(document);
        const result = this._jsonValidator.validate(copy, definition.schema);
        if (!result.valid) throw new Error(`Invalid document for collection '${collection}'`, { cause: result.errors });
        return copy;
    }

    requireId(document) {
        // Keep identity semantics shared by all providers.
        return assertName(document?.id, "document.id");
    }

    async get(collection, id) {
        // Validate public arguments before reporting the unsupported provider operation.
        this.collection(collection); assertName(id, "id");
        throw new Error("get() must be implemented by a Store provider");
    }

    async list(collection) {
        // Validate public arguments before reporting the unsupported provider operation.
        this.collection(collection);
        throw new Error("list() must be implemented by a Store provider");
    }

    async add(collection, document) {
        // Validate public arguments before reporting the unsupported provider operation.
        this.validate(collection, document);
        throw new Error("add() must be implemented by a Store provider");
    }

    async save(collection, document) {
        // Validate public arguments before reporting the unsupported provider operation.
        this.requireId(document); this.validate(collection, document);
        throw new Error("save() must be implemented by a Store provider");
    }

    async remove(collection, id) {
        // Validate public arguments before reporting the unsupported provider operation.
        this.collection(collection); assertName(id, "id");
        throw new Error("remove() must be implemented by a Store provider");
    }
}
