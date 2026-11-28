import {LogDatabase, LOG_STORE, TIMESTAMP_INDEX, LOGS_CHANGED, logChannelName} from "../utils/indexeddb.js";

const BATCH_SIZE = 100;
const MAX_PENDING_ENTRIES = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECOVERY_COOLDOWN_MS = 30000;
const UNSERIALIZABLE = Object.freeze({unserializable: true});

export default class LoggerIndexedDB {

    #database;
    #maxEntries;
    #retentionMs;
    #pending = [];
    #writing = false;
    #reportedFailure = false;
    #recoverAfter = 0;

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
                    await this.#persist(database, batch);
                } catch (error) {
                    this.#reportFailure();
                    if (error?.name === "InvalidStateError") this.#database.close(database);
                }
            }
        } finally {
            this.#writing = false;
        }
    }

    async #persist(database, batch) {
        // Let every batch try a normal write, even during the recovery cooldown.
        try {
            await this.#write(database, batch);
        } catch (error) {
            if (error?.name !== "QuotaExceededError" || Date.now() < this.#recoverAfter) throw error;

            // Commit and announce reclaimed records before retrying the original batch once.
            try {
                const removed = await this.#reclaim(database);
                if (!removed) throw error;
                this.#notify(database.name);
                await this.#write(database, batch);
            } catch (recoveryError) {
                this.#recoverAfter = Date.now() + RECOVERY_COOLDOWN_MS;
                throw recoveryError;
            }
        }

        // A committed write ends both the cooldown and the warning suppression.
        this.#recoverAfter = 0;
        this.#reportedFailure = false;
        this.#notify(database.name);
    }

    #transact(database, operation) {
        // Settle after IndexedDB commits or rolls back, retaining the cause of any failure.
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(LOG_STORE, "readwrite");
            let failure;
            transaction.oncomplete = () => failure ? reject(failure) : resolve();
            transaction.onerror = event => {
                // Pending requests can report AbortError when a transaction-level failure cancels them.
                const error = event.target?.error;
                if (error?.name !== "AbortError") failure ??= error;
            };
            transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("IndexedDB transaction aborted."));
            const withinTransaction = callback => {
                try { callback(); }
                catch (error) {
                    failure ??= error;
                    try { transaction.abort(); }
                    catch {
                        // A transaction already finishing will still deliver its terminal event.
                    }
                }
            };
            withinTransaction(() => operation(transaction.objectStore(LOG_STORE), withinTransaction));
        });
    }

    #write(database, batch) {
        // Insert the batch and apply retention in the same transaction.
        return this.#transact(database, (store, withinTransaction) => {
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
    }

    #retain(store, withinTransaction) {
        // Remove expired records before counting the records that remain.
        this.#removeExpired(store, withinTransaction, () => {
            const count = store.count();
            count.onsuccess = () => withinTransaction(() => {
                const excess = count.result - this.#maxEntries;
                if (excess > 0) this.#removeOldest(store, withinTransaction, null, excess);
            });
        });
    }

    async #reclaim(database) {
        // Evict retained history only when there are no expired records to reclaim.
        let removed = 0;
        await this.#transact(database, (store, withinTransaction) => {
            this.#removeExpired(store, withinTransaction, expired => {
                if (expired) removed = expired;
                else this.#removeOldest(store, withinTransaction, null, BATCH_SIZE, count => { removed = count; });
            });
        });
        return removed;
    }

    #removeExpired(store, withinTransaction, done) {
        // Keep records on the exact retention boundary.
        const cutoff = Date.now() - this.#retentionMs;
        if (!Number.isFinite(cutoff)) {
            done(0);
            return;
        }
        this.#removeOldest(store, withinTransaction, globalThis.IDBKeyRange.upperBound(cutoff, true), Infinity, done);
    }

    #removeOldest(store, withinTransaction, range, limit, done) {
        // Traverse only keys. IndexedDB breaks timestamp ties using primary key order.
        const request = store.index(TIMESTAMP_INDEX).openKeyCursor(range);
        let removed = 0;
        request.onsuccess = () => withinTransaction(() => {
            const cursor = request.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                if (++removed < limit) {
                    cursor.continue();
                    return;
                }
            }
            done?.(removed);
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
        // A committed storage change produces one metadata-free signal.
        try {
            const channel = new BroadcastChannel(logChannelName(databaseName));
            try { channel.postMessage({type: LOGS_CHANGED}); }
            finally { channel.close(); }
        } catch {}
    }
}
