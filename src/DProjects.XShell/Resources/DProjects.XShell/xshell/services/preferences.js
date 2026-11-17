// Browser-local preferences persisted as native structured-clone values.

const DB_NAME = "xshell-preferences";
const DB_VERSION = 1;
const STORE_NAME = "preferences";
const NAME_INDEX = "name";

function checkName(name) {
    // Require a stable non-empty logical key without changing caller-supplied whitespace.
    if (typeof name !== "string" || !name.trim()) throw new TypeError("Preference name must be a non-empty string.");
    return name;
}

function checkPrefix(prefix) {
    // Treat an omitted prefix as an unfiltered list while rejecting ambiguous values.
    if (prefix === undefined) return "";
    if (typeof prefix !== "string") throw new TypeError("Preference prefix must be a string.");
    return prefix;
}

function preferenceMetadata(options) {
    // Validate only caller-editable metadata and remember which fields were supplied.
    if (options !== undefined && (!options || typeof options !== "object" || Array.isArray(options))) {
        throw new TypeError("Preference metadata must be an object.");
    }
    if (options && Object.keys(options).some(key => key !== "label" && key !== "description")) {
        throw new TypeError("Preference metadata contains an unknown property.");
    }
    const labelProvided = options !== undefined && Object.hasOwn(options, "label");
    const descriptionProvided = options !== undefined && Object.hasOwn(options, "description");
    if (labelProvided && typeof options.label !== "string") throw new TypeError("Preference label must be a string.");
    if (descriptionProvided && typeof options.description !== "string") throw new TypeError("Preference description must be a string.");
    return {labelProvided, label:labelProvided ? options.label : "", descriptionProvided, description:descriptionProvided ? options.description : ""};
}

function checkRevision(record) {
    // Reject damaged metadata before attempting an update that could lose revision history.
    if (!Number.isSafeInteger(record.revision) || record.revision < 1 || record.revision === Number.MAX_SAFE_INTEGER) {
        throw new Error("Preference revision metadata must be an incrementable positive safe integer.");
    }
    return record.revision;
}

function newId() {
    // Use the browser UUID primitive required by the persisted record contract.
    if (typeof globalThis.crypto?.randomUUID !== "function") throw new Error("Preferences requires crypto.randomUUID().");
    return globalThis.crypto.randomUUID();
}

function prefixRange(prefix) {
    // Build the smallest exclusive upper bound in UTF-16 order, falling back to a lower bound for an all-FFFF prefix.
    for (let index = prefix.length - 1; index >= 0; index--) {
        const code = prefix.charCodeAt(index);
        if (code < 0xffff) return globalThis.IDBKeyRange.bound(prefix, prefix.slice(0, index) + String.fromCharCode(code + 1), false, true);
    }
    return globalThis.IDBKeyRange.lowerBound(prefix);
}

export default class Preferences {

    // options schema
    static optionsSchema = {
        type: "object",
        properties: {},
        additionalProperties: false
    };

    // vars
    #databasePromise = null;

    // ctor
    constructor(_services = {}, _options = {}) {}

    // methods
    async set(key, value, options) {
        // Validate inputs before opening a transaction so invalid metadata cannot affect storage.
        const name = checkName(key);
        const metadata = preferenceMetadata(options);
        const database = await this.#open();

        // Read and write within one transaction so concurrent updates serialize revisions atomically.
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            let requestError = null;
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => {};
            transaction.onabort = () => reject(requestError || transaction.error || new Error("Preference write transaction was aborted."));

            const lookup = store.index(NAME_INDEX).get(name);
            lookup.onerror = () => { requestError = lookup.error; };
            lookup.onsuccess = () => {
                try {
                    const existing = lookup.result;
                    const timestamp = new Date().toISOString();
                    const record = existing ? {
                        ...existing,
                        label: metadata.labelProvided ? metadata.label : existing.label,
                        description: metadata.descriptionProvided ? metadata.description : existing.description,
                        modifiedAt: timestamp,
                        revision: checkRevision(existing) + 1,
                        value
                    } : {
                        id: newId(),
                        name,
                        label: metadata.labelProvided ? metadata.label : name,
                        description: metadata.descriptionProvided ? metadata.description : "",
                        createdAt: timestamp,
                        modifiedAt: timestamp,
                        revision: 1,
                        value
                    };
                    const write = store.put(record);
                    write.onerror = () => { requestError = write.error; };
                } catch (error) {
                    requestError = error;
                    transaction.abort();
                }
            };
        });
    }

    async get(key, defaultValue) {
        // Look up the complete record so a stored undefined remains distinct from absence.
        const name = checkName(key);
        const database = await this.#open();
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, "readonly");
            const request = transaction.objectStore(STORE_NAME).index(NAME_INDEX).get(name);
            let record;
            request.onsuccess = () => { record = request.result; };
            request.onerror = () => {};
            transaction.oncomplete = () => resolve(record === undefined ? defaultValue : record.value);
            transaction.onerror = () => {};
            transaction.onabort = () => reject(request.error || transaction.error || new Error("Preference read transaction was aborted."));
        });
    }

    async delete(key) {
        // Resolve the indexed name and delete its immutable primary key in one transaction.
        const name = checkName(key);
        const database = await this.#open();
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            let requestError = null;
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => {};
            transaction.onabort = () => reject(requestError || transaction.error || new Error("Preference delete transaction was aborted."));
            const lookup = store.index(NAME_INDEX).get(name);
            lookup.onerror = () => { requestError = lookup.error; };
            lookup.onsuccess = () => {
                if (lookup.result === undefined) return;
                try {
                    const removal = store.delete(lookup.result.id);
                    removal.onerror = () => { requestError = removal.error; };
                } catch (error) {
                    requestError = error;
                    transaction.abort();
                }
            };
        });
    }

    async list(keyPrefix) {
        // Enumerate through the name index and constrain non-empty prefixes with an IndexedDB key range.
        const prefix = checkPrefix(keyPrefix);
        const database = await this.#open();
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, "readonly");
            const index = transaction.objectStore(STORE_NAME).index(NAME_INDEX);
            const range = prefix ? prefixRange(prefix) : undefined;
            const request = index.getAll(range);
            let records = [];
            request.onsuccess = () => { records = prefix ? request.result.filter(record => record.name.startsWith(prefix)) : request.result; };
            request.onerror = () => {};
            transaction.oncomplete = () => resolve(records.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
            transaction.onerror = () => {};
            transaction.onabort = () => reject(request.error || transaction.error || new Error("Preference list transaction was aborted."));
        });
    }

    // methods (private)
    #open() {
        // Share one lazy open attempt per instance and allow a later retry after failure.
        if (this.#databasePromise) return this.#databasePromise;
        if (!globalThis.indexedDB) return Promise.reject(new Error("Preferences requires IndexedDB."));

        let opening;
        opening = new Promise((resolve, reject) => {
            const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
            let settled = false;
            const fail = error => {
                if (settled) return;
                settled = true;
                if (this.#databasePromise === opening) this.#databasePromise = null;
                reject(error);
            };

            request.onupgradeneeded = () => {
                // Create only missing schema objects and never modify stored records during initialization.
                const database = request.result;
                const store = database.objectStoreNames.contains(STORE_NAME)
                    ? request.transaction.objectStore(STORE_NAME)
                    : database.createObjectStore(STORE_NAME, {keyPath:"id"});
                if (!store.indexNames.contains(NAME_INDEX)) store.createIndex(NAME_INDEX, "name", {unique:true});
            };
            request.onerror = () => fail(request.error || new Error("Preferences database could not be opened."));
            request.onblocked = () => fail(new Error("Opening the Preferences database is blocked by another tab."));
            request.onsuccess = () => {
                if (settled) return void request.result.close();
                settled = true;
                const database = request.result;
                database.onversionchange = () => {
                    database.close();
                    if (this.#databasePromise === opening) this.#databasePromise = null;
                };
                resolve(database);
            };
        });
        this.#databasePromise = opening;
        opening.catch(() => {
            // Clear synchronous open failures, including SecurityError, so a later browser-policy change can be retried.
            if (this.#databasePromise === opening) this.#databasePromise = null;
        });
        return opening;
    }
}
