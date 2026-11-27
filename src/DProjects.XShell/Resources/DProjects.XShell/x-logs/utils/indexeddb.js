export const LOG_STORE = "logs";
export const TIMESTAMP_INDEX = "timestamp";
export const LOGS_CHANGED = "logs:changed";
const DATABASE_VERSION = 1;

export function logChannelName(databaseName) {
    // Encode the database name losslessly, including any unpaired surrogate code units.
    return `xshell:logs:${encodeURIComponent(JSON.stringify(databaseName))}`;
}

export class LogDatabase {
    #dependencies;
    #name;
    #database;
    #opening;
    #blocked = false;

    constructor(dependencies, name) {
        // Resolve the application-scoped name only when storage or observation is needed.
        this.#dependencies = dependencies;
        this.#name = name;
    }

    async getName() {
        // Import the named Core utility from the resolved framework generation.
        if (this.#name === undefined) {
            const {config, resolver} = this.#dependencies;
            const resource = resolver.resolve(`esm:${config.xshell.assets.path}/utils/urls.js`);
            const {indexedDBName} = await import(resource.url);
            this.#name = indexedDBName("logs", config.app.basePath ?? "");
        }
        return this.#name;
    }

    async open() {
        // Share one pending native open for this connection and release settled failures.
        if (this.#database) return this.#database;
        if (this.#blocked) throw new Error("Opening the IndexedDB log database is blocked.");
        if (!globalThis.indexedDB) throw new Error("IndexedDB log storage is unavailable.");
        const opening = this.#opening ??= this.#openDatabase();
        try {
            return await opening;
        } finally {
            if (this.#opening === opening) this.#opening = undefined;
        }
    }

    async #openDatabase() {
        const name = await this.getName();
        // Use the original schema for both providers, including databases created before the module rename.
        return new Promise((resolve, reject) => {
            const request = globalThis.indexedDB.open(name, DATABASE_VERSION);
            request.onupgradeneeded = () => {
                try {
                    const database = request.result;
                    const store = database.objectStoreNames.contains(LOG_STORE)
                        ? request.transaction.objectStore(LOG_STORE)
                        : database.createObjectStore(LOG_STORE, {keyPath: "id", autoIncrement: true});
                    for (const index of [TIMESTAMP_INDEX, "level"]) {
                        if (!store.indexNames.contains(index)) store.createIndex(index, index, {unique: false});
                    }
                } catch (error) {
                    reject(error);
                    try { request.transaction.abort(); }
                    catch {}
                }
            };

            // A blocked native open can still finish later. Dispose of its result and let the next call reopen.
            request.onblocked = () => {
                this.#blocked = true;
                reject(new Error("Opening the IndexedDB log database is blocked."));
            };
            request.onerror = () => {
                this.#blocked = false;
                reject(request.error);
            };
            request.onsuccess = () => {
                const database = request.result;
                if (this.#blocked) {
                    this.#blocked = false;
                    database.close();
                    return;
                }
                this.#database = database;
                database.onversionchange = () => this.close(database);
                database.onclose = () => {
                    if (this.#database === database) this.#database = undefined;
                };
                resolve(database);
            };
        });
    }

    close(database) {
        // Forget a stale handle so later operations can reopen it.
        if (this.#database === database) this.#database = undefined;
        database.close();
    }
}
