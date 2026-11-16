
// Browser-local, password-protected named secrets.
// Storage: IndexedDB. Cryptography: PBKDF2-SHA-256 + AES-256-GCM (Web Crypto).
// No passwords, derived keys, or plaintext secret values are persisted.

const DB_NAME = "xshell-secrets";
const DB_VERSION = 1;
const META_STORE = "metadata";
const SECRET_STORE = "secrets";
const VAULT_ID = "vault";
const KDF_ITERATIONS = 600_000;
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });
const CHECK_VALUE = "xshell-secrets:v1:initialized";

function checkPassword(options) {
    const password = options?.password;
    if (typeof password !== "string" || !password.length) {
        throw new TypeError("A non-empty master password is required.");
    }
    return password;
}

function checkId(id) {
    if (typeof id !== "string" || !id.trim()) {
        throw new TypeError("Secret id must be a non-empty string.");
    }
}

function request(db, name, mode, operation) {
    return new Promise((resolve, reject) => {
        let tx;
        try {
            tx = db.transaction(name, mode);
            let result;
            tx.oncomplete = () => resolve(result);
            tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));
            tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed."));
            const req = operation(tx.objectStore(name));
            req.onsuccess = () => { result = req.result; };
        } catch (error) {
            try { tx?.abort(); } catch { /* Transaction might already be inactive. */ }
            reject(error);
        }
    });
}

async function deriveKey(password, salt, iterations) {
    const bytes = ENCODER.encode(password);
    try {
        const material = await crypto.subtle.importKey("raw", bytes, "PBKDF2", false, ["deriveKey"]);
        return await crypto.subtle.deriveKey(
            { name: "PBKDF2", hash: "SHA-256", salt, iterations },
            material,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    } finally {
        bytes.fill(0);
    }
}

async function encrypt(key, bytes, purpose) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: ENCODER.encode(purpose), tagLength: 128 },
        key,
        bytes
    );
    return { iv, ciphertext };
}

async function decrypt(key, record, purpose) {
    return new Uint8Array(await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: record.iv, additionalData: ENCODER.encode(purpose), tagLength: 128 },
        key,
        record.ciphertext
    ));
}

export default class Secrets {
    #bus;
    #database;
    #ready;
    #status = "locked"; // Fail closed while asynchronous IndexedDB discovery runs.
    #metadata = null;
    #key = null;
    #epoch = 0;

    constructor({ bus } = {}) {
        this.#bus = bus;
        this.#ready = this.#open().then(async db => {
            this.#metadata = await request(db, META_STORE, "readonly", store => store.get(VAULT_ID)) || null;
            this.#setStatus(this.#metadata ? "locked" : "uninitialized");
        });
        // A Service constructor must remain synchronous; public async methods await #ready.
        // Consume the rejection here so it is not reported as an unhandled promise.
        void this.#ready.catch(() => {});
    }

    get status() { return this.#status; }

    async initialize(options) {
        const password = checkPassword(options);
        await this.#ready;
        if (this.#metadata) throw new Error("Secrets vault is already initialized.");
        const epoch = this.#epoch;
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await deriveKey(password, salt, KDF_ITERATIONS);
        const check = await encrypt(key, ENCODER.encode(CHECK_VALUE), "vault-check");
        const metadata = {
            id: VAULT_ID, version: 1,
            kdf: "PBKDF2-SHA-256", iterations: KDF_ITERATIONS, salt,
            ...check
        };
        // add(), not put(): an existing vault must never be overwritten, even
        // when multiple tabs attempt initialization concurrently.
        await request(this.#database, META_STORE, "readwrite", store => store.add(metadata));
        this.#metadata = metadata;
        if (epoch !== this.#epoch) {
            this.#setStatus("locked");
            throw new Error("Vault was locked during initialization; unlock it again.");
        }
        this.#key = key;
        this.#setStatus("unlocked");
    }

    async unlock(options) {
        const password = checkPassword(options);
        await this.#ready;
        const epoch = this.#epoch;
        const metadata = await request(this.#database, META_STORE, "readonly", store => store.get(VAULT_ID));
        if (!metadata) {
            this.#setStatus("uninitialized");
            throw new Error("Secrets vault is not initialized.");
        }
        if (metadata.version !== 1 || metadata.kdf !== "PBKDF2-SHA-256" ||
            !Number.isSafeInteger(metadata.iterations) || metadata.iterations < 1 ||
            !(metadata.salt instanceof Uint8Array) || metadata.salt.length !== 16 ||
            !(metadata.iv instanceof Uint8Array) || metadata.iv.length !== 12 ||
            !(metadata.ciphertext instanceof ArrayBuffer)) {
            throw new Error("Unsupported or damaged Secrets vault metadata.");
        }
        const key = await deriveKey(password, metadata.salt, metadata.iterations);
        let plaintext;
        try {
            plaintext = await decrypt(key, metadata, "vault-check");
            if (DECODER.decode(plaintext) !== CHECK_VALUE) throw new Error("Invalid vault verifier.");
        } catch {
            throw new Error("Invalid master password or damaged Secrets vault.");
        } finally {
            plaintext?.fill(0);
        }
        if (epoch !== this.#epoch) throw new Error("Vault was locked during unlocking.");
        this.#metadata = metadata;
        this.#key = key;
        this.#setStatus("unlocked");
    }

    lock() {
        this.#epoch++;
        this.#key = null;
        if (this.#status === "unlocked") this.#setStatus("locked");
    }

    async list() {
        const { epoch } = await this.#session();
        const ids = await request(this.#database, SECRET_STORE, "readonly", store => store.getAllKeys());
        this.#assertEpoch(epoch);
        return ids.sort().map(id => ({ id }));
    }

    async get(id) {
        checkId(id);
        const { key, epoch } = await this.#session();
        const record = await request(this.#database, SECRET_STORE, "readonly", store => store.get(id));
        this.#assertEpoch(epoch);
        if (!record) return undefined;
        let plaintext;
        try {
            plaintext = await decrypt(key, record, `secret:${id}`);
            this.#assertEpoch(epoch);
            return JSON.parse(DECODER.decode(plaintext));
        } catch (error) {
            if (epoch !== this.#epoch) throw error;
            throw new Error("Secret cannot be decrypted or is damaged.", { cause: error });
        } finally {
            plaintext?.fill(0);
        }
    }

    async set(id, value) {
        checkId(id);
        const { key, epoch } = await this.#session();
        let json;
        try {
            json = JSON.stringify(value);
        } catch {
            throw new TypeError("Secret value must be JSON-serializable.");
        }
        if (typeof json !== "string") throw new TypeError("Secret value must be JSON-serializable.");
        const plaintext = ENCODER.encode(json);
        let encrypted;
        try {
            encrypted = await encrypt(key, plaintext, `secret:${id}`);
        } finally {
            plaintext.fill(0);
        }
        this.#assertEpoch(epoch);
        await request(this.#database, SECRET_STORE, "readwrite", store => store.put({ id, ...encrypted }));
        this.#assertEpoch(epoch);
    }

    async delete(id) {
        checkId(id);
        const { epoch } = await this.#session();
        this.#assertEpoch(epoch);
        await request(this.#database, SECRET_STORE, "readwrite", store => store.delete(id));
        this.#assertEpoch(epoch);
    }

    async #session() {
        await this.#ready;
        if (this.#status !== "unlocked" || !this.#key) throw new Error("Secrets vault is locked.");
        return { key: this.#key, epoch: this.#epoch };
    }

    #assertEpoch(epoch) {
        if (epoch !== this.#epoch || !this.#key) throw new Error("Secrets vault was locked during the operation.");
    }

    #setStatus(status) {
        if (this.#status === status) return;
        this.#status = status;
        this.#bus?.emit("secrets:status-changed", { status });
    }

    #open() {
        return new Promise((resolve, reject) => {
            if (!globalThis.indexedDB || !globalThis.crypto?.subtle) {
                reject(new Error("Secrets requires IndexedDB and Web Crypto in a secure context."));
                return;
            }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "id" });
                if (!db.objectStoreNames.contains(SECRET_STORE)) db.createObjectStore(SECRET_STORE, { keyPath: "id" });
            };
            req.onerror = () => reject(req.error);
            req.onblocked = () => reject(new Error("Secrets database upgrade is blocked by another tab."));
            req.onsuccess = () => {
                this.#database = req.result;
                this.#database.onversionchange = () => {
                    this.lock();
                    this.#database.close();
                };
                resolve(this.#database);
            };
        });
    }
}
