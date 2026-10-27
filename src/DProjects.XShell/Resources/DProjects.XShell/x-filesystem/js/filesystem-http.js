import Filesystem, { Features, GetModes, SyncModes, pathName, validatePath } from "./filesystem.js";

// MIME types defined by DProjects.Fs.Http.FilesystemHttp
const MIME = Object.freeze({
    entry: "application/vnd.dprojects.fs.entry+json",
    entries: "application/vnd.dprojects.fs.entries+json",
    metadata: "application/vnd.dprojects.fs.metadata+json",
    directory: "application/vnd.dprojects.fs.entry.directory+json",
    copy: "application/vnd.dprojects.fs.copy+json",
    move: "application/vnd.dprojects.fs.move+json",
    sync: "application/vnd.dprojects.fs.sync+json",
    append: "application/vnd.dprojects.fs.append+json",
    supports: "application/vnd.dprojects.fs.supports+json"
});

const PATH_PREFIX_HEADER = "X-DPROJECTS-FS-PATH-PREFIX";
const IF_ENTRY_TYPE_HEADER = "X-DPROJECTS-IF-ENTRY-TYPE";

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

// class
export default class FilesystemHttp extends Filesystem {
    // static factory
    static create(url) {
        return new FilesystemHttp(url);
    }
    // constructor
    constructor(baseUrl, { isReadonly = false } = {}) {
        if (typeof baseUrl !== "string" && !(baseUrl instanceof URL)) {
            throw new TypeError("baseUrl must be a URL or string");
        }
        const url = new URL(baseUrl, globalThis.location?.href);

        if (!["http:", "https:"].includes(url.protocol)) {
            throw new TypeError("The HTTP filesystem requires an HTTP or HTTPS URL");
        }

        if (url.username || url.password || url.search || url.hash) {
            throw new TypeError("The filesystem base URL must not contain credentials, query or fragment");
        }

        url.pathname = url.pathname.replace(/\/+$/, "") || "/";
        super({ url: url.href, isReadonly });
        this._baseUrl = url;
        this._basePath = decodeURIComponent(url.pathname);
    }
    // methods LEVEL 0
    async getEntry(path, { signal } = {}) {
        const response = await this._request("GET", path, { accept: MIME.entry, signal });

        if (response.status === 404) return null;

        this._assertOk(response, "get entry");

        return this._readEntry(response);
    }

    async *getEntries(path, { mode = GetModes.All, pattern = null, signal } = {}) {
        if (!Object.values(GetModes).includes(mode)) {
            throw new RangeError(`Unsupported entries mode: ${mode}`);
        }

        const query = { mode };
        if (pattern !== null) query.pattern = pattern;

        const response = await this._request("GET", path, { accept: MIME.entries, query, signal });

        this._assertOk(response, "get entries");

        const prefix = this._entryPathPrefix(response);

        if (!response.body) throw new Error("Filesystem entries response has no body");

        // The middleware returns newline-delimited JSON.
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";

        try {
            for (;;) {
                checkAbort(signal);

                const { value, done } = await reader.read();

                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                let end;

                while ((end = buffer.indexOf("\n")) !== -1) {
                    const line = buffer.slice(0, end).trim();

                    buffer = buffer.slice(end + 1);

                    if (line) yield this._parseEntry(JSON.parse(line), prefix);
                }
            }

            buffer += decoder.decode();

            if (buffer.trim()) yield this._parseEntry(JSON.parse(buffer), prefix);
        } finally {
            try {
                await reader.cancel();
            } catch {
                // Already closed or aborted
            }

            reader.releaseLock();
        }
    }

    async exists(path, { signal } = {}) {
        const response = await this._request("HEAD", path, { signal });

        if (response.status === 404) return false;

        if (response.status === 200 || response.status === 204) {
            return true;
        }

        this._assertOk(response, "check existence");

        return true;
    }

    async loadReadStream(path, { offset = 0, length = -1, signal } = {}) {
        validatePath(path);
        checkAbort(signal);

        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < -1) {
            throw new RangeError("Invalid read range");
        }

        if (length === 0) {
            return new Blob([]).stream();
        }

        const headers = {};

        const ranged = offset !== 0 || length !== -1;

        if (ranged) {
            const end = length === -1 ? "" : offset + length - 1;

            headers.Range = `bytes=${offset}-${end}`;
        }

        const response = await this._request("GET", path, { accept: "*/*", headers, signal });

        if (response.status !== 200 && response.status !== 206) {
            this._assertOk(response, "read file");
        }

        if (ranged && response.status !== 206) {
            await response.body?.cancel();

            throw new Error("Filesystem server ignored the requested byte range");
        }

        if (!response.body) throw new Error("Filesystem file response has no body");

        if (length === -1) {
            return response.body;
        }

        // Limit the returned stream to the requested length.
        // The legacy middleware treats bytes=0-0 as open-ended.
        let remaining = length;

        return response.body.pipeThrough(new TransformStream({
            transform(chunk, controller) {
                if (remaining <= 0) return;

                const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
                const count = Math.min(remaining, bytes.byteLength);
                if (count) controller.enqueue(bytes.subarray(0, count));

                remaining -= count;

                if (remaining === 0) controller.terminate();
            }
        }));
    }
    async getReadUrl(path, { signal } = {}) {
        validatePath(path);
        checkAbort(signal);
        return {
            url: this._requestUrl(path).href,
            expiresAt: null,
            dispose: null
        };
    }

    // loadWriteStream is inherited from Filesystem.

    // methods LEVEL 2

    async saveFile(path, data, { append = false, signal } = {}) {
        this._ensureWritable();

        const body = this._uploadBody(data);

        const response = await this._request("PUT", path, {
            accept: MIME.entry,
            contentType: append ? MIME.append : "application/octet-stream",
            body,
            signal
        });

        this._assertOk(response, "save file");

        return this._readEntry(response);
    }

    async createDirectory(path, { signal } = {}) {
        this._ensureWritable();

        const response = await this._request("PUT", path, {
            accept: MIME.entry,
            contentType: MIME.directory,
            body: "",
            signal
        });

        this._assertOk(response, "create directory");

        return this._readEntry(response);
    }

    async delete(path, { signal } = {}) {
        this._ensureWritable();

        const response = await this._request("DELETE", path, { signal });

        if (response.status === 404) return;

        this._assertOk(response, "delete entry");
    }

    async touch(path, modified = new Date(), { signal } = {}) {
        this._ensureWritable();

        const date = modified instanceof Date ? modified : new Date(modified);

        if (Number.isNaN(date.getTime())) {
            throw new TypeError("Invalid modified date");
        }

        const response = await this._request("PATCH", path, {
            accept: MIME.entry,
            contentType: MIME.entry,
            body: JSON.stringify({ modified: date.toISOString() }),
            signal
        });

        this._assertOk(response, "touch entry");
    }

    // methods LEVEL 3

    async deleteFile(path, { signal } = {}) {
        this._ensureWritable();

        const response = await this._request("DELETE", path, {
            headers: { [IF_ENTRY_TYPE_HEADER]: "file" },
            signal
        });

        if (response.status !== 404) this._assertOk(response, "delete file");
    }

    async deleteDirectory(path, { signal } = {}) {
        this._ensureWritable();

        const response = await this._request("DELETE", path, {
            headers: { [IF_ENTRY_TYPE_HEADER]: "dir" },
            signal
        });

        if (response.status !== 404) this._assertOk(response, "delete directory");
    }

    async copy(source, destination, { overwrite = true, recursive = true, ignoreErrors = false, tries = 1, signal } = {}) {
        this._ensureWritable();
        validatePath(source);

        const response = await this._request("PUT", destination, {
            contentType: MIME.copy,
            body: JSON.stringify({
                Source: this._httpPath(source),
                Overwrite: overwrite,
                Recursive: recursive,
                IgnoreErrors: ignoreErrors,
                Tries: tries
            }),
            signal
        });

        this._assertOk(response, "copy entry");
    }

    async move(source, destination, { ignoreErrors = false, signal } = {}) {
        this._ensureWritable();
        validatePath(source);

        const response = await this._request("PUT", destination, {
            contentType: MIME.move,
            body: JSON.stringify({
                Source: this._httpPath(source),
                IgnoreErrors: ignoreErrors
            }),
            signal
        });

        this._assertOk(response, "move entry");
    }

    async sync(source, destination, { mode = SyncModes.LeftToRight, sourceExcludes = [], destinationExcludes = [], ignoreErrors = false, tries = 1, signal } = {}) {
        this._ensureWritable();
        validatePath(source);

        if (!Object.values(SyncModes).includes(mode)) {
            throw new RangeError(`Unsupported sync mode: ${mode}`);
        }

        const response = await this._request("PUT", destination, {
            contentType: MIME.sync,
            body: JSON.stringify({
                Source: this._httpPath(source),
                Mode: mode,
                SourceExcludes: sourceExcludes,
                DestinationExcludes: destinationExcludes,
                IgnoreErrors: ignoreErrors,
                Tries: tries
            }),
            signal
        });

        this._assertOk(response, "sync entries");
    }

    // methods LEVEL 4

    async createWatcher() {
        throw new Error("Watchers cannot be transported by the HTTP filesystem");
    }

    async getMetadata(path, { signal } = {}) {
        const response = await this._request("GET", path, { accept: MIME.metadata, signal });

        this._assertOk(response, "get metadata");

        return response.json();
    }

    async setMetadata(path, metadata, { signal } = {}) {
        this._ensureWritable();

        const properties = metadata instanceof Map ? Object.fromEntries(metadata) : metadata;

        if (properties === null || typeof properties !== "object" || Array.isArray(properties)) {
            throw new TypeError("metadata must be an object or Map");
        }

        const response = await this._request("PATCH", path, {
            accept: MIME.entry,
            contentType: MIME.entry,
            body: JSON.stringify({ metadata: properties }),
            signal
        });

        this._assertOk(response, "set metadata");
    }

    async supports(path, feature, { signal } = {}) {
        if (feature === Features.CreateWatcher) return false;

        const response = await this._request("GET", path, { accept: MIME.supports, query: { feature }, signal });

        this._assertOk(response, "check feature support");

        return response.json();
    }

    // HTTP helpers

    _requestUrl(path, query = null) {
        validatePath(path);

        const url = new URL(this._baseUrl);

        const suffix = path === "/" ? "" : "/" + path.slice(1).split("/").map(encodeURIComponent).join("/");
        url.pathname = (this._baseUrl.pathname === "/" ? "" : this._baseUrl.pathname) + suffix || "/";

        if (query) {
            for (const [key, value] of Object.entries(query)) {
                if (value != null) url.searchParams.set(key, String(value));
            }
        }

        return url;
    }

    // The middleware expects an absolute HTTP path
    // in the Source property of copy/move/sync requests.
    _httpPath(path) {
        validatePath(path);

        return (this._basePath === "/" ? "" : this._basePath) + (path === "/" ? "" : path) || "/";
    }

    async _request(method, path, { accept, contentType, headers, body, query, signal } = {}) {
        checkAbort(signal);

        const requestHeaders = new Headers(headers);

        if (accept) requestHeaders.set("Accept", accept);
        if (contentType) requestHeaders.set("Content-Type", contentType);

        const init = {
            method,
            headers: requestHeaders,
            signal,
            cache: "no-store"
        };

        if (body !== undefined) {
            init.body = body;

            // Streaming uploads require duplex in Fetch implementations
            // that support ReadableStream request bodies.
            if (body instanceof ReadableStream) init.duplex = "half";
        }

        return fetch(this._requestUrl(path, query), init);
    }

    _uploadBody(data) {
        if (typeof data === "string" || data instanceof Blob || data instanceof ArrayBuffer ||
            ArrayBuffer.isView(data) || data instanceof ReadableStream) {
            return data;
        }

        throw new TypeError("File data must be a string, Blob, ArrayBuffer, typed array, or ReadableStream");
    }

    _assertOk(response, operation) {
        if (response.ok) return;

        if (response.status === 405) {
            throw new Error("Unable to modify filesystem: filesystem is readonly or method is not allowed");
        }

        throw new Error(`Unable to ${operation}: HTTP ${response.status} ${response.statusText}`);
    }

    _entryPathPrefix(response) {
        const prefix = response.headers.get(PATH_PREFIX_HEADER) || "";

        if (prefix && prefix !== "/" && this._basePath !== prefix && !this._basePath.startsWith(prefix + "/")) {
            throw new Error("Filesystem path prefix does not match the base URL");
        }

        return prefix === "/" ? "" : prefix;
    }

    _parseEntry(dto, prefix) {
        if (!dto || typeof dto.path !== "string") throw new Error("Invalid filesystem entry response");

        // Translate paths relative to the HTTP endpoint.
        const subpath = this._basePath.slice(prefix.length) || "/";

        let path = dto.path;

        if (subpath !== "/") {
            if (path === subpath) {
                path = "/";
            } else if (path.startsWith(subpath + "/")) {
                path = path.slice(subpath.length);
            } else {
                throw new Error("Filesystem returned an entry outside the configured base URL");
            }
        }

        validatePath(path);

        const type = String(dto.type ?? "").toLowerCase();

        if (type !== "file" && type !== "directory") throw new Error(`Invalid filesystem entry type: ${dto.type}`);

        return {
            path,
            name: pathName(path),
            type,
            created: dto.created ? new Date(dto.created) : null,
            modified: dto.modified ? new Date(dto.modified) : null,
            length: dto.length ?? 0,
            etag: dto.etag ?? "",
            flags: dto.flags ?? 0
        };
    }

    async _readEntry(response) {
        const prefix = this._entryPathPrefix(response);

        return this._parseEntry(await response.json(), prefix);
    }
}
