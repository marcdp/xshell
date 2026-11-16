// Browser-local encrypted named secrets.
// Secrets V2 uses a random DEK for values and password/passkey-derived KEKs only to wrap that DEK.

const DB_NAME = "xshell-secrets";
const DB_VERSION = 2;
const FORMAT_VERSION = 2;
const META_STORE = "metadata";
const PASSKEY_STORE = "passkeys";
const SECRET_STORE = "secrets";
const VAULT_ID = "vault";
const KDF_ITERATIONS = 600_000;
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });

function checkPassword(options) {
    const password = options?.password;
    if (typeof password !== "string" || !password.length) {
        throw new TypeError("A non-empty master password is required.");
    }
    return password;
}

function checkId(id, kind = "Secret") {
    if (typeof id !== "string" || !id.trim()) {
        throw new TypeError(`${kind} id must be a non-empty string.`);
    }
}

function checkLabel(label) {
    if (typeof label !== "string" || !label.trim()) {
        throw new TypeError("A non-empty passkey label is required.");
    }
    return label.trim();
}

function bytes(value, length) {
    let result;
    if (value instanceof ArrayBuffer) result = new Uint8Array(value);
    else if (ArrayBuffer.isView(value)) result = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    else return null;
    return length === undefined || result.length === length ? result : null;
}

function base64urlEncode(value) {
    const valueBytes = bytes(value);
    if (!valueBytes) throw new TypeError("A binary value is required.");
    let binary = "";
    for (let offset = 0; offset < valueBytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...valueBytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64urlDecode(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) {
        throw new Error("Invalid passkey credential identifier.");
    }
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function aad(purpose) {
    return ENCODER.encode(`xshell-secrets:v2:${purpose}`);
}

function randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
}

async function derivePasswordKey(password, salt, iterations) {
    const passwordBytes = ENCODER.encode(password);
    try {
        const material = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, ["deriveKey"]);
        return await crypto.subtle.deriveKey(
            { name: "PBKDF2", hash: "SHA-256", salt, iterations },
            material,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    } finally {
        passwordBytes.fill(0);
    }
}

async function derivePasskeyKey(prfOutput, metadata, credentialId) {
    const output = bytes(prfOutput, 32);
    if (!output) throw new Error("The passkey did not return a usable WebAuthn PRF result.");
    try {
        const material = await crypto.subtle.importKey("raw", output, "HKDF", false, ["deriveKey"]);
        return await crypto.subtle.deriveKey(
            {
                name: "HKDF",
                hash: "SHA-256",
                salt: bytes(metadata.user.id, 32),
                info: aad(`passkey-kek:${credentialId}`)
            },
            material,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    } finally {
        output.fill(0);
    }
}

async function importDek(rawDek) {
    const raw = bytes(rawDek, 32);
    if (!raw) throw new Error("The Secrets vault contains an invalid data encryption key.");
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encrypt(key, plaintext, purpose) {
    const iv = randomBytes(12);
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: aad(purpose), tagLength: 128 },
        key,
        plaintext
    );
    return { iv, ciphertext };
}

async function decrypt(key, record, purpose) {
    const iv = bytes(record?.iv, 12);
    const ciphertext = bytes(record?.ciphertext);
    if (!iv || !ciphertext) throw new Error("Invalid encrypted record.");
    return new Uint8Array(await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: aad(purpose), tagLength: 128 },
        key,
        ciphertext
    ));
}

function validateMetadata(metadata) {
    if (!metadata || metadata.id !== VAULT_ID) throw new Error("Secrets vault is not initialized.");
    if (metadata.version !== FORMAT_VERSION) {
        const version = Number.isSafeInteger(metadata.version) ? metadata.version : "unknown";
        throw new Error(`Unsupported Secrets vault format version ${version}; only version 2 is supported.`);
    }
    const kdf = metadata.password?.kdf;
    const wrappedDek = metadata.password?.wrappedDek;
    if (typeof metadata.vaultId !== "string" || !metadata.vaultId ||
        typeof metadata.user?.name !== "string" || !metadata.user.name ||
        typeof metadata.user?.displayName !== "string" || !metadata.user.displayName ||
        !bytes(metadata.user?.id, 32) ||
        kdf?.algorithm !== "PBKDF2-SHA-256" ||
        !Number.isSafeInteger(kdf.iterations) || kdf.iterations < 1 ||
        !bytes(kdf.salt, 16) ||
        !bytes(wrappedDek?.iv, 12) || !bytes(wrappedDek?.ciphertext, 48)) {
        throw new Error("Secrets vault version 2 metadata is damaged.");
    }
    return metadata;
}

function validatePasskey(record) {
    if (!record || record.version !== FORMAT_VERSION || typeof record.id !== "string" || !record.id ||
        typeof record.label !== "string" || !record.label || typeof record.createdAt !== "string" ||
        !bytes(record.prfSalt, 32) || !bytes(record.wrappedDek?.iv, 12) || !bytes(record.wrappedDek?.ciphertext, 48)) {
        throw new Error("A passkey registration is damaged.");
    }
    return record;
}

function credentialId(credential) {
    if (bytes(credential?.rawId)) return base64urlEncode(credential.rawId);
    if (typeof credential?.id === "string" && credential.id) return credential.id;
    throw new Error("WebAuthn returned a credential without an identifier.");
}

function passkeyError(error, operation) {
    if (error?.name === "NotAllowedError") {
        const action = operation === "registration" ? "registration" : "authentication";
        return new Error(`Passkey ${action} was cancelled, timed out, or no eligible credential was available.`, { cause: error });
    }
    if (error?.name === "SecurityError") {
        return new Error("Passkeys are unavailable for this origin or relying-party configuration.", { cause: error });
    }
    if (error?.name === "InvalidStateError") {
        return new Error("This passkey is already registered for the local vault.", { cause: error });
    }
    return error;
}

export default class Secrets {
    #bus;
    #database;
    #ready;
    #status = "locked";
    #metadata = null;
    #key = null;
    #epoch = 0;
    #writeTransactions = new Set();

    constructor({ bus } = {}) {
        this.#bus = bus;
        this.#ready = this.#open().then(async db => {
            this.#metadata = await this.#request(META_STORE, "readonly", store => store.get(VAULT_ID)) || null;
            this.#setStatus(this.#metadata ? "locked" : "uninitialized");
        });
        void this.#ready.catch(() => {});
    }

    get status() { return this.#status; }

    async ready() {
        await this.#ready;
        return this.#status;
    }

    async initialize(options) {
        const password = checkPassword(options);
        const epoch = this.#epoch;
        await this.#ready;
        if (this.#metadata) throw new Error("Secrets vault is already initialized.");

        const rawDek = randomBytes(32);
        const salt = randomBytes(16);
        const vaultId = base64urlEncode(randomBytes(16));
        let dek;
        let passwordKey;
        let wrappedDek;
        try {
            [dek, passwordKey] = await Promise.all([
                importDek(rawDek),
                derivePasswordKey(password, salt, KDF_ITERATIONS)
            ]);
            this.#assertCurrent(epoch, false);
            wrappedDek = await encrypt(passwordKey, rawDek, `wrapped-dek:password:${vaultId}`);
        } finally {
            rawDek.fill(0);
            passwordKey = null;
        }

        const metadata = {
            id: VAULT_ID,
            version: FORMAT_VERSION,
            vaultId,
            user: {
                id: randomBytes(32),
                name: "xshell-secrets-vault",
                displayName: "XShell Secrets Vault"
            },
            password: {
                kdf: { algorithm: "PBKDF2-SHA-256", iterations: KDF_ITERATIONS, salt },
                wrappedDek
            }
        };

        this.#assertCurrent(epoch, false);
        await this.#request(META_STORE, "readwrite", store => store.add(metadata));
        this.#metadata = metadata;
        if (epoch !== this.#epoch) {
            this.#setStatus("locked");
            throw new Error("Vault was locked during initialization; unlock it again.");
        }
        this.#key = dek;
        this.#setStatus("unlocked");
    }

    async unlock(options) {
        const password = checkPassword(options);
        const epoch = this.#epoch;
        await this.#ready;
        const metadata = await this.#loadMetadata();
        const rawDek = await this.#unwrapWithPassword(password, metadata);
        let dek;
        try {
            dek = await importDek(rawDek);
        } finally {
            rawDek.fill(0);
        }
        if (epoch !== this.#epoch) throw new Error("Vault was locked during unlocking.");
        this.#metadata = metadata;
        this.#key = dek;
        this.#setStatus("unlocked");
    }

    async unlockWithPasskey(options = {}) {
        const epoch = this.#epoch;
        await this.#ready;
        this.#requirePasskeys();
        const metadata = await this.#loadMetadata();
        let registrations;
        if (options?.id !== undefined) {
            checkId(options.id, "Passkey");
            const record = await this.#request(PASSKEY_STORE, "readonly", store => store.get(options.id));
            if (!record) throw new Error("The selected passkey is not registered in this local vault.");
            registrations = [validatePasskey(record)];
        } else {
            registrations = (await this.#request(PASSKEY_STORE, "readonly", store => store.getAll())).map(validatePasskey);
            if (!registrations.length) throw new Error("No passkeys are registered in this local vault.");
        }
        this.#assertCurrent(epoch, false);

        const registrationsById = new Map(registrations.map(record => [record.id, record]));
        const allowCredentials = registrations.map(record => ({ type: "public-key", id: base64urlDecode(record.id) }));
        const extensions = registrations.length === 1
            ? { prf: { eval: { first: bytes(registrations[0].prfSalt, 32) } } }
            : { prf: { evalByCredential: Object.fromEntries(registrations.map(record => [
                record.id,
                { first: bytes(record.prfSalt, 32) }
            ])) } };

        let credential;
        try {
            credential = await navigator.credentials.get({
                publicKey: {
                    challenge: randomBytes(32),
                    allowCredentials,
                    userVerification: "required",
                    timeout: 60_000,
                    extensions
                }
            });
        } catch (error) {
            throw passkeyError(error, "authentication");
        }
        this.#assertCurrent(epoch, false);

        const id = credentialId(credential);
        const registration = registrationsById.get(id);
        if (!registration) throw new Error("WebAuthn returned a credential that is not registered in this local vault.");
        const prfOutput = credential.getClientExtensionResults?.()?.prf?.results?.first;
        if (!prfOutput) throw new Error("The passkey assertion did not return a WebAuthn PRF result.");

        const passkeyKey = await derivePasskeyKey(prfOutput, metadata, id);
        let rawDek;
        try {
            rawDek = await decrypt(passkeyKey, registration.wrappedDek,
                `wrapped-dek:passkey:${metadata.vaultId}:${id}`);
        } catch (error) {
            throw new Error("The passkey could not unlock this vault or its wrapped key is damaged.", { cause: error });
        }
        let dek;
        try {
            dek = await importDek(rawDek);
        } finally {
            rawDek?.fill(0);
        }
        if (epoch !== this.#epoch) throw new Error("Vault was locked during passkey unlocking.");
        this.#metadata = metadata;
        this.#key = dek;
        this.#setStatus("unlocked");
    }

    lock() {
        this.#epoch++;
        this.#key = null;
        for (const transaction of this.#writeTransactions) {
            try { transaction.abort(); } catch { /* The transaction might already be complete. */ }
        }
        this.#writeTransactions.clear();
        if (this.#metadata && this.#status !== "locked") this.#setStatus("locked");
    }

    async list() {
        const { epoch } = await this.#session();
        const ids = await this.#request(SECRET_STORE, "readonly", store => store.getAllKeys());
        this.#assertCurrent(epoch);
        return ids.sort().map(id => ({ id }));
    }

    async get(id) {
        checkId(id);
        const { key, epoch } = await this.#session();
        const record = await this.#request(SECRET_STORE, "readonly", store => store.get(id));
        this.#assertCurrent(epoch);
        if (!record) return undefined;
        if (record.version !== FORMAT_VERSION) throw new Error("Secret uses an unsupported encrypted format.");
        let plaintext;
        try {
            plaintext = await decrypt(key, record, `secret:${id}`);
            this.#assertCurrent(epoch);
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
        this.#assertCurrent(epoch);
        await this.#request(SECRET_STORE, "readwrite", store => store.put({ id, version: FORMAT_VERSION, ...encrypted }));
        this.#assertCurrent(epoch);
    }

    async delete(id) {
        checkId(id);
        const { epoch } = await this.#session();
        this.#assertCurrent(epoch);
        await this.#request(SECRET_STORE, "readwrite", store => store.delete(id));
        this.#assertCurrent(epoch);
    }

    async addPasskey(options) {
        const label = checkLabel(options?.label);
        const password = checkPassword(options);
        const { epoch } = await this.#session();
        this.#requirePasskeys(true);
        const metadata = await this.#loadMetadata();

        const authenticatedDek = await this.#unwrapWithPassword(password, metadata);
        authenticatedDek.fill(0);
        this.#assertCurrent(epoch);

        const existing = (await this.#request(PASSKEY_STORE, "readonly", store => store.getAll())).map(validatePasskey);
        const prfSalt = randomBytes(32);
        let credential;
        try {
            credential = await navigator.credentials.create({
                publicKey: {
                    challenge: randomBytes(32),
                    rp: { name: "XShell" },
                    user: {
                        id: bytes(metadata.user.id, 32),
                        name: metadata.user.name,
                        displayName: metadata.user.displayName
                    },
                    pubKeyCredParams: [
                        { type: "public-key", alg: -7 },
                        { type: "public-key", alg: -257 }
                    ],
                    timeout: 60_000,
                    attestation: "none",
                    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
                    excludeCredentials: existing.map(record => ({ type: "public-key", id: base64urlDecode(record.id) })),
                    extensions: { prf: { eval: { first: prfSalt } } }
                }
            });
        } catch (error) {
            throw passkeyError(error, "registration");
        }
        this.#assertCurrent(epoch);

        const id = credentialId(credential);
        const registrationPrf = credential.getClientExtensionResults?.()?.prf;
        if (registrationPrf?.enabled !== true) {
            throw new Error("The new passkey does not support the WebAuthn PRF extension.");
        }

        let prfOutput = registrationPrf.results?.first;
        if (!prfOutput) {
            let assertion;
            try {
                assertion = await navigator.credentials.get({
                    publicKey: {
                        challenge: randomBytes(32),
                        allowCredentials: [{ type: "public-key", id: base64urlDecode(id) }],
                        userVerification: "required",
                        timeout: 60_000,
                        extensions: { prf: { eval: { first: prfSalt } } }
                    }
                });
            } catch (error) {
                throw passkeyError(error, "authentication");
            }
            this.#assertCurrent(epoch);
            if (credentialId(assertion) !== id) {
                throw new Error("WebAuthn returned a different credential while confirming PRF support.");
            }
            prfOutput = assertion.getClientExtensionResults?.()?.prf?.results?.first;
        }
        if (!prfOutput) throw new Error("The new passkey did not return a WebAuthn PRF result.");

        const passkeyKey = await derivePasskeyKey(prfOutput, metadata, id);
        this.#assertCurrent(epoch);
        const rawDek = await this.#unwrapWithPassword(password, metadata);
        let wrappedDek;
        try {
            this.#assertCurrent(epoch);
            wrappedDek = await encrypt(passkeyKey, rawDek, `wrapped-dek:passkey:${metadata.vaultId}:${id}`);
        } finally {
            rawDek.fill(0);
        }
        this.#assertCurrent(epoch);

        const record = {
            id,
            version: FORMAT_VERSION,
            label,
            prfSalt,
            wrappedDek,
            createdAt: new Date().toISOString()
        };
        await this.#request(PASSKEY_STORE, "readwrite", store => store.add(record));
        this.#assertCurrent(epoch);
        return { id, label, createdAt: record.createdAt };
    }

    async listPasskeys() {
        await this.#ready;
        if (!this.#metadata) return [];
        validateMetadata(this.#metadata);
        const records = await this.#request(PASSKEY_STORE, "readonly", store => store.getAll());
        return records.map(validatePasskey)
            .map(({ id, label, createdAt }) => ({ id, label, createdAt }))
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }

    async removePasskey(id) {
        checkId(id, "Passkey");
        const { epoch } = await this.#session();
        this.#assertCurrent(epoch);
        await this.#request(PASSKEY_STORE, "readwrite", store => store.delete(id));
        this.#assertCurrent(epoch);
    }

    async #unwrapWithPassword(password, metadata) {
        const { kdf, wrappedDek } = validateMetadata(metadata).password;
        const key = await derivePasswordKey(password, bytes(kdf.salt, 16), kdf.iterations);
        let rawDek;
        try {
            rawDek = await decrypt(key, wrappedDek, `wrapped-dek:password:${metadata.vaultId}`);
            if (rawDek.length !== 32) throw new Error("Invalid data encryption key length.");
            return rawDek;
        } catch (error) {
            rawDek?.fill(0);
            throw new Error("Invalid master password or damaged Secrets vault.", { cause: error });
        }
    }

    async #loadMetadata() {
        const metadata = await this.#request(META_STORE, "readonly", store => store.get(VAULT_ID));
        if (!metadata) {
            this.#metadata = null;
            this.#setStatus("uninitialized");
            throw new Error("Secrets vault is not initialized.");
        }
        validateMetadata(metadata);
        this.#metadata = metadata;
        return metadata;
    }

    async #session() {
        await this.#ready;
        if (this.#status !== "unlocked" || !this.#key) throw new Error("Secrets vault is locked.");
        return { key: this.#key, epoch: this.#epoch };
    }

    #assertCurrent(epoch, requireKey = true) {
        if (epoch !== this.#epoch || (requireKey && !this.#key)) {
            throw new Error("Secrets vault was locked during the operation.");
        }
    }

    #requirePasskeys(registration = false) {
        if (globalThis.isSecureContext !== true || !globalThis.navigator?.credentials ||
            typeof navigator.credentials.get !== "function" ||
            (registration && typeof navigator.credentials.create !== "function")) {
            throw new Error("WebAuthn passkeys require a secure context and browser credential support.");
        }
    }

    #setStatus(status) {
        if (this.#status === status) return;
        this.#status = status;
        this.#bus?.emit("secrets:status-changed", { status });
    }

    #request(name, mode, operation) {
        return new Promise((resolve, reject) => {
            let transaction;
            try {
                transaction = this.#database.transaction(name, mode);
                if (mode === "readwrite") this.#writeTransactions.add(transaction);
                let result;
                const cleanup = () => this.#writeTransactions.delete(transaction);
                transaction.oncomplete = () => {
                    cleanup();
                    resolve(result);
                };
                transaction.onabort = () => {
                    cleanup();
                    reject(transaction.error || new Error("IndexedDB transaction aborted."));
                };
                transaction.onerror = () => {
                    cleanup();
                    reject(transaction.error || new Error("IndexedDB transaction failed."));
                };
                const request = operation(transaction.objectStore(name));
                request.onsuccess = () => { result = request.result; };
                request.onerror = () => {
                    try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                };
            } catch (error) {
                if (mode === "readwrite" && transaction) this.#writeTransactions.delete(transaction);
                try { transaction?.abort(); } catch { /* The transaction might already be inactive. */ }
                reject(error);
            }
        });
    }

    #open() {
        return new Promise((resolve, reject) => {
            if (!globalThis.indexedDB || !globalThis.crypto?.subtle) {
                reject(new Error("Secrets requires IndexedDB and Web Crypto."));
                return;
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: "id" });
                if (!database.objectStoreNames.contains(PASSKEY_STORE)) database.createObjectStore(PASSKEY_STORE, { keyPath: "id" });
                if (!database.objectStoreNames.contains(SECRET_STORE)) database.createObjectStore(SECRET_STORE, { keyPath: "id" });
            };
            request.onerror = () => reject(request.error || new Error("Secrets database could not be opened."));
            request.onblocked = () => reject(new Error("Secrets database upgrade is blocked by another tab."));
            request.onsuccess = () => {
                this.#database = request.result;
                this.#database.onversionchange = () => {
                    this.lock();
                    this.#database.close();
                };
                resolve(this.#database);
            };
        });
    }
}
