import {LogDatabase, LOG_STORE, TIMESTAMP_INDEX, LOGS_CHANGED, logChannelName} from "../utils/indexeddb.js";

const BATCH_SIZE = 100;
const MAX_PENDING_ENTRIES = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const UNSERIALIZABLE = Object.freeze({unserializable: true});

export default class LoggerIndexedDB {

    #database;
    #maxEntries;
    #retentionMs;
    #pending = [];
    #writing = false;
    #reportedFailure = false;

    constructor(dependencies, options = {}) {
        // Validate provider configuration before any storage operation can run.
        if (!options || typeof options !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) {
            throw new TypeError("IndexedDB logger options must be an object.");
        }
        for (const name of Object.keys(options)) {
            if (!["databaseName", "maxEntries", "retentionDays"].includes(name)) {
                throw new TypeError(`Unknown IndexedDB logger option '${name}'.`);
            }
        }
        const {databaseName, maxEntries = 10000, retentionDays = 7} = options;
        if (databaseName !== undefined && (typeof databaseName !== "string" || !databaseName.trim())) {
            throw new TypeError("IndexedDB logger databaseName must be a nonblank string.");
        }
        if (!Number.isSafeInteger(maxEntries) || maxEntries <= 0) {
            throw new TypeError("IndexedDB logger maxEntries must be a positive safe integer.");
        }
        if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
            throw new TypeError("IndexedDB logger retentionDays must be a positive finite number.");
        }
        this.#database = new LogDatabase(dependencies, databaseName);
        this.#maxEntries = maxEntries;
        this.#retentionMs = retentionDays * DAY_MS;
    }

    log(level, ...args) {
        // Capture the call before yielding so later mutations cannot change its snapshot.
        const timestamp = Date.now();
        try {
            args = structuredClone(args);
        } catch {
            args = args.map(value => {
                try { return structuredClone(value); }
                catch { return UNSERIALIZABLE; }
            });
        }

        // Keep the most recent pending records and schedule one writer.
        if (this.#pending.length === MAX_PENDING_ENTRIES) this.#pending.shift();
        this.#pending.push({timestamp, level, args});
        if (this.#writing) return;
        this.#writing = true;
        queueMicrotask(() => { void this.#flush(); });
    }

    async #flush() {
        // Keep records in the bounded queue until a connection is ready to write.
        try {
            while (this.#pending.length) {
                let database;
                try {
                    database = await this.#database.open();
                } catch {
                    this.#pending.splice(0, BATCH_SIZE);
                    this.#reportFailure();
                    break;
                }
                const batch = this.#pending.splice(0, BATCH_SIZE);
                try {
                    await this.#write(database, batch);
                    this.#reportedFailure = false;
                    this.#notify(database.name);
                } catch (error) {
                    this.#reportFailure();
                    if (error?.name === "InvalidStateError") this.#database.close(database);
                }
            }
        } finally {
            this.#writing = false;
        }
    }

    #write(database, batch) {
        // Resolve only once IndexedDB commits both insertion and retention.
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(LOG_STORE, "readwrite");
            transaction.oncomplete = () => resolve();
            transaction.onabort = () => reject(transaction.error);
            const withinTransaction = operation => {
                try { operation(); }
                catch (error) {
                    try { transaction.abort(); }
                    catch { reject(error); }
                }
            };
            withinTransaction(() => {
                const store = transaction.objectStore(LOG_STORE);
                const retain = () => this.#retain(store, withinTransaction);
                let pendingFallbacks = 0;
                for (const record of batch) {
                    try { store.add(record); }
                    catch (error) {
                        if (error.name !== "DataCloneError") throw error;
                        // IndexedDB rejects some otherwise cloneable objects. Restore storable args on the same key.
                        pendingFallbacks++;
                        const args = record.args.map(value => value && typeof value === "object" ? UNSERIALIZABLE : value);
                        const request = store.add({...record, args});
                        request.onsuccess = () => withinTransaction(() => {
                            const fallback = {...record, id: request.result, args};
                            for (const [index, value] of record.args.entries()) {
                                if (args[index] !== UNSERIALIZABLE || value === UNSERIALIZABLE) continue;
                                args[index] = value;
                                try { store.put(fallback); }
                                catch (error) {
                                    if (error.name !== "DataCloneError") throw error;
                                    args[index] = UNSERIALIZABLE;
                                }
                            }
                            if (--pendingFallbacks === 0) retain();
                        });
                    }
                }
                if (pendingFallbacks === 0) retain();
            });
        });
    }

    #retain(store, withinTransaction) {
        // Traverse keys in timestamp order. IndexedDB breaks ties using primary key order.
        const timestamps = store.index(TIMESTAMP_INDEX);
        const enforceCount = () => {
            const count = store.count();
            count.onsuccess = () => withinTransaction(() => {
                let excess = count.result - this.#maxEntries;
                if (excess <= 0) return;
                const oldest = timestamps.openKeyCursor();
                oldest.onsuccess = () => withinTransaction(() => {
                    const cursor = oldest.result;
                    if (!cursor) return;
                    store.delete(cursor.primaryKey);
                    if (--excess > 0) cursor.continue();
                });
            });
        };

        // Remove expired records before counting the records that remain.
        const cutoff = Date.now() - this.#retentionMs;
        if (!Number.isFinite(cutoff)) {
            enforceCount();
            return;
        }
        const expired = timestamps.openKeyCursor(globalThis.IDBKeyRange.upperBound(cutoff, true));
        expired.onsuccess = () => withinTransaction(() => {
            const cursor = expired.result;
            if (!cursor) {
                enforceCount();
                return;
            }
            store.delete(cursor.primaryKey);
            cursor.continue();
        });
    }

    #reportFailure() {
        // Report one fixed warning until a subsequent transaction commits.
        if (this.#reportedFailure) return;
        this.#reportedFailure = true;
        try { console.warn("IndexedDB logger could not persist a batch."); }
        catch {}
    }

    #notify(databaseName) {
        // A committed batch produces one metadata-free signal, including any retention changes.
        try {
            const channel = new BroadcastChannel(logChannelName(databaseName));
            try { channel.postMessage({type: LOGS_CHANGED}); }
            finally { channel.close(); }
        } catch {}
    }
}
