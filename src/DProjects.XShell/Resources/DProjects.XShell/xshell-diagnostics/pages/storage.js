
 // helpers
const encoder = new TextEncoder();
const MAX_RECORDS_PER_DATABASE = 3000;

const formatBytes = bytes => {
    if (bytes == null) return "Unavailable";
    if (bytes < 1024) return `${bytes} B`;
    const unit = Math.min(4, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / (1024 ** unit)).toFixed(2)} ${["B", "KiB", "MiB", "GiB", "TiB"][unit]}`;
};

// Estimate structured-clone payload bytes without exposing values
function estimateValue(value, seen = new WeakSet()) {
    if (value == null) return 4;
    if (typeof value === "string") return encoder.encode(value).byteLength;
    if (typeof value === "number") return 8;
    if (typeof value === "boolean") return 1;
    if (typeof value === "bigint") return encoder.encode(String(value)).byteLength;
    if (typeof value !== "object" || seen.has(value)) return 0;

    seen.add(value);

    if (value instanceof Blob) return value.size;
    if (value instanceof ArrayBuffer) return value.byteLength;
    if (ArrayBuffer.isView(value)) return value.byteLength;
    if (value instanceof Date) return 8;

    if (value instanceof Map) {
        return [...value].reduce((sum, [key, item]) =>
            sum + estimateValue(key, seen) + estimateValue(item, seen), 0);
    }
    if (value instanceof Set) {
        return [...value].reduce((sum, item) =>
            sum + estimateValue(item, seen), 0);
    }

    return Object.entries(value).reduce((sum, [key, item]) =>
        sum + estimateValue(key, seen) + estimateValue(item, seen), 0);
}

// page
export default {
    contract: {
        description: "Read-only browser storage diagnostics for the current origin.",
        events: {},
        properties: {},
        methods: {}
    },

    meta: {
        title: "Storage"
    },

    template: `
        <p>Storage usage for this origin. IndexedDB sizes are estimates; cookie bytes cover only cookies visible to JavaScript.</p>

        <x-notice x-if="state.busy" type="working" label="Working"></x-notice>

        <p x-show="!state.busy && state.error">{{ state.error }}</p>

        <x-form x-if="!state.busy">

            <x-datafields>
                <x-datafield label="Origin">
                    <span>{{ state.origin }}</span>
                </x-datafield>
                <x-datafield label="Browser-reported usage">
                    <span>{{ state.usage }}</span>
                </x-datafield>
                <x-datafield label="Browser-reported quota">
                    <span>{{ state.quota }}</span>
                </x-datafield>
                <x-datafield label="Persistent storage">
                    <span>{{ state.persistent }}</span>
                </x-datafield>
            </x-datafields>

            <x-listview view="details">
                <x-listview-head>
                    <x-listview-column label="Storage" width="12em"></x-listview-column>
                    <x-listview-column label="Item"></x-listview-column>
                    <x-listview-column label="Size" width="9em" style="text-align:right"></x-listview-column>
                    <x-listview-column label="Count" width="6em" style="text-align:right"></x-listview-column>
                    <x-listview-column label="Notes"></x-listview-column>
                </x-listview-head>
                <x-listview-body>
                    <x-listview-item x-for="item in state.items" x-attr:label="item.kind" icon="x-database">
                        <div>{{ item.name }}</div>
                        <div style="text-align:right">{{ item.sizeLabel }}</div>
                        <div style="text-align:right">{{ item.countLabel }}</div>
                        <div>{{ item.note }}</div>
                    </x-listview-item>
                </x-listview-body>
            </x-listview>
            
            <x-button slot="footer" label="Refresh" icon="x-refresh" command="refresh"></x-button>
            
        </x-form>
    `,

    state: {
        busy: false,
        error: "",
        origin: "",
        usage: "Unavailable",
        quota: "Unavailable",
        persistent: "Unknown",
        items: []
    },

    controller({ state }) {
        let refreshRevision = 0;

        const row = (kind, name, bytes, count, note = "") => ({
            kind,
            name,
            sizeLabel: formatBytes(bytes),
            countLabel: count == null ? "—" : String(count),
            note
        });

        return {
            load() {
                // Collect storage usage when the diagnostics page loads
                this.refresh();
            },

            async refresh() {
                // Ignore results from older overlapping scans
                const revision = ++refreshRevision;
                state.busy = true;
                state.error = "";
                state.origin = location.origin;

                const tasks = await Promise.allSettled([
                    this.webStorage("localStorage"),
                    this.webStorage("sessionStorage"),
                    this.cookies(),
                    this.indexedDBs(),
                    this.opfs(),
                    this.cacheStorage(),
                    this.estimate()
                ]);

                if (revision !== refreshRevision) return;

                const labels = [
                    "localStorage",
                    "sessionStorage",
                    "Cookies",
                    "IndexedDB",
                    "OPFS",
                    "Cache Storage",
                    "Quota"
                ];

                const rows = [];

                for (let i = 0; i < tasks.length; i++) {
                    const result = tasks[i];

                    if (result.status === "fulfilled") {
                        if (i === 6) {
                            state.usage = formatBytes(result.value.usage);
                            state.quota = formatBytes(result.value.quota);
                            state.persistent = result.value.persistent;
                        } else {
                            rows.push(...result.value);
                        }
                    } else {
                        rows.push(row(
                            labels[i], "", null, null,
                            result.reason?.message ?? "Unavailable"
                        ));
                    }
                }

                state.items = rows;
                state.busy = false;
            },

            async webStorage(name) {
                // Calculate approximate UTF-16 key/value payload sizes
                const storage = window[name];
                let bytes = 0;

                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    if (key != null) {
                        bytes += 2 * (key.length + (storage.getItem(key)?.length ?? 0));
                    }
                }

                return [
                    row(name, "Key/value entries", bytes, storage.length,
                        "Approximate UTF-16 payload; excludes browser overhead")
                ];
            },

            async cookies() {
                // Read cookies visible to JavaScript without exposing values
                const value = document.cookie;
                const count = value ? value.split(/;\s*/).length : 0;

                return [
                    row("Cookies", "Visible cookie header",
                        encoder.encode(value).byteLength, count,
                        "Excludes HttpOnly cookies, metadata, and inaccessible cookies")
                ];
            },

            async indexedDBs() {
                // Enumerate IndexedDB databases where supported
                if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") {
                    return [
                        row("IndexedDB", "Databases", null, null,
                            "Database enumeration unsupported")
                    ];
                }

                const databases = await indexedDB.databases();

                if (!databases.length) {
                    return [row("IndexedDB", "Databases", 0, 0, "No databases reported")];
                }

                const items = [];

                for (const info of databases) {
                    if (!info.name) {
                        items.push(row("IndexedDB", "Unnamed database", null, null,
                            "Cannot inspect an unnamed database"));
                        continue;
                    }

                    try {
                        const estimate = await this.inspectDatabase(info.name);

                        items.push(row(
                            "IndexedDB",
                            info.name,
                            estimate.bytes,
                            estimate.records,
                            `Version ${info.version ?? "?"}; ${estimate.stores} stores; ` +
                            `estimated keys/values${estimate.partial ? `; limited to ${MAX_RECORDS_PER_DATABASE} records` : ""}`
                        ));
                    } catch (error) {
                        items.push(row("IndexedDB", info.name, null, null, error.message));
                    }
                }

                return items;
            },

            async inspectDatabase(name) {
                // Open an existing database without upgrading its schema
                const database = await new Promise((resolve, reject) => {
                    const request = indexedDB.open(name);

                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error ?? new Error("Could not open database"));
                    request.onblocked = () => reject(new Error("Database open blocked"));
                    request.onupgradeneeded = () => {
                        request.transaction.abort();
                        reject(new Error("Database was removed during inspection"));
                    };
                });

                try {
                    const stores = Array.from(database.objectStoreNames);
                    let bytes = 0;
                    let records = 0;
                    let partial = false;

                    // Scan records with a maximum per-database limit
                    for (const storeName of stores) {
                        if (records >= MAX_RECORDS_PER_DATABASE) {
                            partial = true;
                            break;
                        }

                        const limit = MAX_RECORDS_PER_DATABASE - records;

                        const result = await new Promise((resolve, reject) => {
                            const tx = database.transaction(storeName, "readonly");
                            const request = tx.objectStore(storeName).openCursor();

                            let size = 0;
                            let count = 0;
                            let truncated = false;

                            request.onsuccess = () => {
                                const cursor = request.result;
                                if (!cursor) return;

                                size += estimateValue(cursor.primaryKey);
                                size += estimateValue(cursor.value);
                                count++;

                                if (count >= limit) {
                                    truncated = true;
                                    return;
                                }

                                cursor.continue();
                            };

                            tx.oncomplete = () => resolve({ size, count, truncated });
                            tx.onerror = () => reject(tx.error ?? new Error(`Failed to read ${storeName}`));
                            tx.onabort = () => reject(tx.error ?? new Error(`Reading ${storeName} was aborted`));
                        });

                        bytes += result.size;
                        records += result.count;

                        if (result.truncated) {
                            partial = true;
                            break;
                        }
                    }

                    return {
                        bytes,
                        records,
                        stores: stores.length,
                        partial
                    };
                } finally {
                    database.close();
                }
            },

            async opfs() {
                // Measure files in the origin-private filesystem
                if (!navigator.storage?.getDirectory) {
                    return [
                        row("OPFS", "Origin-private files", null, null,
                            "OPFS API unavailable")
                    ];
                }

                const root = await navigator.storage.getDirectory();
                let bytes = 0;
                let files = 0;
                let directories = 0;

                const visit = async directory => {
                    for await (const [, handle] of directory.entries()) {
                        if (handle.kind === "directory") {
                            directories++;
                            await visit(handle);
                        } else {
                            bytes += (await handle.getFile()).size;
                            files++;
                        }
                    }
                };

                await visit(root);

                return [
                    row("OPFS", "Origin-private files", bytes, files,
                        `${directories} directories; actual file payload bytes`)
                ];
            },

            async cacheStorage() {
                // Read cache names and entry counts without reading responses
                if (!globalThis.caches) {
                    return [
                        row("Cache Storage", "Caches", null, null,
                            "Cache API unavailable")
                    ];
                }

                const names = await caches.keys();
                const result = [];

                for (const name of names) {
                    try {
                        const cache = await caches.open(name);
                        const keys = await cache.keys();

                        result.push(row(
                            "Cache Storage",
                            name,
                            null,
                            keys.length,
                            "Entry count only; exact byte size unavailable"
                        ));
                    } catch (error) {
                        result.push(row("Cache Storage", name, null, null, error.message));
                    }
                }

                return result.length
                    ? result
                    : [row("Cache Storage", "Caches", null, 0, "No caches found")];
            },

            async estimate() {
                // Query the browser's origin-wide storage estimate
                if (!navigator.storage?.estimate) {
                    return { usage: null, quota: null, persistent: "Unknown" };
                }

                const estimate = await navigator.storage.estimate();
                const persistent = navigator.storage.persisted
                    ? await navigator.storage.persisted()
                    : null;

                return {
                    usage: estimate.usage ?? null,
                    quota: estimate.quota ?? null,
                    persistent: persistent == null ? "Unknown" : persistent ? "Yes" : "No"
                };
            }
        };
    }
};
