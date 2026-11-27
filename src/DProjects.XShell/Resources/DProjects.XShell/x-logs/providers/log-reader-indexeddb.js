import {LogDatabase, LOG_STORE, TIMESTAMP_INDEX, LOGS_CHANGED, logChannelName} from "../utils/indexeddb.js";

const LEVELS = ["trace", "debug", "info", "warn", "error"];
const RECONCILE_MS = 5000;
const COALESCE_MS = 25;
const CHANGE = Object.freeze({type: "changed"});

function isOptions(value) {
    // Accept ordinary option dictionaries, including objects without a prototype.
    return !!value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function decodeCursor(cursor, signature) {
    // Compare normalized filters and verify that the token contains a valid index position.
    try {
        const token = JSON.parse(atob(cursor));
        if (Array.isArray(token) && token.length === 4 && token[0] === 1 && token[1] === signature
            && Number.isFinite(token[2]) && Number.isSafeInteger(token[3]) && token[3] > 0
            && btoa(JSON.stringify(token)) === cursor) return token.slice(2);
    } catch {}
    throw new TypeError("Invalid or incompatible log cursor.");
}

export default class LogReaderIndexedDB {
    #database;
    #subscribers = new Set();
    #channel;
    #poll;
    #notification;

    constructor(dependencies, options = {}) {
        // Validate configuration without opening IndexedDB or starting observation.
        if (!isOptions(options)) throw new TypeError("IndexedDB log reader options must be an object.");
        for (const name of Reflect.ownKeys(options)) {
            if (name !== "databaseName") throw new TypeError(`Unknown IndexedDB log reader option '${String(name)}'.`);
        }
        const {databaseName} = options;
        if (databaseName !== undefined && (typeof databaseName !== "string" || !databaseName.trim())) {
            throw new TypeError("IndexedDB log reader databaseName must be a nonblank string.");
        }
        this.#database = new LogDatabase(dependencies, databaseName);
    }

    async query(options = {}) {
        // Validate every option before using storage and normalize equivalent level selections.
        if (!isOptions(options)) throw new TypeError("Log query options must be an object.");
        for (const name of Reflect.ownKeys(options)) {
            if (!["levels", "from", "to", "limit", "cursor", "order"].includes(name)) throw new TypeError(`Unknown log query option '${String(name)}'.`);
        }
        const {levels = LEVELS, from, to, limit = 100, cursor, order = "desc"} = options;
        if (!Array.isArray(levels) || Array.from(levels).some(level => !LEVELS.includes(level))) {
            throw new TypeError("Log query levels must contain only trace, debug, info, warn or error.");
        }
        if (from !== undefined && !Number.isFinite(from)) throw new TypeError("Log query from must be a finite timestamp.");
        if (to !== undefined && !Number.isFinite(to)) throw new TypeError("Log query to must be a finite timestamp.");
        if (from > to) throw new RangeError("Log query 'from' must be at or before 'to'.");
        if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new RangeError("Log query limit must be an integer from 1 to 500.");
        if (order !== "asc" && order !== "desc") throw new TypeError("Log query order must be asc or desc.");
        const selection = LEVELS.filter(level => levels.includes(level));
        const signature = JSON.stringify([selection, from, to, order]);
        if (cursor !== undefined && (typeof cursor !== "string" || cursor.length > 512)) throw new TypeError("Invalid log cursor.");
        const position = cursor === undefined ? null : decodeCursor(cursor, signature);
        if (position && (position[0] < from || position[0] > to)) throw new TypeError("Invalid log cursor timestamp.");
        if (!selection.length) return {items: [], nextCursor: null, hasMore: false};

        // Start at the inclusive timestamp boundary and continue by primary key within timestamp ties.
        const database = await this.#database.open();
        const boundary = position?.[0];
        const lower = position && order === "asc" ? boundary : from;
        const upper = position && order === "desc" ? boundary : to;
        const range = lower === undefined ? (upper === undefined ? null : IDBKeyRange.upperBound(upper))
            : upper === undefined ? IDBKeyRange.lowerBound(lower) : IDBKeyRange.bound(lower, upper);
        try {
            return await this.#read(database, range, selection, order, limit, position, signature);
        } catch (error) {
            if (error?.name === "InvalidStateError") this.#database.close(database);
            throw error;
        }
    }

    #read(database, range, levels, order, limit, position, signature) {
        // Traverse only the timestamp index and stop after finding one additional matching row.
        return new Promise((resolve, reject) => {
            const items = [];
            let nextCursor = null;
            const transaction = database.transaction(LOG_STORE, "readonly");
            transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB log query was aborted."));
            transaction.oncomplete = () => resolve({items, nextCursor, hasMore: nextCursor !== null});
            const index = transaction.objectStore(LOG_STORE).index(TIMESTAMP_INDEX);
            const request = index.openCursor(range, order === "asc" ? "next" : "prev");
            request.onsuccess = () => {
                try {
                    const entry = request.result;
                    if (!entry) return;
                    if (position && entry.key === position[0]) {
                        const [timestamp, id] = position;
                        if (order === "asc" ? entry.primaryKey < id : entry.primaryKey > id) {
                            entry.continuePrimaryKey(timestamp, id);
                            return;
                        }
                        if (entry.primaryKey === id) {
                            entry.continue();
                            return;
                        }
                    }
                    if (levels.includes(entry.value.level)) {
                        if (items.length === limit) {
                            const {timestamp, id} = items.at(-1);
                            nextCursor = btoa(JSON.stringify([1, signature, timestamp, id]));
                            return;
                        }
                        items.push(entry.value);
                    }
                    entry.continue();
                } catch (error) {
                    reject(error);
                    try { transaction.abort(); }
                    catch {}
                }
            };
        });
    }

    async subscribe(callback) {
        // Register each subscription independently, even when callbacks are identical.
        if (typeof callback !== "function") throw new TypeError("IndexedDB log reader requires a subscription callback.");
        const name = await this.#database.getName();
        const subscription = {callback};
        this.#subscribers.add(subscription);
        if (this.#subscribers.size === 1) this.#observe(name);
        return () => {
            if (!this.#subscribers.delete(subscription) || this.#subscribers.size) return;
            clearInterval(this.#poll);
            clearTimeout(this.#notification);
            this.#notification = undefined;
            this.#channel?.close();
            this.#channel = undefined;
        };
    }

    #observe(name) {
        // Reconcile periodically even when broadcasts can be received.
        this.#poll = setInterval(() => this.#scheduleChange(), RECONCILE_MS);
        try {
            this.#channel = new BroadcastChannel(logChannelName(name));
            this.#channel.onmessage = ({data}) => {
                if (data?.type === LOGS_CHANGED) this.#scheduleChange();
            };
        } catch {
            // Polling remains active when BroadcastChannel cannot be opened.
        }
    }

    #scheduleChange() {
        // Coalesce bursts and isolate both synchronous and asynchronous callback failures.
        if (!this.#subscribers.size || this.#notification !== undefined) return;
        this.#notification = setTimeout(() => {
            this.#notification = undefined;
            for (const subscription of [...this.#subscribers]) {
                if (!this.#subscribers.has(subscription)) continue;
                try { Promise.resolve(subscription.callback(CHANGE)).catch(() => {}); }
                catch {}
            }
        }, COALESCE_MS);
    }
}
