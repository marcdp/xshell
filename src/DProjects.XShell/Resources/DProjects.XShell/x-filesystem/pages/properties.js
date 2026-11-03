
import { Features } from "../js/filesystem.js";

// utils
const formatSize = bytes => {
    if (!Number.isFinite(bytes) || bytes < 0) return "Unknown";
    if (bytes < 1024) return `${bytes} bytes`;
    const units = ["KB", "MB", "GB", "TB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)) - 1, 3);
    return `${(bytes / 1024 ** (i + 1)).toFixed(2)} ${units[i]} (${bytes.toLocaleString()} bytes)`;
};

const formatDate = value => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const formatValue = value => {
    if (value == null) return "";
    if (typeof value !== "object") return String(value);
    try { return JSON.stringify(value); }
    catch { return String(value); }
};

// page
export default {
    contract: {
        description: "Filesystem entry properties",
        events: {},
        properties: {
            src: { type: "string", default: null, state: true, query: true },
            path: { type: "string", default: null, state: true, query: true }
        },
        methods: {}
    },

    meta: { title: "Properties" },

    template: `
        <x-form>
            
            <x-notice x-if="state.error" type="error" x-attr:message="state.error"></x-notice>

            <x-tabs x-if="state.info">
                <x-tab label="General">
                    <x-datafields columns="2">
                        <x-datafield label="Name" type="text" x-prop:value="state.info.name" readonly></x-datafield>
                        <x-datafield label="Type" type="text" x-prop:value="state.info.type" readonly></x-datafield>
                        <x-datafield label="Location" type="text" x-prop:value="state.info.parent" readonly></x-datafield>
                        <x-datafield label="Size" type="text" x-prop:value="state.info.size" readonly></x-datafield>
                    </x-datafields>

                    <x-datafields label="Dates" columns="2">
                        <x-datafield label="Created" type="datetime-local" x-prop:value="state.info.created" readonly></x-datafield>
                        <x-datafield label="Modified" type="datetime-local" x-prop:value="state.info.modified" readonly></x-datafield>
                    </x-datafields>

                    <x-datafields label="Attributes" columns="2">
                        <x-datafield label="Read-only" type="checkbox" x-prop:value="state.info.readonly" readonly></x-datafield>
                    </x-datafields>
                </x-tab>

                <x-tab label="Details">
                    <x-datafields columns="2">
                        <x-datafield label="Filesystem" type="text" x-prop:value="state.src" readonly></x-datafield>
                        <x-datafield label="Full path" type="text" x-prop:value="state.info.path" readonly></x-datafield>
                        <x-datafield label="Flags" type="number" x-prop:value="state.info.flags" readonly></x-datafield>
                        <x-datafield label="ETag" type="text" x-prop:value="state.info.etag" readonly></x-datafield>
                    </x-datafields>

                    <x-datafields label="Metadata" columns="2">
                        <x-datafield x-for="item in state.metadata"
                            x-attr:label="item.name"
                            type="text"
                            x-prop:value="item.value"
                            readonly>
                        </x-datafield>
                    </x-datafields>

                    <x-notice x-if="state.metadataMessage"
                        type="info"
                        x-attr:message="state.metadataMessage">
                    </x-notice>
                </x-tab>
            </x-tabs>
        </x-form>
    `,

    state: {
        src: null,
        path: null,
        loading: false,
        error: "",
        info: null,
        metadata: [],
        metadataMessage: ""
    },

    controller({ state, loader, page }) {
        let filesystem = null;
        let source = null;
        let abortController = null;

        return {
            async load() {
                await this.refresh();
            },

            unload() {
                abortController?.abort();
            },

            async refresh() {
                abortController?.abort();
                abortController = new AbortController();
                const signal = abortController.signal;

                state.loading = true;
                state.error = "";
                state.info = null;
                state.metadata = [];
                state.metadataMessage = "";

                try {
                    if (!state.src || !state.path)
                        throw new Error("Filesystem source and path are required.");

                    if (!filesystem || source !== state.src) {
                        const fs = await loader.load("filesystem:" + state.src);
                        signal.throwIfAborted();
                        filesystem = fs;
                        source = state.src;
                    }

                    const entry = await filesystem.getEntry(state.path, { signal });
                    signal.throwIfAborted();
                    if (!entry) throw new Error("Entry not found: " + state.path);

                    const path = entry.path || state.path;
                    const name = entry.name || path.split("/").pop() || "/";
                    const isDirectory = entry.type === "directory";
                    const flags = Number(entry.flags) || 0;
                    const extension = name.includes(".") ? name.split(".").pop().toUpperCase() : "";

                    state.info = {
                        name,
                        path,
                        parent: path === "/" ? "/" : path.slice(0, path.lastIndexOf("/")) || "/",
                        type: isDirectory ? "File folder" : extension ? `${extension} file` : "File",
                        size: isDirectory ? "Not calculated" : formatSize(entry.length),
                        created: formatDate(entry.created),
                        modified: formatDate(entry.modified),
                        readonly: filesystem.isReadonly || (flags & 1) ? "Yes" : "No",
                        flags,
                        etag: entry.etag || ""
                    };

                    state.loading = false;

                    // Optional provider metadata, without directory enumeration.
                    try {
                        if (await filesystem.supports(path, Features.Metadata, { signal })) {
                            const metadata = await filesystem.getMetadata(path, { signal });
                            signal.throwIfAborted();

                            const entries = metadata instanceof Map
                                ? [...metadata.entries()]
                                : Object.entries(metadata || {});

                            state.metadata = entries.map(([name, value]) => ({
                                name: String(name),
                                value: formatValue(value)
                            }));

                            if (!entries.length) state.metadataMessage = "No additional metadata.";
                        } else {
                            state.metadataMessage = "Metadata is not supported by this filesystem.";
                        }
                    } catch (error) {
                        if (!signal.aborted) state.metadataMessage = error.message;
                    }

                } catch (error) {
                    if (!signal.aborted) state.error = error.message || String(error);
                } finally {
                    if (!signal.aborted) state.loading = false;
                }
            }
        };
    }
};
