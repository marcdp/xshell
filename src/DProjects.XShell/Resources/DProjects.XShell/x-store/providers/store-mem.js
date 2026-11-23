import StoreSchemaDefinition from "../schemas/store.schema.json" with { type: "json" };
import SampleStore from "../samples/store.json" with { type: "json" };
import Store, { cloneDocument } from "./store.js";

export default class MemoryStore extends Store {


    // options schema
    static optionsSchema = {
        type: "object",
        additionalProperties: false
    };


    // ctor
    constructor({ jsonValidator } = {}, {
        url = "mem:", schema = SampleStore.schema, documents = SampleStore.documents, schemaDefinition = StoreSchemaDefinition
    } = {}) {
        // Validate metadata before constructing collection Maps or accepting initial documents.
        super({ jsonValidator }, { schema, schemaDefinition });
        this.url = url;
        this._collections = new Map(Object.keys(this._schema.collections).map(name => [name, new Map()]));
        for (const [collection, values] of Object.entries(documents)) {
            this.collection(collection);
            if (!Array.isArray(values)) throw new TypeError(`Initial documents for '${collection}' must be an array`);
            for (const document of values) {
                const copy = this.validate(collection, document);
                const id = this.requireId(copy);
                const target = this._collections.get(collection);
                if (target.has(id)) throw new Error(`Duplicate document id '${id}' in collection '${collection}'`);
                target.set(id, copy);
            }
        }
    }

    async get(collection, id) {
        // Return null for a missing identifier and never expose the stored object itself.
        const target = this._target(collection);
        this.requireId({ id });
        const document = target.get(id);
        return document ? cloneDocument(document) : null;
    }

    async list(collection) {
        // Snapshot every result so callers cannot mutate the Store through list output.
        return [...this._target(collection).values()].map(cloneDocument);
    }

    async add(collection, document) {
        // Generate a UUID before validation because collection schemas may require id.
        const target = this._target(collection);
        const candidate = cloneDocument(document);
        if (candidate.id === undefined || candidate.id === null || candidate.id === "") candidate.id = crypto.randomUUID();
        const copy = this.validate(collection, candidate);
        const id = this.requireId(copy);
        if (target.has(id)) throw new Error(`Document '${id}' already exists in collection '${collection}'`);
        target.set(id, copy);
        return cloneDocument(copy);
    }

    async save(collection, document) {
        // Require explicit identity and validate before replacing any stored value.
        const target = this._target(collection);
        const id = this.requireId(document);
        const copy = this.validate(collection, document);
        target.set(id, copy);
        return cloneDocument(copy);
    }

    async remove(collection, id) {
        // Map.delete already provides the contract's boolean removal result.
        const target = this._target(collection);
        this.requireId({ id });
        return target.delete(id);
    }

    _target(collection) {
        // Resolve through the base class so unknown collections fail consistently.
        this.collection(collection);
        return this._collections.get(collection);
    }
}
