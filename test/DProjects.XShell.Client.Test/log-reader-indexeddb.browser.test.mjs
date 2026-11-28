import test from "node:test";
import {chromiumOnly, runInChromium} from "./helpers/chromium.mjs";

async function verifyLogReader() {
    const {default: Reader} = await import("/resources/x-logs/providers/log-reader-indexeddb.js");
    const {default: Writer} = await import("/resources/x-logs/providers/logger-indexeddb.js");
    const {default: Resolver} = await import("/resources/xshell/services/resolver.js");
    const scenario = new URLSearchParams(location.search).get("scenario");
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const wait = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));
    const until = async (condition, message) => {
        for (let attempt = 0; attempt < 150; attempt++) {
            if (await condition()) return;
            await wait();
        }
        throw new Error(message);
    };
    const reject = async (action, message) => {
        try { await action(); }
        catch (error) { check(message.test(error.message), error.message); return; }
        throw new Error("Expected failure: " + message);
    };
    const result = request => new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    if (scenario === "queries") {
        // Seed the former module's version 1 schema independently, without constructing an active writer.
        const name = "demo%2Dapp-shared-xshell-logs";
        const path = "/_assets/xshell/0.9.0.dev";
        const config = {app: {basePath: "/demo-app/shared/", baseUrl: location.origin + "/"}, xshell: {assets: {path}, resolver: {
            esm: {[path + "/utils/urls.js"]: {src: "/resources/xshell/utils/urls.js"}}
        }}};
        const dependencies = {config, resolver: new Resolver({config})};
        const request = indexedDB.open(name, 1);
        const levels = ["trace", "debug", "info", "warn", "error"];
        const unicode = "棚卸し 📦".repeat(100);
        request.onupgradeneeded = () => {
            const store = request.result.createObjectStore("logs", {keyPath: "id", autoIncrement: true});
            store.createIndex("timestamp", "timestamp");
            store.createIndex("level", "level");
            const cyclic = {label: "original"};
            cyclic.self = cyclic;
            for (const [index, level] of levels.entries()) {
                const category = [undefined, unicode, "other", "Other", unicode][index];
                store.add({timestamp: index <= 2 ? 10 : 20, level, ...(category === undefined ? {} : {category}), args: [level, cyclic, 23n, new Error("historical"),
                    new Map([["key", 4]]), new Set([5]), {unserializable: true}]});
            }
        };
        const database = await result(request);
        const reader = new Reader(dependencies);
        const empty = await new Reader({}, {databaseName: "new"}).query();
        check(!empty.items.length && empty.nextCursor === null && !empty.hasMore, "New reader did not initialize an empty database");
        const all = await reader.query({order: "asc", limit: 5});
        const byId = page => page.items.map(record => record.id).join();
        check(byId(all) === "1,2,3,4,5" && all.nextCursor === null && !all.hasMore, "Exact-sized final page or chronological order incorrect");
        check(all.items.map(row => row.level).join() === levels.join(), "Severity vocabulary changed");
        const args = all.items[0].args;
        check(args[1].self === args[1] && args[2] === 23n && args[3] instanceof Error && args[3].message === "historical"
            && args[4].get("key") === 4 && args[5].has(5) && args[6].unserializable, "Stored arguments were reconstructed incorrectly");
        check(Object.keys(all.items[0]).sort().join() === "args,category,id,level,timestamp" && all.items[0].category === null,
            "Legacy record did not return an explicit null category");
        check(!(await result(database.transaction("logs").objectStore("logs").get(1))).hasOwnProperty("category"), "Historical record was rewritten");
        for (const level of levels) check((await reader.query({levels: [level]})).items[0]?.level === level, "Individual severity unavailable");
        check(!(await reader.query({levels: []})).items.length, "Empty severity selection returned rows");
        check(byId(await reader.query({from: 10, to: 10})) === "3,2,1", "Inclusive timestamp filtering failed");
        check(byId(await reader.query({from: 10, to: 20, levels: ["error", "info"]})) === "5,3", "Multiple severity filters failed");
        const sparse = await reader.query({limit: 1, levels: ["debug", "error"]});
        check(byId(sparse) === "5" && sparse.hasMore, "Lookahead failed to skip nonmatching rows");
        check(byId(await reader.query({cursor: sparse.nextCursor, levels: ["error", "debug"]})) === "2", "Equivalent filter ordering rejected a cursor");
        check(byId(await reader.query({categories: [unicode]})) === "5,2", "Unicode category filter failed");
        check(byId(await reader.query({categories: ["other"]})) === "3", "Category matching was not exact");
        check(byId(await reader.query({categories: [null]})) === "1", "Uncategorized filter failed");
        check(!(await reader.query({categories: []})).items.length, "Empty category selection returned rows");
        check(byId(await reader.query({categories: [unicode, "other"], levels: ["debug", "info", "warn"], to: 10})) === "3,2",
            "Categories did not combine with severity and time bounds");
        const options = {categories: [unicode, null], limit: 1};
        const categoryPage = await reader.query(options);
        check(byId(categoryPage) === "5" && categoryPage.hasMore && categoryPage.nextCursor.length > 512, "Category lookahead or long cursor failed");
        check(byId(await reader.query({categories: [null, unicode, unicode], cursor: categoryPage.nextCursor})) === "2,1",
            "Equivalent category selection rejected the Unicode cursor or lost matching records");
        for (const categories of [undefined, [], [null], [unicode]]) {
            await reject(() => reader.query({categories, cursor: categoryPage.nextCursor}), /cursor/);
        }
        await reject(() => new Reader({}, {databaseName: "new"}).query({...options, cursor: categoryPage.nextCursor}), /cursor/);
        for (const categories of [null, "other", [""], [1], [undefined], Array(1)]) {
            await reject(() => reader.query({categories}), /categories/);
        }
        check(JSON.stringify(await reader.getCategories()) === JSON.stringify([null, "Other", "other", unicode]), "Category discovery lost or duplicated values");

        // Walk timestamp ties in both directions and continue after removing the cursor records.
        const asc = await reader.query({order: "asc", limit: 2});
        const desc = await reader.query({order: "desc", limit: 1});
        check(byId(asc) === "1,2" && byId(desc) === "5", "Timestamp tie-breaking is incorrect");
        check(await result(database.transaction("logs").objectStore("logs").count()) === 5, "Queries changed persisted records");
        const removal = database.transaction("logs", "readwrite");
        const committed = new Promise(resolve => { removal.oncomplete = resolve; });
        removal.objectStore("logs").delete(2);
        removal.objectStore("logs").delete(5);
        await committed;
        check(JSON.stringify(await reader.getCategories()) === JSON.stringify([null, "Other", "other"]), "Category discovery did not reflect committed deletion");
        check(byId(await reader.query({cursor: asc.nextCursor, order: "asc", limit: 500})) === "3,4", "Ascending cursor depended on deleted row");
        check(byId(await reader.query({cursor: desc.nextCursor})) === "4,3,1", "Descending cursor depended on deleted row");
        for (const [options, pattern] of [
            [{cursor: asc.nextCursor}, /cursor/], [{cursor: asc.nextCursor, from: 10, order: "asc"}, /cursor/],
            [{cursor: "corrupt"}, /cursor/], [{cursor: 7}, /cursor/], [{levels: ["fatal"]}, /levels/],
            [{from: "10"}, /from/], [{to: Infinity}, /to/], [{from: 3, to: 0}, /from/], [{limit: 501}, /limit/],
            [{limit: 1.5}, /limit/], [{order: "next"}, /order/], [{unknown: true}, /unknown/i]
        ]) await reject(() => reader.query(options), pattern);
        const nativeTransaction = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function (...args) {
            const transaction = nativeTransaction.apply(this, args);
            if (this.name === name && args[1] === "readonly") transaction.abort();
            return transaction;
        };
        await reject(() => reader.query(), /transaction|abort/i);
        IDBDatabase.prototype.transaction = nativeTransaction;
        database.close();
        await result(indexedDB.deleteDatabase(name));
        check(!(await reader.query()).items.length, "Reader did not reopen after a version change");
        check(!(await reader.getCategories()).length, "Empty storage reported categories");
    } else if (scenario === "observation") {
        const name = "shared logs";
        const {logChannelName} = await import("/resources/x-logs/utils/indexeddb.js");
        const transport = new BroadcastChannel(logChannelName(name));
        const wire = [];
        transport.onmessage = event => wire.push(event.data);
        const reader = new Reader({}, {databaseName: name});
        const independent = new Reader({}, {databaseName: "other logs"});
        const writer = new Writer({}, {databaseName: name, maxEntries: 2});
        const errors = [];
        addEventListener("unhandledrejection", event => errors.push(event.reason));
        const affected = [];
        let otherCalls = 0;
        const leaveOther = await independent.subscribe(() => otherCalls++);
        const leaveThrow = await reader.subscribe(() => { throw new Error("subscriber error"); });
        const leaveReject = await reader.subscribe(async () => { throw new Error("async subscriber error"); });
        const leaveHealthy = await reader.subscribe(async change => affected.push({change, items: (await reader.query()).items}));
        const nativeAdd = IDBObjectStore.prototype.add;
        const originalWarn = console.warn;
        let aborted;
        console.warn = () => { aborted = true; };
        IDBObjectStore.prototype.add = function (...args) {
            const request = nativeAdd.apply(this, args);
            request.addEventListener("success", () => this.transaction.abort(), {once: true});
            return request;
        };
        writer.log("warn", null, "abort this");
        await until(() => aborted, "Writer did not finish its aborted transaction");
        check(!wire.length && !affected.length && !(await reader.query()).items.length, "An aborted write notified observers");
        IDBObjectStore.prototype.add = nativeAdd;
        console.warn = originalWarn;
        for (const argument of ["first", "second", "third"]) writer.log("info", null, argument);
        await until(() => affected.length === 1, "Same-context subscriber was not notified");
        check(affected[0].items.map(item => item.args[0]).join() === "third,second", "Notification preceded commit or retention");
        check(JSON.stringify(affected[0].change) === '{"type":"changed"}' && JSON.stringify(wire) === '[{"type":"logs:changed"}]',
            "Notification exposed data or was repeated for one batch");

        // Write from a separate same-origin window context that shares the browser storage partition.
        const frame = document.createElement("iframe");
        frame.srcdoc = `<script type="module">
            import Writer from "/resources/x-logs/providers/logger-indexeddb.js";
            new Writer({}, {databaseName: "shared logs", maxEntries: 2}).log("error", null, "separate context");
        <\/script>`;
        document.body.append(frame);
        await until(() => affected.some(message => message.items[0]?.args[0] === "separate context"), "Separate browser context did not notify");
        check(otherCalls === 0 && errors.length === 0 && wire.length === 2, "Database or subscriber isolation failed");
        leaveHealthy();
        leaveHealthy();
        leaveThrow();
        leaveReject();
        leaveOther();
        writer.log("warn", null, "after unsubscribe");
        await until(() => wire.length === 3, "Final test write did not commit");
        await wait(50);
        check(affected.length === 2, "Unsubscribed listener received a change");
        transport.close();
    } else {
        // Exercise the real timer without BroadcastChannel and verify observation resources are released.
        globalThis.BroadcastChannel = undefined;
        const reader = new Reader({}, {databaseName: "polling"});
        const originalSet = globalThis.setInterval;
        const originalClear = globalThis.clearInterval;
        const timers = new Set();
        let created = 0;
        globalThis.setInterval = (...args) => {
            const timer = originalSet(...args);
            timers.add(timer);
            created++;
            return timer;
        };
        globalThis.clearInterval = timer => {
            timers.delete(timer);
            originalClear(timer);
        };
        await reader.query();
        check(created === 0, "A query created a timer");
        let notifications = 0;
        const notified = Promise.withResolvers();
        const callback = () => { notifications++; if (notifications === 2) notified.resolve(); };
        const first = await reader.subscribe(callback);
        const second = await reader.subscribe(callback);
        check(timers.size === 1 && created === 1, "Subscriptions did not share a timer");
        await Promise.race([notified.promise, wait(6500).then(() => { throw new Error("Polling reconciliation did not occur"); })]);
        first();
        first();
        check(timers.size === 1, "Unsubscribing one callback stopped polling");
        second();
        check(!timers.size, "Final unsubscribe left polling active");
    }
}

test("IndexedDB Log Reader preserves old records and paginates deterministically", chromiumOnly,
    () => runInChromium(verifyLogReader, ["scenario=queries"], {realTime: true}));
test("IndexedDB Log Reader observes committed batches across browser contexts", chromiumOnly,
    () => runInChromium(verifyLogReader, ["scenario=observation", "scenario=polling"], {realTime: true}));
