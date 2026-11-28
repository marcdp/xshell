import {LogDatabase, LOG_STORE, TIMESTAMP_INDEX, LOGS_CHANGED, logChannelName} from "../utils/indexeddb.js";

const LEVELS = ["trace", "debug", "info", "warn", "error"];
const RECONCILE_MS = 5000;
const COALESCE_MS = 25;
const CHANGE = Object.freeze({type: "changed"});

function isOptions(value) {
    // Accept ordinary option dictionaries, including objects without a prototype.
    return !!value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function sortCategories(values) {
    // Sort strings by code unit and place the uncategorized value first.
    const categories = [...values].filter(value => value !== null).sort();
    if (values.has(null)) categories.unshift(null);
    return categories;
}

function encodeCursor(token) {
    // Percent-encode the JSON before base64 so arbitrary Unicode strings round-trip.
    return btoa(encodeURIComponent(JSON.stringify(token)));
}

function decodeCursor(cursor, signature) {
    // Compare normalized filters and verify that the token contains a valid index position.
    try {
        const token = JSON.parse(decodeURIComponent(atob(cursor)));
        if (Array.isArray(token) && token.length === 4 && token[0] === 2 && token[1] === signature
            && Number.isFinite(token[2]) && Number.isSafeInteger(token[3]) && token[3] > 0
            && encodeCursor(token) === cursor) return token.slice(2);
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
            if (!["levels", "categories", "from", "to", "limit", "cursor", "order"].includes(name)) throw new TypeError(`Unknown log query option '${String(name)}'.`);
        }
        const {levels = LEVELS, categories, from, to, limit = 100, cursor, order = "desc"} = options;
        if (!Array.isArray(levels) || Array.from(levels).some(level => !LEVELS.includes(level))) {
            throw new TypeError("Log query levels must contain only trace, debug, info, warn or error.");
        }
        if (categories !== undefined && (!Array.isArray(categories)
            || Array.from(categories).some(category => category !== null && (typeof category !== "string" || !category.length)))) {
            throw new TypeError("Log query categories must contain only nonempty strings or null.");
        }
        if (from !== undefined && !Number.isFinite(from)) throw new TypeError("Log query from must be a finite timestamp.");
        if (to !== undefined && !Number.isFinite(to)) throw new TypeError("Log query to must be a finite timestamp.");
        if (from > to) throw new RangeError("Log query 'from' must be at or before 'to'.");
        if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new RangeError("Log query limit must be an integer from 1 to 500.");
        if (order !== "asc" && order !== "desc") throw new TypeError("Log query order must be asc or desc.");
        if (cursor !== undefined && typeof cursor !== "string") throw new TypeError("Invalid log cursor.");

        // Bind continuations to equivalent filter sets and to the same database.
        const selection = LEVELS.filter(level => levels.includes(level));
        const categorySet = categories === undefined ? null : new Set(categories);
        const empty = !selection.length || categorySet?.size === 0;
        if (empty && cursor === undefined) return {items: [], nextCursor: null, hasMore: false};
        const signature = JSON.stringify([await this.#database.getName(), selection, categorySet && sortCategories(categorySet), from, to, order]);
        // Allow the normalized filter payload to grow while bounding the remaining cursor data.
        if (cursor !== undefined && cursor.length > encodeCursor([2, signature, 0, 1]).length + 512) throw new TypeError("Invalid log cursor.");
        const position = cursor === undefined ? null : decodeCursor(cursor, signature);
        if (position && (position[0] < from || position[0] > to)) throw new TypeError("Invalid log cursor timestamp.");
        if (empty) return {items: [], nextCursor: null, hasMore: false};

        // Start at the inclusive timestamp boundary and continue by primary key within timestamp ties.
        const database = await this.#database.open();
        const boundary = position?.[0];
        const lower = position && order === "asc" ? boundary : from;
        const upper = position && order === "desc" ? boundary : to;
        const range = lower === undefined ? (upper === undefined ? null : IDBKeyRange.upperBound(upper))
            : upper === undefined ? IDBKeyRange.lowerBound(lower) : IDBKeyRange.bound(lower, upper);
        try {
            return await this.#read(database, range, selection, categorySet, order, limit, position, signature);
        } catch (error) {
            if (error?.name === "InvalidStateError") this.#database.close(database);
            throw error;
        }
    }

    #read(database, range, levels, categories, order, limit, position, signature) {
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
                    const record = entry.value;
                    const category = record.category ?? null;
                    if (levels.includes(record.level) && (categories === null || categories.has(category))) {
                        if (items.length === limit) {
                            const {timestamp, id} = items.at(-1);
                            nextCursor = encodeCursor([2, signature, timestamp, id]);
                            return;
                        }
                        items.push({...record, category});
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

    async getCategories() {
        // Scan current storage in one readonly transaction and retain only distinct values.
        const database = await this.#database.open();
        try {
            return await new Promise((resolve, reject) => {
                const categories = new Set();
                const transaction = database.transaction(LOG_STORE, "readonly");
                transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB log category discovery was aborted."));
                transaction.oncomplete = () => resolve(sortCategories(categories));
                const request = transaction.objectStore(LOG_STORE).openCursor();
                request.onsuccess = () => {
                    const entry = request.result;
                    if (!entry) return;
                    categories.add(entry.value.category ?? null);
                    entry.continue();
                };
            });
        } catch (error) {
            if (error?.name === "InvalidStateError") this.#database.close(database);
            throw error;
        }
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
