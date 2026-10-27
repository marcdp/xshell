
import Filesystem, {
    EntryType,
    GetModes,
    joinPath,
    pathName,
    validatePath
} from "./filesystem.js";

const READONLY_FLAG = 1;

function checkAbort(signal) {
    if (!signal?.aborted) return;
    if (typeof signal.throwIfAborted === "function") signal.throwIfAborted();
    const error = new Error("Filesystem operation aborted");
    error.name = "AbortError";
    throw error;
}

function parentPath(path) {
    const index = path.lastIndexOf("/");
    return index === 0 ? "/" : path.slice(0, index);
}

function isNotFound(error) {
    return error?.name === "NotFoundError" || error?.name === "TypeMismatchError";
}

function matchesPattern(name, pattern) {
    if (pattern == null) return true;
    if (typeof pattern !== "string") {
        throw new TypeError("pattern must be a string or null");
    }
    let expression = "^";
    for (const char of pattern) {
        if (char === "*") expression += ".*";
        else if (char === "?") expression += ".";
        else if (char === "#") expression += "[0-9]";
        else expression += char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    }
    return new RegExp(expression + "$").test(name);
}

const MIME_TYPES = Object.freeze({
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    txt: "text/plain",
    json: "application/json",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav"
});

/**
 * Persistent, origin-scoped browser filesystem using the Origin Private File System.
 * Requires a secure context and navigator.storage.getDirectory().
 * Filesystem paths refer to the OPFS root, not to operating-system paths.
 * Created timestamps, custom metadata and arbitrary touch times are unsupported.
 */
export default class FilesystemOpfs extends Filesystem {

    static create(url) {
        if (url && url !== "opfs" && url !== "opfs:") {
            throw new TypeError(`Unsupported OPFS filesystem URL: ${url}`);
        }
        return new FilesystemOpfs();
    }

    constructor({ isReadonly = false } = {}) {
        super({ url: "opfs:", isReadonly });
        this._rootPromise = null;
    }

    async _root(signal) {
        checkAbort(signal);
        if (!globalThis.navigator?.storage?.getDirectory) {
            throw new Error("Origin Private File System is unavailable (requires browser support and a secure context)");
        }
        if (!this._rootPromise) {
            this._rootPromise = globalThis.navigator.storage.getDirectory();
        }
        try {
            const root = await this._rootPromise;
            checkAbort(signal);
            return root;
        } catch (error) {
            this._rootPromise = null;
            throw error;
        }
    }

    async _directory(path, { create = false, signal } = {}) {
        validatePath(path);
        let directory = await this._root(signal);
        if (path === "/") return directory;
        for (const name of path.slice(1).split("/")) {
            checkAbort(signal);
            directory = await directory.getDirectoryHandle(name, { create });
        }
        checkAbort(signal);
        return directory;
    }

    async _file(path, { create = false, signal } = {}) {
        validatePath(path);
        if (path === "/") throw new Error("Cannot access the filesystem root as a file");
        const parent = await this._directory(parentPath(path), { signal });
        checkAbort(signal);
        return parent.getFileHandle(pathName(path), { create });
    }

    async _snapshot(path, handle, signal) {
        checkAbort(signal);
        const file = handle.kind === "file" ? await handle.getFile() : null;
        checkAbort(signal);
        return {
            path,
            name: pathName(path),
            type: file ? EntryType.File : EntryType.Directory,
            created: null,
            modified: file ? new Date(file.lastModified) : null,
            length: file ? file.size : 0,
            etag: "",
            flags: this.isReadonly ? READONLY_FLAG : 0
        };
    }

    // LEVEL 0: provider primitives
    async getEntry(path, { signal } = {}) {
        validatePath(path);
        checkAbort(signal);
        if (path === "/") {
            return this._snapshot(path, await this._root(signal), signal);
        }
        try {
            const parent = await this._directory(parentPath(path), { signal });
            const name = pathName(path);
            let handle;
            try {
                handle = await parent.getFileHandle(name);
            } catch (error) {
                if (!isNotFound(error)) throw error;
                handle = await parent.getDirectoryHandle(name);
            }
            return this._snapshot(path, handle, signal);
        } catch (error) {
            if (isNotFound(error)) return null;
            throw error;
        }
    }

    async *getEntries(path, { mode = GetModes.All, pattern = null, signal } = {}) {
        validatePath(path);
        checkAbort(signal);
        if (!Object.values(GetModes).includes(mode)) {
            throw new RangeError(`Invalid entries mode: ${mode}`);
        }
        if (pattern !== null && typeof pattern !== "string") {
            throw new TypeError("pattern must be a string or null");
        }

        let directory;
        try {
            directory = await this._directory(path, { signal });
        } catch (error) {
            if (!isNotFound(error)) throw error;
            const entry = await this.getEntry(path, { signal });
            throw new Error(entry ? `Not a directory: ${path}` : `Path not found: ${path}`);
        }

        const walk = async function* (owner, currentDirectory, currentPath) {
            checkAbort(signal);
            const children = [];
            for await (const [name, handle] of currentDirectory.entries()) {
                checkAbort(signal);
                children.push([name, handle]);
            }
            children.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
            for (const [name, handle] of children) {
                checkAbort(signal);
                const childPath = joinPath(currentPath, name);
                const isFile = handle.kind === "file";
                if ((mode !== GetModes.Files || isFile) &&
                    (mode !== GetModes.Directories || !isFile) &&
                    matchesPattern(name, pattern)) {
                    yield await owner._snapshot(childPath, handle, signal);
                }
                if (mode === GetModes.Descendants && !isFile) {
                    yield* walk(owner, handle, childPath);
                }
            }
        };
        yield* walk(this, directory, path);
    }

    async loadReadStream(path, { offset = 0, length = -1, signal } = {}) {
        validatePath(path);
        checkAbort(signal);
        if (!Number.isSafeInteger(offset) || offset < 0 ||
            !Number.isSafeInteger(length) || length < -1) {
            throw new RangeError("Invalid read range");
        }
        const handle = await this._file(path, { signal });
        const file = await handle.getFile();
        checkAbort(signal);
        const start = Math.min(offset, file.size);
        const end = length === -1 ? file.size : Math.min(file.size, start + length);
        return file.slice(start, end).stream();
    }

    async getReadUrl(path, { contentType = null, signal } = {}) {
        validatePath(path);
        checkAbort(signal);
        const handle = await this._file(path, { signal });
        const file = await handle.getFile();
        checkAbort(signal);
        const extension = pathName(path).split(".").pop().toLowerCase();
        const mimeType = contentType || MIME_TYPES[extension] || "application/octet-stream";
        // File.slice creates a Blob view with the required MIME type.
        const blob = file.slice(0, file.size, mimeType);
        const url = URL.createObjectURL(blob);
        let disposed = false;
        return {
            url,
            expiresAt: null,
            dispose() {
                if (disposed) return;
                disposed = true;
                URL.revokeObjectURL(url);
            }
        };
    }

    // LEVEL 2: provider mutation primitives
    async saveFile(path, data, { append = false, signal } = {}) {
        validatePath(path);
        this._ensureWritable();
        checkAbort(signal);
        if (path === "/") throw new Error("Cannot write to the filesystem root");

        const isStream = data && typeof data.getReader === "function";
        const isValid = typeof data === "string" ||
            (typeof Blob !== "undefined" && data instanceof Blob) ||
            data instanceof ArrayBuffer || ArrayBuffer.isView(data) || isStream;
        if (!isValid) {
            throw new TypeError("File data must be a string, Blob, ArrayBuffer, typed array, or ReadableStream");
        }

        const handle = await this._file(path, { create: true, signal });
        checkAbort(signal);
        const writable = await handle.createWritable({ keepExistingData: append });
        let reader = null;
        let abortReader = null;
        try {
            if (append) {
                const file = await handle.getFile();
                await writable.seek(file.size);
            }
            if (isStream) {
                reader = data.getReader();
                abortReader = () => { void reader.cancel(signal?.reason).catch(() => {}); };
                signal?.addEventListener("abort", abortReader, { once: true });
                while (true) {
                    checkAbort(signal);
                    const { done, value } = await reader.read();
                    checkAbort(signal);
                    if (done) break;
                    if (!(typeof value === "string" ||
                          (typeof Blob !== "undefined" && value instanceof Blob) ||
                          value instanceof ArrayBuffer || ArrayBuffer.isView(value))) {
                        throw new TypeError("ReadableStream must yield binary data, Blob, or strings");
                    }
                    await writable.write(value);
                }
            } else {
                await writable.write(data);
            }
            checkAbort(signal);
            await writable.close();
        } catch (error) {
            try { await writable.abort(); } catch { /* best effort */ }
            throw error;
        } finally {
            if (abortReader) signal?.removeEventListener("abort", abortReader);
            if (reader) reader.releaseLock();
        }
        return this._snapshot(path, handle, signal);
    }

    async createDirectory(path, { signal } = {}) {
        validatePath(path);
        this._ensureWritable();
        checkAbort(signal);
        const directory = await this._directory(path, { create: true, signal });
        return this._snapshot(path, directory, signal);
    }

    async delete(path, { signal } = {}) {
        validatePath(path);
        this._ensureWritable();
        checkAbort(signal);
        if (path === "/") return; // never delete the origin's storage root
        try {
            const parent = await this._directory(parentPath(path), { signal });
            checkAbort(signal);
            await parent.removeEntry(pathName(path), { recursive: true });
        } catch (error) {
            if (!isNotFound(error)) throw error;
        }
    }

    // Unsupported: touch(), metadata, watchers, synchronization.
    // The base class provides copy/move through the stream API.
}
