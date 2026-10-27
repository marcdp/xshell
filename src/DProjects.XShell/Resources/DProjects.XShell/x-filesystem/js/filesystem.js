
/**
 * Browser-native, provider-independent filesystem base class.
 *
 * Based on DProjects.Fs.IFilesystemAsync and DProjects.Fs.FilesystemAsync.
 * No XShell runtime dependency and no transport/authentication assumptions.
 *
 * Filesystem paths are absolute, virtual, slash-separated paths, e.g. "/docs/a.txt".
 * Paths are NOT URLs. Encode each segment only when a concrete HTTP provider
 * translates a virtual path into a request URL.
 *
 * Public async APIs take an optional final options object with AbortSignal:
 *   await fs.getEntry("/docs/a.txt", { signal });
 *   for await (const entry of fs.getEntries("/docs", { mode: "all", signal })) { ... }
 *   const stream = await fs.loadReadStream("/docs/a.txt", { offset: 0, length: -1, signal });
 *   await fs.saveFile("/docs/a.txt", stream, { append: false, signal });
 *
 * Entry shape (adapted from C# EntryDTO):
 * { path, type: "file" | "directory", created, modified, length, etag, flags }
 * Optional 'name' is a derived convenience. Dates may be Date or ISO strings.
 * Binary input for saveFile is provider-defined, but should support ReadableStream
 * and Blob at minimum. loadReadStream returns a WHATWG ReadableStream.
 */

export const GetModes = Object.freeze({
    All: "all",
    Files: "files",
    Directories: "directories",
    Descendants: "descendants"
});

export const EntryType = Object.freeze({
    File: "file",
    Directory: "directory"
});

export const Features = Object.freeze({
    Touch: "Touch",
    CreateWatcher: "CreateWatcher",
    Metadata: "Metadata",
    Select: "Select"
});

export const SyncModes = Object.freeze({
    LeftToRight: "LeftToRight",
    Bidirectional: "Bidirectional"
});

function aborted(signal) {
    if (!signal?.aborted) return;
    if (typeof signal.throwIfAborted === "function") signal.throwIfAborted();
    const error = new Error("Filesystem operation aborted");
    error.name = "AbortError";
    throw error;
}

function isAborted(error, signal) {
    return signal?.aborted || error?.name === "AbortError";
}

/** Strict virtual-path validation, deliberately NOT URL decoding. */
export function validatePath(path) {
    if (typeof path !== "string" || !path.startsWith("/") || path.includes("\\") || path.includes("//") || /[\x00-\x1f:*?<>|\"]/.test(path)) {
        throw new TypeError(`Invalid filesystem path: ${String(path)}`);
    }
    const segments = path.split("/").slice(1);
    if (segments.some(segment => segment === "." || segment === ".." || !segment)) {
        // A trailing slash is accepted by NormalizeStrict in C#, but use one
        // canonical representation inside browser filesystem implementations.
        if (path.endsWith("/") && path !== "/") {
            throw new TypeError(`Filesystem paths must not have a trailing slash: ${path}`);
        }
        if (path !== "/") throw new TypeError(`Invalid filesystem path: ${path}`);
    }
    return path;
}

/** Combine a validated filesystem directory and a single safe entry name. */
export function joinPath(directory, name) {
    validatePath(directory);
    if (typeof name !== "string" || !name || name === "." || name === ".." || name.includes("/") || name.includes("\\") || /[\x00-\x1f:*?<>|\"]/.test(name)) {
        throw new TypeError(`Invalid filesystem entry name: ${String(name)}`);
    }
    return directory === "/" ? `/${name}` : `${directory}/${name}`;
}

export function pathName(path) {
    validatePath(path);
    return path === "/" ? "" : path.slice(path.lastIndexOf("/") + 1);
}

function isDirectory(entry) {
    return entry?.type?.toLowerCase?.() === EntryType.Directory || entry?.entryType?.toLowerCase?.() === EntryType.Directory || entry?.isDirectory?.() === true;
}

function isFile(entry) {
    return entry?.type?.toLowerCase?.() === EntryType.File || entry?.entryType?.toLowerCase?.() === EntryType.File || entry?.isFile?.() === true;
}

function assertTries(tries) {
    if (!Number.isSafeInteger(tries) || tries < 1) {
        throw new RangeError("tries must be a positive integer");
    }
}

function log(logger, level, message, error) {
    logger?.[level]?.(message, ...(error ? [error] : []));
}

async function delay(ms, signal) {
    aborted(signal);
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
        function onAbort() { 
            clearTimeout(timer); 
            cleanup();
            const e = new Error("Filesystem operation aborted"); e.name = "AbortError"; reject(e); 
        }
        function cleanup() { 
            signal?.removeEventListener("abort", onAbort); 
        }
        signal?.addEventListener("abort", onAbort, { once: true });
        if (signal?.aborted) onAbort();
    });
}

/**
 * Subclasses MUST implement:
 *   getEntry, getEntries, loadReadStream, saveFile, createDirectory, delete.
 * Subclasses MAY override every other method (e.g. native S3 copy, HTTP sync).
 *
 * No filesystem instances are XShell Services: the separate factory Service
 * constructs as many filesystem instances as needed.
 */
export default class Filesystem {

    // static
    static GetModes = GetModes;
    
    // ctor
    constructor({ url = "", isReadonly = false } = {}) {
        // 'url' is a SAFE diagnostic identity, never an authenticated URL.
        this._url = url;
        this.isReadonly = Boolean(isReadonly);
        this.isStarted = false;
    }
    dispose() { 
        this.stop(); 
    }

    // props
    get url() { return this._url; }

    // LEVEL 0: provider primitives
    async getEntry(path, { signal } = {}) {
        validatePath(path); aborted(signal);
        throw new Error("getEntry() must be implemented by a filesystem provider");
    }

    async *getEntries(path, { mode = GetModes.All, pattern = null, signal } = {}) {
        validatePath(path); aborted(signal);
        void mode; void pattern;
        throw new Error("getEntries() must be implemented by a filesystem provider");
    }

    async exists(path, { signal } = {}) {
        validatePath(path); aborted(signal);
        return (await this.getEntry(path, { signal })) != null;
    }

    async loadReadStream(path, { offset = 0, length = -1, signal } = {}) {
        validatePath(path); aborted(signal);
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < -1) {
            throw new RangeError("Invalid read range");
        }
        throw new Error("loadReadStream() must be implemented by a filesystem provider");
    }
    async getReadUrl(path, { expiresIn = 300, disposition = "inline", signal } = {}) {
        validatePath(path); aborted(signal);
        throw new Error("getReadUrl() must be implemented by a filesystem provider");
    }

    /**
     * Buffered default matching the intent of C#'s SpongeOutputStream.
     * Providers should override when large/streaming uploads are required.
     * The stream writes on close; abort drops buffered data.
     */
    async loadWriteStream(path, { append = false, truncate = false, signal } = {}) {
        validatePath(path); this._ensureWritable(); aborted(signal);
        if (truncate) {
            await this.saveFile(path, new Blob([]), { signal });
        } else if (append && !await this.exists(path, { signal })) {
            await this.saveFile(path, new Blob([]), { signal });
        }
        const parts = [];
        return new WritableStream({
            write(chunk) {
                aborted(signal);
                if (!(chunk instanceof Uint8Array) && !(chunk instanceof ArrayBuffer) && !(typeof Blob !== "undefined" && chunk instanceof Blob)) {
                    throw new TypeError("WritableStream chunks must be binary data");
                }
                // Snapshot mutable buffers; do not retain a caller-owned view.
                parts.push(chunk instanceof Uint8Array ? chunk.slice() : chunk instanceof ArrayBuffer ? chunk.slice(0) : chunk);
            },
            close: async () => {
                aborted(signal);
                if (parts.length) {
                    await this.saveFile(path, new Blob(parts), { append, signal });
                }
            },
            abort() { parts.length = 0; }
        });
    }

    // LEVEL 1: derived checks
    async existsFile(path, { signal } = {}) {
        validatePath(path); aborted(signal);
        return isFile(await this.getEntry(path, { signal }));
    }

    async existsDirectory(path, { signal } = {}) {
        validatePath(path); aborted(signal);
        return isDirectory(await this.getEntry(path, { signal }));
    }

    // LEVEL 2: provider mutation primitives
    async saveFile(path, data, { append = false, signal } = {}) {
        validatePath(path); this._ensureWritable(); aborted(signal);
        void data; void append;
        throw new Error("saveFile() must be implemented by a filesystem provider");
    }

    async createDirectory(path, { signal } = {}) {
        validatePath(path); this._ensureWritable(); aborted(signal);
        throw new Error("createDirectory() must be implemented by a filesystem provider");
    }

    async delete(path, { signal } = {}) {
        validatePath(path); this._ensureWritable(); aborted(signal);
        throw new Error("delete() must be implemented by a filesystem provider");
    }

    async touch(path, modified = new Date(), { signal } = {}) {
        validatePath(path); this._ensureWritable(); aborted(signal);
        void modified;
        throw new Error("Touch is not supported by this filesystem");
    }

    // LEVEL 3: derived operations
    async deleteFile(path, { signal } = {}) {
        if (await this.existsFile(path, { signal })) await this.delete(path, { signal });
    }

    async deleteDirectory(path, { signal } = {}) {
        if (await this.existsDirectory(path, { signal })) await this.delete(path, { signal });
    }

    /** Copy within this filesystem. A provider may override for server-side copy. */
    async copy(source, destination, {
        overwrite = true, recursive = true, ignoreErrors = false,
        tries = 1, logger = null, signal
    } = {}) {
        validatePath(source); validatePath(destination);
        this._ensureWritable(); aborted(signal); assertTries(tries);
        if (source === destination) return;
        const sourceEntry = await this.getEntry(source, { signal });
        if (!sourceEntry) throw new Error(`Unable to copy: not found ${source}`);
        if (isDirectory(sourceEntry) && (source === "/" || destination.startsWith(source + "/"))) {
            throw new Error("Cannot copy a directory into its own descendant");
        }
        const options = { overwrite, recursive, ignoreErrors, tries, logger, signal };
        await this._copyEntry(source, destination, options);
    }

    async _copyEntry(source, destination, options) {
        const { recursive, overwrite, ignoreErrors, tries, logger, signal } = options;
        aborted(signal);
        const entry = await this.getEntry(source, { signal });
        if (!entry) throw new Error(`Unable to copy: not found ${source}`);
        const target = await this.getEntry(destination, { signal });
        if (isDirectory(entry)) {
            if (target && !isDirectory(target)) {
                throw new Error(`Unable to copy directory: destination is a file: ${destination}`);
            }
            if (!target) {
                log(logger, "info", `Create directory ${destination}`);
                await this.createDirectory(destination, { signal });
            }
            await this._copyMetadata(source, destination, signal);
            if (!recursive) return;
            for await (const child of this.getEntries(source, { mode: GetModes.All, signal })) {
                aborted(signal);
                // A provider returns immediate children for mode='all'.
                const childName = child.name ?? pathName(child.path);
                try {
                    await this._copyEntry(child.path, joinPath(destination, childName), options);
                } catch (error) {
                    if (isAborted(error, signal) || !ignoreErrors) throw error;
                    log(logger, "error", `Error copying ${child.path}: ${error.message}`, error);
                }
            }
            return;
        }
        const fileDestination = target && isDirectory(target)
            ? joinPath(destination, pathName(source))
            : destination;
        const fileTarget = await this.getEntry(fileDestination, { signal });
        if (fileTarget && isDirectory(fileTarget)) {
            throw new Error(`Unable to copy file: destination is a directory: ${fileDestination}`);
        }
        if (fileTarget && !overwrite) return;
        for (let attempt = 1; attempt <= tries; attempt++) {
            aborted(signal);
            let stream;
            try {
                log(logger, "info", `Copy ${source} to ${fileDestination}`);
                stream = await this.loadReadStream(source, { signal });
                await this.saveFile(fileDestination, stream, { signal });
                await this._copyMetadata(source, fileDestination, signal);
                return;
            } catch (error) {
                if (isAborted(error, signal)) throw error;
                log(logger, "error", `Copy failed (${attempt}/${tries}): ${source}`, error);
                if (attempt === tries) {
                    if (!ignoreErrors) throw error;
                    return;
                }
                await delay(250, signal);
            } finally {
                // A successful saveFile consumes the stream. If it failed, free
                // any still-readable stream; providers own resource release.
                try { if (stream && !stream.locked) await stream.cancel(); } catch { /* noop */ }
            }
        }
    }

    async _copyMetadata(source, destination, signal) {
        const readSupported = await this.supports(source, Features.Metadata, { signal });
        const writeSupported = await this.supports(destination, Features.Metadata, { signal });
        if (readSupported && writeSupported) {
            const metadata = await this.getMetadata(source, { signal });
            if (metadata && Object.keys(metadata).length) {
                await this.setMetadata(destination, metadata, { signal });
            }
        }
    }

    /** Move is copy-then-delete. Providers should override if atomic rename exists. */
    async move(source, destination, { logger = null, signal } = {}) {
        validatePath(source); validatePath(destination);
        this._ensureWritable(); aborted(signal);
        if (source === destination) return;
        // Never delete the source after a partially successful ignored copy.
        // This is intentionally safer than the C# default move fallback.
        await this.copy(source, destination, {
            overwrite: true, recursive: true, ignoreErrors: false, logger, signal
        });
        const sourceEntry = await this.getEntry(source, { signal });
        if (sourceEntry && isDirectory(sourceEntry)) await this.deleteDirectory(source, { signal });
        else if (sourceEntry) await this.deleteFile(source, { signal });
    }

    /**
     * Contract surface is retained. Full C# synchronization depends on
     * status-index persistence, timestamp/cache comparison, and conflict rules;
     * those algorithms must be ported and tested independently before use.
     */
    async sync(source, destination, { mode = SyncModes.LeftToRight, signal } = {}) {
        validatePath(source); validatePath(destination); this._ensureWritable(); aborted(signal);
        if (!Object.values(SyncModes).includes(mode)) throw new RangeError(`Unknown sync mode: ${mode}`);
        throw new Error("sync() is not implemented in the browser base; override in a provider or add a tested sync implementation");
    }

    // LEVEL 4: optional capabilities
    async createWatcher(path, { filter = "", excludes = [], recursive = false, signal } = {}) {
        validatePath(path); aborted(signal);
        void filter; void excludes; void recursive;
        throw new Error("Watchers are not supported by this filesystem");
    }

    async getMetadata(path, { signal } = {}) {
        validatePath(path); aborted(signal);
        throw new Error("Metadata is not supported by this filesystem");
    }

    async setMetadata(path, metadata, { signal } = {}) {
        validatePath(path); this._ensureWritable(); aborted(signal);
        void metadata;
        throw new Error("Metadata is not supported by this filesystem");
    }

    async supports(path, feature, { signal } = {}) {
        validatePath(path); aborted(signal);
        void feature;
        return false;
    }

    // lifecycle methods
    start() { 
        this.isStarted = true; 
    }
    stop() { 
        this.isStarted = false; 
    }


    // private methods
    _ensureWritable() {
        if (this.isReadonly) throw new Error("Unable to modify filesystem: filesystem is readonly");
    }
}
