
// Dependency-free ZIP writer (STORE method, no compression).
// Requires the XShell filesystem API: getEntry, getEntries and loadReadStream.

const encoder = new TextEncoder();
const CRC_TABLE = new Uint32Array(256);

for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[i] = c >>> 0;
}

function checkAbort(signal) {
    if (!signal?.aborted) return;
    if (typeof signal.throwIfAborted === "function") signal.throwIfAborted();
    throw new DOMException("ZIP creation aborted", "AbortError");
}

function crc32(bytes, crc = 0xffffffff) {
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
    return crc >>> 0;
}

function dateTime(date) {
    const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const year = Math.max(1980, Math.min(2107, d.getFullYear()));
    const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | (Math.floor(d.getSeconds() / 2) & 31);
    const day = ((year - 1980) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return {time, day};
}

function header(length, writer) {
    const bytes = new Uint8Array(length);
    const view = new DataView(bytes.buffer);
    writer(view);
    return bytes;
}

function normalizePaths(paths) {
    if (!Array.isArray(paths)) throw new TypeError("paths must be an array");
    const unique = [...new Set(paths)];
    for (const path of unique) {
        if (typeof path !== "string" || !path.startsWith("/") || path === "/") {
            throw new TypeError("Each path must be an absolute filesystem path other than /");
        }
    }
    return unique.filter(path => !unique.some(parent => parent !== path && path.startsWith(parent.replace(/\/$/, "") + "/")));
}

/**
 * Create a ZIP archive of the selected XShell filesystem paths.
 * Uses ZIP STORE (no compression), with UTF-8 filenames and CRC-32.
 * Note: output is held in memory; ZIP64 and files >= 4 GiB are unsupported.
 */
export async function createZip(filesystem, paths, {signal} = {}) {
    if (!filesystem?.getEntry || !filesystem?.getEntries || !filesystem?.loadReadStream) {
        throw new TypeError("filesystem must implement getEntry, getEntries and loadReadStream");
    }

    const roots = normalizePaths(paths);
    const chunks = [];
    const central = [];
    const names = new Set();
    let offset = 0;
    let count = 0;
    const max32 = 0xffffffff;

    function addChunk(bytes) {
        chunks.push(bytes);
        offset += bytes.byteLength;
        if (offset > Number.MAX_SAFE_INTEGER) throw new RangeError("ZIP is too large");
    }

    async function add(path, name) {
        checkAbort(signal);
        const entry = await filesystem.getEntry(path, {signal});
        if (!entry) throw new Error(`Path not found: ${path}`);

        const directory = entry.type === "directory";
        const zipName = name + (directory ? "/" : "");

        if (names.has(zipName)) throw new Error(`Duplicate ZIP entry: ${zipName}`);
        names.add(zipName);

        if (++count > 65535) throw new RangeError("ZIP64 is required for more than 65535 entries");

        const filename = encoder.encode(zipName);
        if (filename.byteLength > 65535) throw new RangeError(`ZIP entry name is too long: ${zipName}`);

        const {time, day} = dateTime(entry.modified);
        const localOffset = offset;

        if (localOffset > max32) throw new RangeError("ZIP64 is required for archives over 4 GiB");

        // The data descriptor allows streaming without knowing the size or CRC upfront.
        const flags = 0x0808; // UTF-8 names + data descriptor.

        addChunk(header(30, v => {
            v.setUint32(0, 0x04034b50, true);
            v.setUint16(4, 20, true);
            v.setUint16(6, flags, true);
            v.setUint16(8, 0, true); // STORE
            v.setUint16(10, time, true);
            v.setUint16(12, day, true);
            v.setUint16(26, filename.length, true);
        }));

        addChunk(filename);

        let crc = 0xffffffff;
        let size = 0;

        if (!directory) {
            const stream = await filesystem.loadReadStream(path, {signal});
            const reader = stream.getReader();
            const onAbort = () => { void reader.cancel(signal?.reason).catch(() => {}); };

            signal?.addEventListener("abort", onAbort, {once:true});

            try {
                while (true) {
                    checkAbort(signal);
                    const {value, done} = await reader.read();
                    checkAbort(signal);

                    if (done) break;
                    if (!(value instanceof Uint8Array)) throw new TypeError("File stream must return Uint8Array chunks");

                    size += value.byteLength;
                    if (size > max32) throw new RangeError("ZIP64 is required for files over 4 GiB");

                    crc = crc32(value, crc);
                    addChunk(value.slice()); // Own each buffer; producers may reuse theirs.
                }
            } catch (error) {
                try { await reader.cancel(error); } catch { /* best effort */ }
                throw error;
            } finally {
                signal?.removeEventListener("abort", onAbort);
                reader.releaseLock();
            }
        }

        crc = (crc ^ 0xffffffff) >>> 0;

        addChunk(header(16, v => {
            v.setUint32(0, 0x08074b50, true);
            v.setUint32(4, crc, true);
            v.setUint32(8, size, true);
            v.setUint32(12, size, true);
        }));

        central.push({filename, flags, time, day, crc, size, localOffset, directory});

        if (directory) {
            for await (const child of filesystem.getEntries(path, {signal})) {
                checkAbort(signal);
                const childName = child.name ?? child.path.split("/").pop();
                await add(child.path, name + "/" + childName);
            }
        }
    }

    for (const path of roots) {
        checkAbort(signal);
        await add(path, path.split("/").filter(Boolean).pop());
    }

    checkAbort(signal);

    const centralOffset = offset;
    if (centralOffset > max32) throw new RangeError("ZIP64 is required for archives over 4 GiB");

    for (const entry of central) {
        addChunk(header(46, v => {
            v.setUint32(0, 0x02014b50, true);
            v.setUint16(4, 20, true);
            v.setUint16(6, 20, true);
            v.setUint16(8, entry.flags, true);
            v.setUint16(10, 0, true);
            v.setUint16(12, entry.time, true);
            v.setUint16(14, entry.day, true);
            v.setUint32(16, entry.crc, true);
            v.setUint32(20, entry.size, true);
            v.setUint32(24, entry.size, true);
            v.setUint16(28, entry.filename.length, true);
            v.setUint32(38, entry.directory ? 0x10 << 16 : 0, true);
            v.setUint32(42, entry.localOffset, true);
        }));

        addChunk(entry.filename);
    }

    const centralSize = offset - centralOffset;
    if (centralSize > max32) throw new RangeError("ZIP64 is required for archives over 4 GiB");

    addChunk(header(22, v => {
        v.setUint32(0, 0x06054b50, true);
        v.setUint16(8, count, true);
        v.setUint16(10, count, true);
        v.setUint32(12, centralSize, true);
        v.setUint32(16, centralOffset, true);
    }));

    checkAbort(signal);
    return new Blob(chunks, {type:"application/zip"});
}
