
import Filesystem, {
    EntryType,
    Features,
    GetModes,
    pathName,
    validatePath
} from "./filesystem.js";

// constants
const READONLY_FLAG = 1;

// utils
function checkAbort(signal) {
    if (!signal?.aborted) return;
    if (typeof signal.throwIfAborted === "function") {
        signal.throwIfAborted();
    }
    const error = new Error("Filesystem operation aborted");
    error.name = "AbortError";
    throw error;
}

function parentPath(path) {
    const index = path.lastIndexOf("/");
    return index === 0 ? "/" : path.slice(0, index);
}

function matchesPattern(name, pattern) {
    if (pattern == null) return true;
    if (typeof pattern !== "string") {
        throw new TypeError("pattern must be a string or null");
    }

    let expression = "^";
    for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];
        if (char === "*") expression += ".*";
        else if (char === "?") expression += ".";
        else if (char === "#") expression += "[0-9]";
        else expression += char.replace(
            /[\\^$.*+?()[\]{}|]/g, "\\$&"
        );
    }

    return new RegExp(expression + "$").test(name);
}

function toBytes(chunk) {
    if (chunk instanceof ArrayBuffer) {
        return new Uint8Array(chunk.slice(0));
    }

    if (ArrayBuffer.isView(chunk)) {
        return new Uint8Array(
            chunk.buffer,
            chunk.byteOffset,
            chunk.byteLength
        ).slice();
    }

    throw new TypeError(
        "File content must be binary data, Blob, string or ReadableStream"
    );
}

async function readBytes(input, signal) {
    checkAbort(signal);

    if (typeof input === "string") {
        return new TextEncoder().encode(input);
    }

    if (typeof Blob !== "undefined" && input instanceof Blob) {
        const result = new Uint8Array(await input.arrayBuffer());
        checkAbort(signal);
        return result;
    }

    if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
        return toBytes(input);
    }

    if (input && typeof input.getReader === "function") {
        const reader = input.getReader();
        const chunks = [];
        let length = 0;

        const onAbort = () => {
            void reader.cancel(signal.reason).catch(() => {});
        };

        signal?.addEventListener("abort", onAbort, { once: true });

        try {
            for (;;) {
                checkAbort(signal);

                const { value, done } = await reader.read();
                checkAbort(signal);

                if (done) break;

                const chunk = toBytes(value);
                length += chunk.length;

                if (!Number.isSafeInteger(length)) {
                    throw new RangeError("File content is too large");
                }

                chunks.push(chunk);
            }
        } catch (error) {
            try {
                await reader.cancel(error);
            } catch {
                // Best effort
            }
            throw error;
        } finally {
            signal?.removeEventListener("abort", onAbort);
            reader.releaseLock();
        }

        const result = new Uint8Array(length);
        let offset = 0;

        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        checkAbort(signal);
        return result;
    }

    throw new TypeError(
        "Unsupported file content; expected Blob, binary data, string or ReadableStream"
    );
}

// class
export default class FilesystemMem extends Filesystem {

    // constructor
    constructor({ isReadonly = false } = {}) {
        super({
            url: "mem://",
            isReadonly
        });

        this._entries = new Map();
        this._revision = 0;

        this._entries.set(
            "/",
            this._newEntry("/", EntryType.Directory)
        );
    }

    // methods (private)
    _newEntry(path, type) {
        const now = new Date();

        return {
            path,
            type,
            created: now,
            modified: now,
            length: 0,
            etag: "",
            flags: 0,
            metadata: new Map(),
            content: type === EntryType.File
                ? new Uint8Array(0)
                : null
        };
    }

    _snapshot(entry) {
        return {
            path: entry.path,
            name: pathName(entry.path),
            type: entry.type,
            created: new Date(entry.created),
            modified: new Date(entry.modified),
            length: entry.length,
            etag: entry.etag,
            flags: entry.flags |
                (this.isReadonly ? READONLY_FLAG : 0)
        };
    }

    _markModified(entry, modified = new Date()) {
        entry.modified = new Date(modified);

        if (entry.type === EntryType.File) {
            entry.etag =
                `mem-${++this._revision}-${entry.length}`;
        }
    }

    // methods LEVEL 0
    async getEntry(path, { signal } = {}) {
        validatePath(path);
        checkAbort(signal);

        const entry = this._entries.get(path);

        return entry ? this._snapshot(entry) : null;
    }

    async *getEntries(path, {
        mode = GetModes.All,
        pattern = null,
        signal
    } = {}) {
        validatePath(path);
        checkAbort(signal);

        const parent = this._entries.get(path);

        if (!parent) {
            throw new Error(`Path not found: ${path}`);
        }

        if (parent.type !== EntryType.Directory) {
            throw new Error(`Not a directory: ${path}`);
        }

        if (!Object.values(GetModes).includes(mode)) {
            throw new RangeError(
                `Invalid entries mode: ${mode}`
            );
        }

        const prefix = path === "/" ? "/" : `${path}/`;
        const result = [];

        for (const entry of this._entries.values()) {
            if (entry.path === path ||
                !entry.path.startsWith(prefix)) {
                continue;
            }

            const relative = entry.path.slice(prefix.length);

            if (mode !== GetModes.Descendants &&
                relative.includes("/")) {
                continue;
            }

            if (mode === GetModes.Files &&
                entry.type !== EntryType.File) {
                continue;
            }

            if (mode === GetModes.Directories &&
                entry.type !== EntryType.Directory) {
                continue;
            }

            if (!matchesPattern(pathName(entry.path), pattern)) {
                continue;
            }

            result.push(this._snapshot(entry));
        }

        result.sort((a, b) =>
            a.path < b.path ? -1 :
            a.path > b.path ? 1 : 0
        );

        for (const entry of result) {
            checkAbort(signal);
            yield entry;
        }
    }

    async loadReadStream(path, {
        offset = 0,
        length = -1,
        signal
    } = {}) {
        validatePath(path);
        checkAbort(signal);

        if (!Number.isSafeInteger(offset) || offset < 0 ||
            !Number.isSafeInteger(length) || length < -1) {
            throw new RangeError("Invalid read range");
        }

        const entry = this._entries.get(path);

        if (!entry) {
            throw new Error(`File not found: ${path}`);
        }

        if (entry.type !== EntryType.File) {
            throw new Error(
                `Cannot read a directory: ${path}`
            );
        }

        const end = length === -1
            ? entry.length
            : Math.min(entry.length, offset + length);

        // Snapshot content so subsequent writes cannot
        // modify an already opened stream.
        const bytes = entry.content.slice(
            Math.min(offset, entry.length),
            end
        );

        return new ReadableStream({
            start(controller) {
                try {
                    checkAbort(signal);

                    if (bytes.length > 0) {
                        controller.enqueue(bytes);
                    }

                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            }
        });
    }

    // methods LEVEL 2
    async saveFile(path, data, {
        append = false,
        signal
    } = {}) {
        validatePath(path);
        this._ensureWritable();
        checkAbort(signal);

        if (path === "/") {
            throw new Error(
                "Cannot write to the filesystem root"
            );
        }

        const parent = this._entries.get(parentPath(path));

        if (!parent || parent.type !== EntryType.Directory) {
            throw new Error(
                `Parent directory not found: ${parentPath(path)}`
            );
        }

        const existing = this._entries.get(path);

        if (existing?.type === EntryType.Directory) {
            throw new Error(
                `Cannot overwrite a directory: ${path}`
            );
        }

        const bytes = await readBytes(data, signal);

        this._ensureWritable();
        checkAbort(signal);

        // Recheck after awaiting input.
        if (this._entries.get(parentPath(path)) !== parent) {
            throw new Error(
                `Parent directory no longer exists: ${parentPath(path)}`
            );
        }

        const current = this._entries.get(path);

        if (current?.type === EntryType.Directory) {
            throw new Error(
                `Cannot overwrite a directory: ${path}`
            );
        }

        const entry = current ??
            this._newEntry(path, EntryType.File);

        if (append && current) {
            const combined = new Uint8Array(
                entry.content.length + bytes.length
            );

            combined.set(entry.content);
            combined.set(bytes, entry.content.length);

            entry.content = combined;
        } else {
            entry.content = bytes;
        }

        entry.length = entry.content.length;

        this._markModified(entry);
        this._entries.set(path, entry);

        return this._snapshot(entry);
    }

    async createDirectory(path, { signal } = {}) {
        validatePath(path);
        this._ensureWritable();
        checkAbort(signal);

        if (path === "/") {
            return this._snapshot(this._entries.get("/"));
        }

        let current = "";

        for (const name of path.slice(1).split("/")) {
            checkAbort(signal);

            current += `/${name}`;

            const existing = this._entries.get(current);

            if (existing) {
                if (existing.type !== EntryType.Directory) {
                    throw new Error(
                        `Path is a file, not a directory: ${current}`
                    );
                }
            } else {
                this._entries.set(
                    current,
                    this._newEntry(
                        current,
                        EntryType.Directory
                    )
                );
            }
        }

        return this._snapshot(this._entries.get(path));
    }

    async delete(path, { signal } = {}) {
        validatePath(path);
        this._ensureWritable();
        checkAbort(signal);

        // Preserve the filesystem root.
        if (path === "/") return;

        for (const key of [...this._entries.keys()]) {
            checkAbort(signal);

            if (key === path ||
                key.startsWith(`${path}/`)) {
                this._entries.delete(key);
            }
        }
    }

    async touch(path, modified = new Date(), {
        signal
    } = {}) {
        validatePath(path);
        this._ensureWritable();
        checkAbort(signal);

        const date = modified instanceof Date
            ? modified
            : new Date(modified);

        if (Number.isNaN(date.getTime())) {
            throw new TypeError("Invalid modified date");
        }

        const entry = this._entries.get(path);

        if (entry) {
            this._markModified(entry, date);
        }
    }

    // methods LEVEL 4
    async getMetadata(path, { signal } = {}) {
        validatePath(path);
        checkAbort(signal);

        const entry = this._entries.get(path);

        if (!entry) {
            throw new Error(
                `Metadata path not found: ${path}`
            );
        }

        return Object.fromEntries(entry.metadata);
    }

    async setMetadata(path, metadata, {
        signal
    } = {}) {
        validatePath(path);
        this._ensureWritable();
        checkAbort(signal);

        const entry = this._entries.get(path);

        if (!entry) {
            throw new Error(
                `Metadata path not found: ${path}`
            );
        }

        if (!metadata || typeof metadata !== "object") {
            throw new TypeError(
                "metadata must be an object or Map"
            );
        }

        const result = new Map();

        const pairs = metadata instanceof Map
            ? metadata
            : Object.entries(metadata);

        for (const [rawKey, value] of pairs) {
            if (typeof rawKey !== "string" ||
                !rawKey.trim() ||
                typeof value !== "string") {
                throw new TypeError(
                    "Metadata must contain string keys and values"
                );
            }

            const key = rawKey.trim().toLowerCase();

            if (!result.has(key)) {
                result.set(key, value);
            }
        }

        entry.metadata = result;
    }

    async supports(path, feature, {
        signal
    } = {}) {
        validatePath(path);
        checkAbort(signal);

        return feature === Features.Touch ||
            feature === Features.Metadata;
    }
}
