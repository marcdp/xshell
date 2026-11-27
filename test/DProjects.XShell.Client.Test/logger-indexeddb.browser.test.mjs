import test from "node:test";
import { chromiumOnly, runInChromium } from "./helpers/chromium.mjs";

async function verifyIndexedDBLogger() {
    const {default: LoggerIndexedDB} = await import("/resources/x-logger/providers/logger-indexeddb.js");
    const {default: Resolver} = await import("/resources/xshell/services/resolver.js");
    const scenario = new URLSearchParams(location.search).get("scenario");
    const nativeOpen = indexedDB.open.bind(indexedDB);
    const nativeTransaction = IDBDatabase.prototype.transaction;
    const nativeAdd = IDBObjectStore.prototype.add;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);

    function check(condition, message) {
        if (!condition) throw new Error(message);
    }
    function result(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async function until(read, expected, message) {
        // Poll committed storage in read-only transactions.
        for (let attempt = 0; attempt < 300; attempt++) {
            const value = await read();
            if (expected(value)) return value;
            await new Promise(resolve => setTimeout(resolve, 3));
        }
        throw new Error(message);
    }
    async function records(name, storeName = "logs") {
        if (!(await indexedDB.databases()).some(database => database.name === name)) return [];
        const database = await result(nativeOpen(name));
        try {
            return await result(database.transaction(storeName).objectStore(storeName).getAll());
        } finally {
            database.close();
        }
    }
    function logger(options, basePath = "") {
        const path = "/_assets/xshell/0.9.0.dev";
        const config = {app: {basePath, baseUrl: location.origin + "/"}, xshell: {assets: {path}, resolver: {
            esm: {[`${path}/utils/urls.js`]: {src: "/resources/xshell/utils/urls.js"}}
        }}};
        return new LoggerIndexedDB({config, resolver: new Resolver({config})}, options);
    }

    if (scenario === "persistence") {
        // Observe one database open and inject a log while the native transaction is active.
        const name = "demo%2Dapp-shared-xshell-logs";
        if (sessionStorage.getItem("logger-reload") === "pending") {
            const reloaded = await records(name);
            check(reloaded.length === 7 && reloaded[0].args[0] === "first" && reloaded.at(-1).args[0] === "reopened", "Committed records did not survive reload");
            sessionStorage.removeItem("logger-reload");
            return;
        }
        const provider = logger({}, "/demo-app/shared/");
        let opens = 0, writes = 0, active = 0, maximumActive = 0;
        indexedDB.open = (...args) => {
            if (args[0] === name) opens++;
            return nativeOpen(...args);
        };
        IDBDatabase.prototype.transaction = function (...args) {
            const transaction = nativeTransaction.apply(this, args);
            if (this.name === name && args[1] === "readwrite") {
                maximumActive = Math.max(maximumActive, ++active);
                transaction.addEventListener("complete", () => active--);
                if (++writes === 1) provider.log("info", "during write");
            }
            return transaction;
        };
        let timestamp = 1700000000000;
        Date.now = () => timestamp;
        const shared = {value: 1};
        shared.circular = shared;
        const error = new Error("sample");
        check(provider.log("trace", "first", shared, shared, [1], undefined, 23n, true, null,
            new Date(123), new Map([["key", 4]]), new Set([5]), error) === undefined, "Logging did not return synchronously");
        provider.log("debug");
        provider.log("info", 42, false);
        provider.log("warn", () => {}, Symbol("sample"), document.body, new Proxy({}, {}), "last value");
        const wasm = new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
        provider.log("error", "storage-only fallback", wasm, {kept: true});
        shared.value = 2;
        timestamp++;
        const stored = await until(() => records(name), rows => rows.length === 6, "Records did not commit");
        check(stored.map(entry => entry.level).join() === "trace,debug,info,warn,error,info", "Log levels or FIFO order changed");
        check(stored.every((entry, index) => entry.id === index + 1), "Primary keys were not generated in order");
        check(stored.every((entry, index) => entry.timestamp === 1700000000000 + (index === 5 ? 1 : 0)), "Timestamps were captured at write time");
        const args = stored[0].args;
        check(args[0] === "first" && args[1] === args[2] && args[1].circular === args[1] && args[1].value === 1, "Snapshot or object identity changed");
        check(args[3][0] === 1 && args[4] === undefined && args[5] === 23n && args[6] === true && args[7] === null, "Array or primitive changed");
        check(args[8].getTime() === 123 && args[9].get("key") === 4 && args[10].has(5), "Date, map or set changed");
        check(args[11] instanceof Error && args[11].message === "sample", "Error did not survive storage");
        check(stored[1].args.length === 0 && stored[2].args.join() === "42,false", "Argument positions changed");
        check(stored[3].args.slice(0, 4).every(value => value.unserializable) && stored[3].args[4] === "last value", "Unsupported values lost the record");
        check(stored[4].args[0] === "storage-only fallback" && stored[4].args[1].unserializable
            && stored[4].args[2].kept, "IndexedDB-only serialization failure lost supported arguments");
        check(stored[5].args[0] === "during write" && opens === 1 && writes === 2 && maximumActive === 1, "Batching opened redundant connections or writers");

        // Inspect schema, then read old entries after another provider uses the same application namespace.
        const database = await result(nativeOpen(name));
        const store = database.transaction("logs").objectStore("logs");
        check(store.keyPath === "id" && store.autoIncrement && Array.from(store.indexNames).join() === "level,timestamp", "Incorrect log schema");
        check(["level", "timestamp"].every(key => store.index(key).keyPath === key && !store.index(key).unique), "Incorrect log indexes");
        database.close();
        logger({}, "/demo-app/shared/").log("info", "reopened");
        logger().log("info", "root only");
        const reopened = await until(() => records(name), rows => rows.length === 7, "Records did not survive reinitialization");
        const root = await until(() => records("xshell-logs"), rows => rows.length === 1, "Root database name was incorrect");
        check(reopened[0].args[0] === "first" && root[0].args[0] === "root only" && opens === 2 && warnings.length === 0, "Namespaces or prior records changed");
        // Verify the same database after navigating the browser document again.
        sessionStorage.setItem("logger-reload", "pending");
        location.reload();
        await new Promise(() => {});
    } else if (scenario === "retention") {
        // Seed a dedicated database with an unrelated store to detect accidental data removal.
        const name = "explicit-logger";
        const open = nativeOpen(name, 1);
        open.onupgradeneeded = () => {
            const store = open.result.createObjectStore("logs", {keyPath: "id", autoIncrement: true});
            store.createIndex("timestamp", "timestamp");
            store.createIndex("level", "level");
            open.result.createObjectStore("unrelated").add("keep", "key");
        };
        (await result(open)).close();
        const options = {databaseName: name, retentionDays: 1, maxEntries: 4};
        const first = logger(options, "/first");
        const second = logger(options, "/second");
        const day = 24 * 60 * 60 * 1000;
        const now = 1700000000000;
        let timestamp = now - 2 * day;
        Date.now = () => timestamp;
        first.log("warn", "expired");
        timestamp = now - day;
        first.log("info", "exact boundary");
        timestamp = now;
        for (const value of ["tie 1", "tie 2", "tie 3"]) first.log("info", value);
        const retained = await until(() => records(name), rows => rows.length === 4, "Expired records were retained");
        check(retained.map(entry => entry.args[0]).join() === "exact boundary,tie 1,tie 2,tie 3", "Age boundary or order changed");
        first.log("warn", "left tab");
        second.log("warn", "right tab");
        const shared = await until(() => records(name), rows => rows.some(row => row.args[0] === "left tab")
            && rows.some(row => row.args[0] === "right tab"), "Concurrent provider records did not coexist");
        check(shared.length === 4 && shared[0].args[0] === "tie 2" && shared[1].args[0] === "tie 3", "Oldest entries or timestamp ties were removed incorrectly");
        check(new Set(shared.map(entry => entry.id)).size === 4, "Primary keys conflicted");
        check((await records(name, "unrelated")).join() === "keep", "Retention touched another store");
    } else if (scenario === "queue") {
        // Keep the latest 1000 records when synchronous logging outpaces the writer.
        const name = "queued-logger";
        const provider = logger({databaseName: name});
        let batches = 0;
        IDBDatabase.prototype.transaction = function (...args) {
            if (this.name === name && args[1] === "readwrite") batches++;
            return nativeTransaction.apply(this, args);
        };
        for (let index = 0; index < 1006; index++) provider.log("trace", index);
        const stored = await until(() => records(name), rows => rows.length === 1000, "Did not flush the bounded queue");
        check(stored.every((row, index) => row.args[0] === index + 6) && batches === 10, "Overflow or batching policy changed");
    } else {
        // Abort a native transaction after request success and simulate a quota error at the storage boundary.
        const name = "failing-logger";
        const provider = logger({databaseName: name});
        const unhandled = [];
        addEventListener("unhandledrejection", event => unhandled.push(event.reason));
        let failure = "abort", connection;
        IDBDatabase.prototype.transaction = function (...args) {
            const transaction = nativeTransaction.apply(this, args);
            if (this.name === name && args[1] === "readwrite") connection = this;
            return transaction;
        };
        IDBObjectStore.prototype.add = function (...args) {
            const inject = this.transaction.db.name === name ? failure : null;
            if (inject === "quota") throw new DOMException("quota details", "QuotaExceededError");
            const request = nativeAdd.apply(this, args);
            if (inject === "abort") request.addEventListener("success", () => this.transaction.abort(), {once: true});
            return request;
        };
        provider.log("error", "aborted record");
        await until(() => warnings, entries => entries.length === 1, "Abort was not diagnosed");
        check((await records(name)).length === 0, "Request success was treated as a commit");
        failure = "quota";
        provider.log("error", "private quota record");
        await new Promise(resolve => setTimeout(resolve, 10));
        check(warnings.length === 1 && (await records(name)).length === 0, "Quota failure wrote or repeated warnings");
        failure = null;
        provider.log("info", "recovered");
        await until(() => records(name), rows => rows.some(row => row.args[0] === "recovered"), "Write did not resume after failure");
        connection.close();
        provider.log("error", "invalidated connection");
        await until(() => warnings, entries => entries.length === 2, "Invalid connection was not diagnosed");
        provider.log("info", "reopened connection");
        await until(() => records(name), rows => rows.length === 2, "Provider did not reopen its invalidated connection");

        // A real version-change event closes the writer's connection and allows deletion and reopening.
        await result(indexedDB.deleteDatabase(name));
        provider.log("info", "after version change");
        const reopened = await until(() => records(name), rows => rows.length === 1, "Provider did not reopen after a version change");
        check(reopened[0].args[0] === "after version change" && unhandled.length === 0, "Recovery or promise isolation failed");
        check(warnings.every(args => args.length === 1 && args[0] === "IndexedDB logger could not persist a batch."), "Warnings exposed storage or data details");
    }
}

test("IndexedDB logger persists records, enforces retention and queue bounds, and recovers from native transaction failures", chromiumOnly,
    () => runInChromium(verifyIndexedDBLogger, ["scenario=persistence", "scenario=retention", "scenario=queue", "scenario=failure"], {realTime: true}));
