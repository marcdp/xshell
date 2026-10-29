
import Filesystem, { EntryType, GetModes, joinPath, pathName, validatePath } from "./filesystem.js";

const READONLY_FLAG = 1;
const MIME_TYPES = {
    png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", gif:"image/gif",
    svg:"image/svg+xml", webp:"image/webp", pdf:"application/pdf",
    txt:"text/plain", json:"application/json", html:"text/html",
    mp4:"video/mp4", webm:"video/webm", mp3:"audio/mpeg", wav:"audio/wav"
};

function checkAbort(signal) {
    if (!signal?.aborted) return;
    signal.throwIfAborted?.();
    throw new DOMException("Filesystem operation aborted", "AbortError");
}

function isNotFound(error) { return error?.name === "NotFoundError" || error?.name === "TypeMismatchError"; }
function parentPath(path) { const i = path.lastIndexOf("/"); return i <= 0 ? "/" : path.slice(0, i); }

function matchesPattern(name, pattern) {
    if (pattern == null) return true;
    if (typeof pattern !== "string") throw new TypeError("pattern must be a string or null");
    let expression = "^";
    for (const char of pattern) {
        if (char === "*") expression += ".*";
        else if (char === "?") expression += ".";
        else if (char === "#") expression += "[0-9]";
        else expression += char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    }
    return new RegExp(expression + "$").test(name);
}

export default class FilesystemFile extends Filesystem {

    // create
    static create(url) {
        if (url && url !== "file" && url !== "file:") throw new TypeError(`Unsupported local filesystem URL: ${url}`);
        return new FilesystemFile();
    }

    // ctor
    constructor({ handle = null, isReadonly = false } = {}) {
        super({ url:"file:", isReadonly });
        this._rootHandle = handle;
    }

    // props
    get handle() { return this._rootHandle; }

    // Call from a user gesture. The picker itself requests directory access.
    async selectDirectory() {
        if (!globalThis.showDirectoryPicker) throw new Error("Local filesystem access is not supported by this browser");
        const handle = await showDirectoryPicker({ mode: this.isReadonly ? "read" : "readwrite" });
        this._rootHandle = handle;
        return handle;
    }

    // Attach a previously saved FileSystemDirectoryHandle.
    setDirectoryHandle(handle) {
        if (!handle || handle.kind !== "directory") throw new TypeError("Expected a FileSystemDirectoryHandle");
        this._rootHandle = handle;
    }

    async queryPermission() {
        if (!this._rootHandle) return "prompt";
        if (!this._rootHandle.queryPermission) return "prompt";
        return this._rootHandle.queryPermission({ mode: this.isReadonly ? "read" : "readwrite" });
    }

    // Call from a user gesture when permission must be renewed.
    async requestPermission() {
        if (!this._rootHandle) throw new Error("No local directory selected");
        const mode = this.isReadonly ? "read" : "readwrite";
        if (await this.queryPermission() === "granted") return "granted";
        if (!this._rootHandle.requestPermission) throw new Error("Permission requests are not supported by this browser");
        return this._rootHandle.requestPermission({ mode });
    }

    async getEntry(path, { signal } = {}) {
        validatePath(path);
        checkAbort(signal);
        try {
            const handle = path === "/" ? await this._root(signal) : await this._entry(path, signal);
            return this._snapshot(path, handle, signal);
        } catch (error) {
            if (isNotFound(error)) return null;
            throw error;
        }
    }

    async *getEntries(path, { mode = GetModes.All, pattern = null, signal } = {}) {
        validatePath(path);
        checkAbort(signal);
        if (!Object.values(GetModes).includes(mode)) throw new RangeError(`Invalid entries mode: ${mode}`);
        if (pattern !== null && typeof pattern !== "string") throw new TypeError("pattern must be a string or null");

        const directory = await this._directory(path, { signal });
        const walk = async function* (owner, dir, currentPath) {
            checkAbort(signal);
            const children = [];
            for await (const [name, handle] of dir.entries()) {
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
                if (mode === GetModes.Descendants && !isFile) yield* walk(owner, handle, childPath);
            }
        };
        yield* walk(this, directory, path);
    }

    async loadReadStream(path, { offset = 0, length = -1, signal } = {}) {
        validatePath(path);
        checkAbort(signal);
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < -1) {
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
        const mimeType = contentType || MIME_TYPES[extension] || file.type || "application/octet-stream";
        const url = URL.createObjectURL(file.slice(0, file.size, mimeType));
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

    async saveFile(path, data, { append = false, signal } = {}) {
        validatePath(path);
        this._ensureWritable();
        checkAbort(signal);
        if (path === "/") throw new Error("Cannot write to the filesystem root");

        if (data?.isFile && typeof data.file === "function") {
            data = await new Promise((resolve, reject) => data.file(resolve, reject));
        }
        checkAbort(signal);

        const isStream = data && typeof data.getReader === "function";
        const isValid = typeof data === "string" || data instanceof Blob ||
            data instanceof ArrayBuffer || ArrayBuffer.isView(data) || isStream;
        if (!isValid) throw new TypeError("Unsupported file content");

        const handle = await this._file(path, { create:true, signal });
        checkAbort(signal);
        const writable = await handle.createWritable({ keepExistingData:append });
        let reader = null;
        let onAbort = null;

        try {
            if (append) {
                const file = await handle.getFile();
                await writable.seek(file.size);
            }
            if (isStream) {
                reader = data.getReader();
                onAbort = () => { void reader.cancel(signal?.reason).catch(() => {}); };
                signal?.addEventListener("abort", onAbort, { once:true });
                while (true) {
                    checkAbort(signal);
                    const { done, value } = await reader.read();
                    checkAbort(signal);
                    if (done) break;
                    await writable.write(value);
                }
            } else {
                await writable.write(data);
            }
            checkAbort(signal);
            await writable.close();
        } catch (error) {
            try { await writable.abort(); } catch {}
            throw error;
        } finally {
            if (onAbort) signal?.removeEventListener("abort", onAbort);
            if (reader) reader.releaseLock();
        }

        return this._snapshot(path, handle, signal);
    }

    async createDirectory(path, { signal } = {}) {
        validatePath(path);
        this._ensureWritable();
        checkAbort(signal);
        const handle = await this._directory(path, { create:true, signal });
        return this._snapshot(path, handle, signal);
    }

    async delete(path, { signal } = {}) {
        validatePath(path);
        this._ensureWritable();
        checkAbort(signal);
        if (path === "/") return;
        try {
            const parent = await this._directory(parentPath(path), { signal });
            checkAbort(signal);
            await parent.removeEntry(pathName(path), { recursive:true });
        } catch (error) {
            if (!isNotFound(error)) throw error;
        }
    }

    // Private helpers
    async _root(signal) {
        checkAbort(signal);
        if (!this._rootHandle) throw new Error("No local directory selected");
        return this._rootHandle;
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
        if (path === "/") throw new Error("Cannot access root as a file");
        const parent = await this._directory(parentPath(path), { signal });
        checkAbort(signal);
        return parent.getFileHandle(pathName(path), { create });
    }

    async _entry(path, signal) {
        const parent = await this._directory(parentPath(path), { signal });
        checkAbort(signal);
        try {
            return await parent.getFileHandle(pathName(path));
        } catch (error) {
            if (!isNotFound(error)) throw error;
            return parent.getDirectoryHandle(pathName(path));
        }
    }

    async _snapshot(path, handle, signal) {
        checkAbort(signal);
        const file = handle.kind === "file" ? await handle.getFile() : null;
        checkAbort(signal);
        return {
            path,
            name:pathName(path),
            type:file ? EntryType.File : EntryType.Directory,
            created:null,
            modified:file ? new Date(file.lastModified) : null,
            length:file ? file.size : 0,
            etag:"",
            flags:this.isReadonly ? READONLY_FLAG : 0
        };
    }
}
