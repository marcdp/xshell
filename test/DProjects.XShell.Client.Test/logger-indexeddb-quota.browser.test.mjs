import test from "node:test";
import {chromiumOnly, runInChromium} from "./helpers/chromium.mjs";

async function verifyQuotaRecovery() {
    const {default: Writer} = await import("/resources/x-logs/providers/logger-indexeddb.js");
    const {default: Reader} = await import("/resources/x-logs/providers/log-reader-indexeddb.js");
    const {logChannelName} = await import("/resources/x-logs/utils/indexeddb.js");
    const scenario = new URLSearchParams(location.search).get("scenario");
    const name = "quota logs";
    const day = 86400000;
    const start = 1700000000000;
    let now = start;
    Date.now = () => now;

    function check(condition, message) {
        if (!condition) throw new Error(message);
    }
    function result(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async function until(condition, message) {
        for (let attempt = 0; attempt < 300; attempt++) {
            if (await condition()) return;
            await new Promise(resolve => setTimeout(resolve, 5));
        }
        throw new Error(message);
    }

    // Seed version 1 with rows in an order that distinguishes timestamp order from primary key order.
    const expired = scenario === "sync";
    const bounded = ["request", "transaction"].includes(scenario);
    const timestamps = expired ? [start - day - 1, start - day, start - 1]
        : bounded ? [start - 100, ...Array(102).fill(start - 200), start - 50]
        : scenario === "concurrent" ? Array(201).fill(start - 1)
        : scenario === "empty" ? [] : [start - 2, start - 1];
    const open = indexedDB.open(name, 1);
    open.onupgradeneeded = () => {
        const store = open.result.createObjectStore("logs", {keyPath: "id", autoIncrement: true});
        store.createIndex("timestamp", "timestamp");
        store.createIndex("level", "level");
        timestamps.forEach((timestamp, index) => store.add({timestamp, level: "info", args: [index + 1]}));
        open.result.createObjectStore("unrelated").add("keep store", "key");
    };
    const database = await result(open);
    const externalOpen = indexedDB.open("other application data", 1);
    externalOpen.onupgradeneeded = () => externalOpen.result.createObjectStore("data").add("keep database", "key");
    const external = await result(externalOpen);
    const reader = new Reader({}, {databaseName: name});
    const options = {databaseName: name, retentionDays: 1, maxEntries: bounded ? 5 : 2000};
    const writer = new Writer({}, options);

    // Observe native transaction outcomes and count freed capacity only after deletion commits.
    const transactions = new Map();
    const warnings = [];
    const unhandled = [];
    const sent = [];
    const outcomes = () => Array.from(transactions.values(), entry => entry.outcome).join(",");
    const nativeTransaction = IDBDatabase.prototype.transaction;
    let reclaimed = 0;
    let pressure = expired ? 1 : bounded ? 100 : Infinity;
    let active = 0, maximumActive = 0;
    console.warn = (...args) => warnings.push(args);
    addEventListener("unhandledrejection", event => unhandled.push(event.reason));
    IDBDatabase.prototype.transaction = function (...args) {
        const transaction = nativeTransaction.apply(this, args);
        if (this.name !== name || args[1] !== "readwrite") return transaction;
        check([...transaction.objectStoreNames].join() === "logs", "A writer transaction targeted another store");
        const entry = {adds: [], deletes: [], outcome: "pending"};
        transactions.set(transaction, entry);
        maximumActive = Math.max(maximumActive, ++active);
        transaction.addEventListener("complete", () => {
            entry.outcome = "commit";
            if (!entry.adds.length) reclaimed += entry.deletes.length;
            active--;
        });
        transaction.addEventListener("abort", () => {
            entry.outcome = "abort";
            active--;
        });
        return transaction;
    };

    // Expose quota errors through the requested boundary while native IndexedDB still rolls back.
    const quota = () => new DOMException("private quota details", "QuotaExceededError");
    const nativeAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (record) {
        const transaction = this.transaction;
        const entry = transactions.get(transaction);
        if (!entry) return nativeAdd.call(this, record);
        const label = record.args[0];
        entry.adds.push(label);
        if (reclaimed >= pressure || (scenario === "queue" && label !== "oversized")) return nativeAdd.call(this, record);
        if (label === "before quota") return nativeAdd.call(this, record);
        if (scenario === "request") {
            // Let a real duplicate-key error abort the transaction. Expose quota at the failing request.
            const request = nativeAdd.call(this, {...record, id: 1});
            Object.defineProperty(request, "error", {get: quota});
            return request;
        }
        if (scenario === "transaction" || scenario === "ordinary-abort") {
            const request = nativeAdd.call(this, record);
            request.addEventListener("success", () => {
                if (scenario === "transaction") Object.defineProperty(transaction, "error", {get: quota});
                transaction.abort();
            });
            return request;
        }
        if (scenario === "retry-other" && label === "failed" && reclaimed) throw new DOMException("private write details", "UnknownError");
        throw quota();
    };
    const nativeDelete = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (key) {
        const request = nativeDelete.call(this, key);
        const entry = transactions.get(this.transaction);
        entry.deletes.push(key);
        if (entry.deletes.length === 1 && !entry.adds.length) {
            if (scenario === "reclamation-abort") request.addEventListener("success", () => this.transaction.abort());
            if (scenario === "queue") {
                for (let index = 0; index < 1006; index++) writer.log("info", index);
            }
        }
        return request;
    };

    // Guard against blanket deletion and capture only notifications sent on this database's channel.
    const blanketDeletes = [];
    IDBObjectStore.prototype.clear = () => { blanketDeletes.push("clear"); throw new Error("Unexpected object store clear"); };
    indexedDB.deleteDatabase = () => { blanketDeletes.push("database"); throw new Error("Unexpected database deletion"); };
    const nativePost = BroadcastChannel.prototype.postMessage;
    let failPost = scenario === "transaction";
    BroadcastChannel.prototype.postMessage = function (data) {
        if (this.name === logChannelName(name)) {
            sent.push({data, outcomes: outcomes()});
            if (failPost) {
                failPost = false;
                throw new Error("Notification failed");
            }
        }
        return nativePost.call(this, data);
    };
    const rows = async () => (await reader.query({order: "asc", limit: 500})).items;
    const entries = () => [...transactions.values()];

    if (expired || bounded) {
        // Force rollback of a queued insert and prove the retry uses both original snapshots.
        const snapshot = {kept: true};
        now--;
        writer.log("warn", "before quota", snapshot, 42);
        now++;
        writer.log("error", "needs capacity", 23, snapshot);
        snapshot.kept = false;
        await until(() => sent.length === 2, "Reclamation or retry did not commit");
        check(outcomes() === "abort,commit,commit", "Write, reclamation and retry were not independent");
        const [failed, recovery, retry] = entries();
        check(failed.adds.join() === "before quota,needs capacity" && retry.adds.join() === failed.adds.join()
            && !recovery.adds.length, "The retry did not use exactly the original batch");
        const expected = expired ? [1] : Array.from({length: 100}, (_, index) => index + 2);
        check(recovery.deletes.join() === expected.join(), "Wrong expired or oldest records reclaimed");
        check(retry.deletes.join() === (expired ? "" : "102"), "Retry did not apply normal retention");
        const stored = await rows();
        check(stored.slice(0, -2).map(row => row.id).join() === (expired ? "2,3" : "103,1,104"), "Wrong retained rows");
        const [first, second] = stored.slice(-2);
        check(first.timestamp === start - 1 && first.level === "warn" && first.args[1].kept && first.args[2] === 42
            && second.timestamp === start && second.level === "error" && second.args[1] === 23 && second.args[2].kept,
            "Retried records lost their original snapshots");
        check(sent.map(entry => entry.outcomes).join("|") === "abort,commit|abort,commit,commit" && !warnings.length,
            "Notification timing or recovery diagnostics changed");

        // A successful recovery leaves the next quota failure eligible to reclaim immediately.
        pressure = reclaimed + 1;
        writer.log("info", "next pressure");
        await until(() => sent.length === 4, "Recovery success suppressed the next reclamation");
        check(outcomes() === "abort,commit,commit,abort,commit,commit", "The next quota recovery was not bounded");
    } else if (scenario === "queue") {
        writer.log("error", "oversized");
        await until(() => sent.length === 11, "The writer did not drain the queue after a failed retry");
        const queued = entries().slice(3);
        check(outcomes().startsWith("abort,commit,abort,") && queued.length === 10 && queued.every(entry => entry.adds.length === 100),
            "Recovery, retry and queued writes did not run sequentially in bounded batches");
        check(queued.flatMap(entry => entry.adds).every((value, index) => value === index + 6), "Queue order or overflow policy changed during recovery");
        check(await result(database.transaction("logs").objectStore("logs").count()) === 1000 && warnings.length === 1,
            "The oversized record persisted or later records were lost");
    } else if (scenario === "concurrent") {
        // Both instances hit quota and share the native transaction queue.
        pressure = 1;
        writer.log("info", "first instance");
        new Writer({}, options).log("info", "second instance");
        await until(() => entries().filter(entry => entry.adds.length && entry.outcome === "commit").length === 2,
            "Concurrent providers did not both commit");
        const stored = await rows();
        check(stored.slice(-2).map(row => row.args[0]).sort().join() === "first instance,second instance"
            && stored.slice(0, -2).every((row, index) => row.id === reclaimed + index + 1)
            && stored.length === 203 - reclaimed,
            "Concurrent recovery displaced another provider's committed record");
    } else {
        // Observe committed deletions even when the retry is discarded.
        const changes = [];
        const unsubscribe = await reader.subscribe(async change => changes.push({change, rows: await rows()}));
        writer.log("warn", "failed");
        await until(() => warnings.length === 1, "A failed write was not reported");
        const retried = ["retry-quota", "retry-other"].includes(scenario);
        const expected = scenario === "ordinary-abort" ? "abort" : scenario === "reclamation-abort" ? "abort,abort"
            : retried ? "abort,commit,abort" : "abort,commit";
        check(outcomes() === expected && sent.length === Number(retried), "Unexpected retry or notification from a failed write");
        check((await rows()).length === (retried ? 0 : timestamps.length), "Failed work committed or undid committed deletions");
        if (retried) {
            await until(() => changes.length === 1, "Reader missed committed deletion after a failed retry");
            check(!changes[0].rows.length && changes[0].change.type === "changed", "Reader did not observe the committed deletion");
        }
        unsubscribe();

        if (scenario !== "ordinary-abort") {
            // A write at 29,999 ms still runs but skips reclamation. Exactly 30 seconds unlocks it.
            now += 29999;
            writer.log("info", "during cooldown");
            await until(() => outcomes() === expected + ",abort", "Ordinary writes stalled during cooldown or reclaimed again");
            if (scenario === "empty") {
                now++;
                writer.log("warn", "at expiry");
                await until(() => outcomes() === expected + ",abort,abort,commit", "Recovery stayed blocked after cooldown expiry");
            }
            check(warnings.length === 1 && sent.length === Number(retried), "Failures repeated a warning or published a signal");
        }

        // An ordinary success clears both warning suppression and any active cooldown.
        pressure = 0;
        writer.log("info", "ordinary success");
        await until(() => sent.length === Number(retried) + 1, "Writer stopped processing ordinary writes");
        pressure = Infinity;
        const before = entries().length;
        writer.log("error", "after success");
        await until(() => warnings.length === 2, "Successful write did not reset warning suppression");
        const after = entries().slice(before).map(entry => entry.outcome).join();
        check(after === (scenario === "ordinary-abort" ? "abort" : scenario === "reclamation-abort" ? "abort,abort" : "abort,commit,abort"),
            "Successful ordinary write did not reset cooldown or a retry ran twice");
    }

    check(scenario === "concurrent" || maximumActive === 1, "One provider overlapped read-write transactions");
    check(!unhandled.length && warnings.every(args => JSON.stringify(args) === '["IndexedDB logger could not persist a batch."]'),
        "A failure escaped the writer or exposed private diagnostics");
    check(sent.every(({data}) => JSON.stringify(data) === '{"type":"logs:changed"}'), "Notification exposed record data");
    check(!blanketDeletes.length && await result(database.transaction("unrelated").objectStore("unrelated").get("key")) === "keep store"
        && await result(external.transaction("data").objectStore("data").get("key")) === "keep database", "Recovery touched unrelated storage");
    database.close();
    external.close();
}

test("IndexedDB quota recovery commits deletions before retrying after each kind of quota error", chromiumOnly,
    () => runInChromium(verifyQuotaRecovery, ["sync", "request", "transaction"].map(name => "scenario=" + name), {realTime: true}));
test("IndexedDB quota recovery bounds failed retries, cooldown, notifications and concurrent queue processing", chromiumOnly,
    () => runInChromium(verifyQuotaRecovery, ["empty", "reclamation-abort", "retry-quota", "retry-other", "ordinary-abort", "queue", "concurrent"]
        .map(name => "scenario=" + name), {realTime: true}));
