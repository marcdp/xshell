// Browser-local encrypted named secrets.
// Secrets V2 uses a random DEK for values and password/passkey-derived KEKs only to wrap that DEK.

import {indexedDBName} from "../utils/urls.js";

const DB_VERSION = 1;
const FORMAT_VERSION = 2;
const SESSION_FORMAT_VERSION = 1;
const MAX_REMEMBER_MINUTES = 43_200;
const META_STORE = "metadata";
const PASSKEY_STORE = "passkeys";
const SECRET_STORE = "secrets";
const SECRET_NAME_INDEX = "name";
const SESSION_STORE = "sessions";
const SESSION_STORAGE_KEY = "xshell-secrets:session:v1";
const VAULT_ID = "vault";
const KDF_ITERATIONS = 600_000;
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function checkPassword(options) {
    // Validate the master password input.
    const password = options?.password;
    if (typeof password !== "string" || !password.length) {
        throw new TypeError("A non-empty master password is required.");
    }
    return password;
}

function checkId(id, kind = "Secret") {
    // Validate a stored secret or passkey identifier.
    if (typeof id !== "string" || !id.trim()) {
        throw new TypeError(`${kind} id must be a non-empty string.`);
    }
}

function checkName(name) {
    // Validate a user-facing secret name.
    if (typeof name !== "string" || !name.trim()) throw new TypeError("Secret name must be a non-empty string.");
    return name;
}

function checkLabel(label) {
    // Validate a passkey label.
    if (typeof label !== "string" || !label.trim()) {
        throw new TypeError("A non-empty passkey label is required.");
    }
    return label.trim();
}

function checkDescription(description) {
    // Validate passkey description text.
    if (typeof description !== "string") throw new TypeError("Description must be a string.");
    return description;
}

function checkSecretLabel(label) {
    // Validate optional secret label text.
    if (typeof label !== "string") throw new TypeError("Secret label must be a string.");
    return label;
}

function secretMetadata(options) {
    // Validate writable metadata without accepting service-managed fields.
    if (options !== undefined && (!options || typeof options !== "object" || Array.isArray(options))) {
        throw new TypeError("Secret metadata must be an object.");
    }
    if (options && Object.keys(options).some(key => key !== "label" && key !== "description")) {
        throw new TypeError("Secret metadata contains an unknown property.");
    }
    const descriptionProvided = options !== undefined && Object.hasOwn(options, "description");
    const labelProvided = options !== undefined && Object.hasOwn(options, "label");
    const description = descriptionProvided ? checkDescription(options.description) : "";
    const label = labelProvided ? checkSecretLabel(options.label) : "";
    return { descriptionProvided, description, labelProvided, label };
}

function secretRevision(record) {
    // Reject metadata that cannot be incremented safely.
    if (!Number.isSafeInteger(record.revision) || record.revision < 1) {
        throw new Error("Secret revision metadata must be a positive safe integer.");
    }
    return record.revision;
}

function newSecretId() {
    // Generate the stable storage identity with the browser's secure UUID API.
    if (typeof crypto.randomUUID !== "function") throw new Error("Secrets requires crypto.randomUUID().");
    const id = crypto.randomUUID();
    if (typeof id !== "string" || !UUID_PATTERN.test(id)) throw new Error("crypto.randomUUID() returned an invalid UUID.");
    return id;
}

function checkRememberMinutes(value, fallback, maximum) {
    // Validate remembered-session duration limits.
    const minutes = value === undefined ? fallback : value;
    if (!Number.isSafeInteger(minutes) || minutes < 0) throw new TypeError("Remembered session duration must be a nonnegative integer.");
    if (minutes > maximum) throw new RangeError(`Remembered session duration cannot exceed ${maximum} minutes.`);
    return minutes;
}

function effectiveOptions(options = {}) {
    // Accept canonical Page references and paths produced by manifest URL normalization.
    if (Object.keys(options).some(name => !["rememberMinutes", "maxRememberMinutes", "pageUnlock", "pageManager"].includes(name))) {
        throw new TypeError("xshell.services.secrets.options contains an unknown option.");
    }
    for (const name of ["pageUnlock", "pageManager"]) {
        const page = options[name] ?? null;
        if (page !== null && (typeof page !== "string" || !page.trim() ||
            !(/^(?:page:[^:\s]+:\/\S+|\/\S+|https?:\/\/\S+)$/u).test(page))) {
            throw new TypeError(`xshell.services.secrets.options.${name} must be a non-empty Page resource reference or null.`);
        }
    }
    const maximum = options.maxRememberMinutes ?? 0;
    const fallback = options.rememberMinutes ?? 0;
    if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > MAX_REMEMBER_MINUTES) {
        throw new TypeError(`xshell.services.secrets.options.maxRememberMinutes must be an integer from 0 through ${MAX_REMEMBER_MINUTES}.`);
    }
    if (!Number.isSafeInteger(fallback) || fallback < 0 || fallback > MAX_REMEMBER_MINUTES) {
        throw new TypeError(`xshell.services.secrets.options.rememberMinutes must be an integer from 0 through ${MAX_REMEMBER_MINUTES}.`);
    }
    if (fallback > maximum) throw new RangeError("xshell.services.secrets.options.rememberMinutes cannot exceed maxRememberMinutes.");
    return Object.freeze({ rememberMinutes: fallback, maxRememberMinutes: maximum, pageUnlock: options.pageUnlock ?? null, pageManager: options.pageManager ?? null });
}

function interactiveAccess(options) {
    // Validate the interactive access preference.
    if (options === undefined) return true;
    if (!options || typeof options !== "object" || Array.isArray(options)) {
        throw new TypeError("Secret access options must be an object.");
    }
    if (Object.keys(options).some(key => key !== "interactive")) {
        throw new TypeError("Secret access options contain an unknown property.");
    }
    if (options.interactive !== undefined && typeof options.interactive !== "boolean") {
        throw new TypeError("Secret access interactive must be a boolean.");
    }
    return options.interactive !== false;
}

function bytes(value, length) {
    // Normalize binary input and enforce an optional length.
    let result;
    if (value instanceof ArrayBuffer) result = new Uint8Array(value);
    else if (ArrayBuffer.isView(value)) result = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    else return null;
    return length === undefined || result.length === length ? result : null;
}

function base64urlEncode(value) {
    // Encode binary data using URL-safe Base64.
    const valueBytes = bytes(value);
    if (!valueBytes) throw new TypeError("A binary value is required.");
    let binary = "";
    for (let offset = 0; offset < valueBytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...valueBytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64urlDecode(value) {
    // Decode a URL-safe Base64 value.
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) {
        throw new Error("Invalid passkey credential identifier.");
    }
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function sessionBytes(value, length) {
    // Decode session metadata while converting malformed values to null.
    try {
        const result = base64urlDecode(value);
        return result.length === length ? result : null;
    } catch {
        return null;
    }
}

function aad(purpose) {
    // Build authenticated encryption context for a purpose.
    return ENCODER.encode(`xshell-secrets:v2:${purpose}`);
}

function randomBytes(length) {
    // Generate cryptographically secure random bytes.
    return crypto.getRandomValues(new Uint8Array(length));
}

async function derivePasswordKey(password, salt, iterations) {
    // Derive the password key used to wrap the vault key.
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
    // Derive the passkey key used to wrap the vault key.
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
    // Import the vault data-encryption key for AES-GCM use.
    const raw = bytes(rawDek, 32);
    if (!raw) throw new Error("The Secrets vault contains an invalid data encryption key.");
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encrypt(key, plaintext, purpose) {
    // Encrypt plaintext with purpose-bound authenticated encryption.
    const iv = randomBytes(12);
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: aad(purpose), tagLength: 128 },
        key,
        plaintext
    );
    return { iv, ciphertext };
}

async function decrypt(key, record, purpose) {
    // Decrypt and validate a purpose-bound encrypted record.
    const iv = bytes(record?.iv, 12);
    const ciphertext = bytes(record?.ciphertext);
    if (!iv || !ciphertext) throw new Error("Invalid encrypted record.");
    return new Uint8Array(await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: aad(purpose), tagLength: 128 },
        key,
        ciphertext
    ));
}

function sessionPurpose(record) {
    // Build the authenticated context for a remembered session.
    return `session-wrapped-dek:${record.sessionId}:${record.vaultId}:${record.createdAt}:${record.expiresAt}`;
}

function validateSessionMetadata(record, metadata, maximum, now = Date.now()) {
    // Validate remembered-session metadata and its lifetime.
    const createdAt = typeof record?.createdAt === "string" ? Date.parse(record.createdAt) : NaN;
    const expiresAt = typeof record?.expiresAt === "string" ? Date.parse(record.expiresAt) : NaN;
    if (!record || record.version !== SESSION_FORMAT_VERSION || !sessionBytes(record.sessionId, 16) ||
        record.vaultId !== metadata.vaultId || !Number.isFinite(createdAt) || !Number.isFinite(expiresAt) ||
        new Date(createdAt).toISOString() !== record.createdAt || new Date(expiresAt).toISOString() !== record.expiresAt ||
        createdAt > now || expiresAt <= createdAt || expiresAt <= now || maximum === 0 ||
        expiresAt - createdAt > maximum * 60_000 || !sessionBytes(record.wrappedDek?.iv, 12) ||
        !sessionBytes(record.wrappedDek?.ciphertext, 48)) {
        throw new Error("Remembered Secrets session metadata is invalid or expired.");
    }
    return { createdAt, expiresAt };
}

function validateMetadata(metadata) {
    // Validate the persisted vault metadata shape and cryptographic fields.
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
    // Validate a persisted passkey registration.
    if (!record || record.version !== FORMAT_VERSION || typeof record.id !== "string" || !record.id ||
        typeof record.label !== "string" || !record.label || typeof record.createdAt !== "string" ||
        (record.description !== undefined && typeof record.description !== "string") ||
        !bytes(record.prfSalt, 32) || !bytes(record.wrappedDek?.iv, 12) || !bytes(record.wrappedDek?.ciphertext, 48)) {
        throw new Error("A passkey registration is damaged.");
    }
    return record;
}

function credentialId(credential) {
    // Extract a stable URL-safe credential identifier.
    if (bytes(credential?.rawId)) return base64urlEncode(credential.rawId);
    if (typeof credential?.id === "string" && credential.id) return credential.id;
    throw new Error("WebAuthn returned a credential without an identifier.");
}

function passkeyError(error, operation) {
    // Translate browser passkey errors into user-facing service errors.
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

    // options schema
    static optionsSchema = {
        type: "object",
        properties: {
            pageUnlock: { anyOf: [{ type: "string", pattern: "^(?:page:[^:\\s]+:/\\S+|/\\S+|https?://\\S+)$" }, { type: "null" }] },
            pageManager: { anyOf: [{ type: "string", pattern: "^(?:page:[^:\\s]+:/\\S+|/\\S+|https?://\\S+)$" }, { type: "null" }] },
            maxRememberMinutes: { type: "integer", minimum: 0, maximum: MAX_REMEMBER_MINUTES },
            rememberMinutes: { type: "integer", minimum: 0, maximum: MAX_REMEMBER_MINUTES }
        },
        additionalProperties: false
    };

    // vars
    #bus;
    #dialog;
    #logger;
    #database;
    #databaseName;
    #ready;
    #options;
    #status = "locked";
    #metadata = null;
    #key = null;
    #sessionId = null;
    #sessionExpiresAt = null;
    #expirationTimer = null;
    #epoch = 0;
    #writeTransactions = new Set();
    #unlockPromise = null;

    constructor({ bus, dialog, config, logger } = {}, options) {
        // Initialize services, options, and asynchronous vault recovery.
        this.#bus = bus;
        this.#dialog = dialog;
        this.#logger = logger;
        this.#databaseName = indexedDBName("secrets", config?.app?.basePath ?? "");
        this.#options = effectiveOptions(options);
        const epoch = this.#epoch;
        this.#ready = this.#open().then(async db => {
            this.#metadata = await this.#request(META_STORE, "readonly", store => store.get(VAULT_ID)) || null;
            this.#setStatus(this.#metadata ? "locked" : "uninitialized");
            if (this.#metadata) await this.#restore(epoch);
            else await this.#discardStoredSession(this.#readStoredSession());
        });
        void this.#ready.catch(() => {
            // Report the boundary only: vault recovery errors can contain authentication or storage details.
            this.#logger.error("Secrets: storage initialization failed");
        });
    }

    get status() { return this.#status; }
    get options() { return this.#options; }
    get sessionExpiresAt() { return this.#sessionExpiresAt; }
    
    async ready() {
        // Wait for database opening and stored-session recovery.
        await this.#ready;
        return this.#status;
    }

    async restoreSession() {
        // Restore a remembered session when the vault is still locked.
        const startEpoch = this.#epoch;
        await this.#ready;
        if (this.#status === "unlocked") {
            return { restored: false, status: this.#status, sessionExpiresAt: this.#sessionExpiresAt, reason: "already-unlocked" };
        }
        if (startEpoch !== this.#epoch) {
            return { restored: false, status: this.#status, sessionExpiresAt: null, reason: "interrupted" };
        }
        return this.#restore(++this.#epoch);
    }

    async initialize(options) {
        // Create the vault and wrap its initial data-encryption key.
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
        this.#clearStoredSession();
        this.#key = dek;
        this.#sessionId = null;
        this.#sessionExpiresAt = null;
        this.#setStatus("unlocked");
    }

    async unlock(options) {
        // Unlock the vault with the configured master password.
        const password = checkPassword(options);
        const rememberMinutes = checkRememberMinutes(options?.rememberMinutes, this.#options.rememberMinutes, this.#options.maxRememberMinutes);
        const epoch = ++this.#epoch;
        await this.#ready;
        const metadata = await this.#loadMetadata();
        const rawDek = await this.#unwrapWithPassword(password, metadata);
        try {
            await this.#activate(rawDek, metadata, rememberMinutes, epoch, "unlocking");
        } finally {
            rawDek.fill(0);
        }
    }

    async unlockWithPasskey(options = {}) {
        // Unlock the vault through a registered WebAuthn passkey.
        const rememberMinutes = checkRememberMinutes(options?.rememberMinutes, this.#options.rememberMinutes, this.#options.maxRememberMinutes);
        const epoch = ++this.#epoch;
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
        try {
            await this.#activate(rawDek, metadata, rememberMinutes, epoch, "passkey unlocking");
        } finally {
            rawDek?.fill(0);
        }
    }

    lock() {
        // Invalidate active keys, sessions, and write transactions.
        this.#epoch++;
        this.#key = null;
        const sessionId = this.#sessionId || this.#readStoredSession()?.sessionId;
        this.#sessionId = null;
        this.#sessionExpiresAt = null;
        this.#clearExpirationTimer();
        this.#removeStoredMetadata(sessionId);
        for (const transaction of this.#writeTransactions) {
            try { transaction.abort(); } catch { /* The transaction might already be complete. */ }
        }
        this.#writeTransactions.clear();
        if (sessionId) this.#deleteSessionRecordWhenReady(sessionId);
        if (this.#metadata && this.#status !== "locked") this.#setStatus("locked");
    }

    async list() {
        // List decrypted metadata for every stored secret.
        const { key, epoch } = await this.#session();
        const records = await this.#request(SECRET_STORE, "readonly", store => store.getAll());
        this.#assertCurrent(epoch);
        return (await Promise.all(records.map(record => this.#secretInfo(record, key, epoch))))
            .sort((left, right) => left.name.localeCompare(right.name));
    }

    async has(name) {
        // Check the plaintext name index without decrypting or unlocking the vault.
        checkName(name);
        await this.#ready;
        return await this.#findSecret(name) !== undefined;
    }

    async get(name, options) {
        // Retrieve and decrypt one named secret.
        checkName(name);
        await this.#ensureUnlocked(interactiveAccess(options));
        const { key, epoch } = await this.#session();
        const record = await this.#findSecret(name);
        this.#assertCurrent(epoch);
        if (!record) return undefined;
        this.#validateSecretRecord(record);
        let plaintext;
        try {
            plaintext = await decrypt(key, record, `secret:${record.id}`);
            this.#assertCurrent(epoch);
            return JSON.parse(DECODER.decode(plaintext));
        } catch (error) {
            if (epoch !== this.#epoch) throw error;
            throw new Error("Secret cannot be decrypted or is damaged.", { cause: error });
        } finally {
            plaintext?.fill(0);
        }
    }

    async getInfo(name) {
        // Retrieve decrypted metadata for one named secret.
        checkName(name);
        const { key, epoch } = await this.#session();
        const record = await this.#findSecret(name);
        this.#assertCurrent(epoch);
        return record ? this.#secretInfo(record, key, epoch) : undefined;
    }

    async set(name, value, options) {
        // Encrypt and atomically create or update one named secret.
        checkName(name);
        const metadata = secretMetadata(options);
        const { key, epoch } = await this.#session();
        let json;
        try {
            json = JSON.stringify(value);
        } catch {
            throw new TypeError("Secret value must be JSON-serializable.");
        }
        if (typeof json !== "string") throw new TypeError("Secret value must be JSON-serializable.");
        const plaintext = ENCODER.encode(json);
        const descriptionPlaintext = ENCODER.encode(metadata.description);
        const labelPlaintext = metadata.labelProvided && metadata.label ? ENCODER.encode(metadata.label) : null;
        try {
            // Retry only when a concurrent name change invalidates the pre-encryption lookup.
            while (true) {
                const existing = await this.#findSecret(name);
                const expectedId = existing?.id ?? null;
                const id = expectedId || newSecretId();
                const [encrypted, encryptedDescription, encryptedLabel] = await Promise.all([
                    encrypt(key, plaintext, `secret:${id}`),
                    encrypt(key, descriptionPlaintext, `secret-description:${id}`),
                    labelPlaintext ? encrypt(key, labelPlaintext, `secret-label:${id}`) : null
                ]);
                this.#assertCurrent(epoch);
                const committed = await this.#writeSecret(name, expectedId, current => {
                    this.#assertCurrent(epoch);
                    if (current) this.#validateSecretRecord(current);
                    const record = { id, name, version: FORMAT_VERSION, ...encrypted };
                    if (current) {
                        const revision = secretRevision(current);
                        if (revision === Number.MAX_SAFE_INTEGER) throw new RangeError("Secret revision cannot exceed the maximum safe integer.");
                        record.createdAt = current.createdAt;
                        record.modifiedAt = new Date().toISOString();
                        record.revision = revision + 1;
                    } else {
                        const timestamp = new Date().toISOString();
                        record.createdAt = timestamp;
                        record.modifiedAt = timestamp;
                        record.revision = 1;
                    }
                    record.description = metadata.descriptionProvided ? encryptedDescription : current?.description ?? encryptedDescription;
                    if (metadata.labelProvided) {
                        if (encryptedLabel) record.label = encryptedLabel;
                    } else if (current?.label !== undefined) {
                        record.label = current.label;
                    }
                    return record;
                });
                if (committed) break;
                this.#assertCurrent(epoch);
            }
        } finally {
            plaintext.fill(0);
            descriptionPlaintext.fill(0);
            labelPlaintext?.fill(0);
        }
        this.#assertCurrent(epoch);
        this.#notifyChanged("secret", "saved");
    }

    async delete(name) {
        // Delete one named secret from the vault.
        checkName(name);
        const { epoch } = await this.#session();
        this.#assertCurrent(epoch);
        await this.#deleteSecret(name);
        this.#assertCurrent(epoch);
        this.#notifyChanged("secret", "removed");
    }

    async rename(oldName, newName) {
        // Rename a secret while preserving its storage identity.
        checkName(oldName);
        checkName(newName);
        const { epoch } = await this.#session();
        this.#assertCurrent(epoch);
        await this.#renameSecret(oldName, newName, epoch);
        this.#assertCurrent(epoch);
        if (oldName !== newName) this.#notifyChanged("secret", "saved");
    }

    async addPasskey(options) {
        // Register a WebAuthn passkey that wraps the vault key.
        const label = checkLabel(options?.label);
        const description = options?.description === undefined ? "" : checkDescription(options.description);
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
            description,
            prfSalt,
            wrappedDek,
            createdAt: new Date().toISOString()
        };
        await this.#request(PASSKEY_STORE, "readwrite", store => store.add(record));
        this.#assertCurrent(epoch);
        this.#notifyChanged("passkey", "saved");
        return { id, label, description, createdAt: record.createdAt };
    }

    async listPasskeys() {
        // List non-sensitive metadata for registered passkeys.
        await this.#ready;
        if (!this.#metadata) return [];
        validateMetadata(this.#metadata);
        const records = await this.#request(PASSKEY_STORE, "readonly", store => store.getAll());
        return records.map(validatePasskey)
            .map(({ id, label, description = "", createdAt }) => ({ id, label, description, createdAt }))
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }

    async updatePasskey(id, options) {
        // Update the description of a registered passkey.
        checkId(id, "Passkey");
        if (!options || typeof options !== "object" || Array.isArray(options) || !Object.hasOwn(options, "description")) {
            throw new TypeError("Passkey metadata with a description is required.");
        }
        const description = checkDescription(options.description);
        const { epoch } = await this.#session();
        this.#assertCurrent(epoch);
        await this.#updateRecord(PASSKEY_STORE, id, existing => {
            this.#assertCurrent(epoch);
            if (!existing) throw new Error("The selected passkey is not registered in this local vault.");
            validatePasskey(existing);
            return { ...existing, description };
        });
        this.#assertCurrent(epoch);
        this.#notifyChanged("passkey", "saved");
    }

    async removePasskey(id) {
        // Remove a registered passkey from the vault.
        checkId(id, "Passkey");
        const { epoch } = await this.#session();
        this.#assertCurrent(epoch);
        await this.#request(PASSKEY_STORE, "readwrite", store => store.delete(id));
        this.#assertCurrent(epoch);
        this.#notifyChanged("passkey", "removed");
    }

    #validateSecretRecord(record) {
        // Validate the UUID-backed record shape before using encrypted fields.
        if (!record || record.version !== FORMAT_VERSION) throw new Error("Secret uses an unsupported encrypted format.");
        if (typeof record.id !== "string" || !UUID_PATTERN.test(record.id) || typeof record.name !== "string" || !record.name.trim() ||
            typeof record.createdAt !== "string" || typeof record.modifiedAt !== "string") {
            throw new Error("Secret identity metadata is damaged.");
        }
        secretRevision(record);
        return record;
    }

    async #secretInfo(record, key, epoch) {
        // Decrypt and project non-secret metadata for inspection.
        this.#validateSecretRecord(record);
        let description = "";
        let customLabel = "";
        let descriptionPlaintext;
        let labelPlaintext;
        if (record.description !== undefined) {
            try {
                descriptionPlaintext = await decrypt(key, record.description, `secret-description:${record.id}`);
                this.#assertCurrent(epoch);
                description = DECODER.decode(descriptionPlaintext);
            } catch (error) {
                if (epoch !== this.#epoch) throw error;
                throw new Error("Secret description cannot be decrypted or is damaged.", { cause: error });
            } finally {
                descriptionPlaintext?.fill(0);
            }
        }
        if (record.label !== undefined) {
            try {
                labelPlaintext = await decrypt(key, record.label, `secret-label:${record.id}`);
                this.#assertCurrent(epoch);
                customLabel = DECODER.decode(labelPlaintext);
            } catch (error) {
                if (epoch !== this.#epoch) throw error;
                throw new Error("Secret label cannot be decrypted or is damaged.", { cause: error });
            } finally {
                labelPlaintext?.fill(0);
            }
        }
        return {
            id: record.id,
            name: record.name,
            label: customLabel || record.name,
            description,
            createdAt: record.createdAt,
            modifiedAt: record.modifiedAt,
            revision: secretRevision(record)
        };
    }

    #findSecret(name) {
        // Resolve the exact case-sensitive name through the unique index.
        return this.#request(SECRET_STORE, "readonly", store => store.index(SECRET_NAME_INDEX).get(name));
    }

    #writeSecret(name, expectedId, update) {
        // Recheck name resolution inside the write transaction before committing encrypted data.
        return new Promise((resolve, reject) => {
            let transaction;
            let failure;
            let retry = false;
            try {
                transaction = this.#database.transaction(SECRET_STORE, "readwrite");
                this.#writeTransactions.add(transaction);
                const cleanup = () => this.#writeTransactions.delete(transaction);
                transaction.oncomplete = () => { cleanup(); resolve(!retry); };
                transaction.onabort = () => { cleanup(); reject(failure || transaction.error || new Error("IndexedDB transaction aborted.")); };
                transaction.onerror = () => { cleanup(); reject(failure || transaction.error || new Error("IndexedDB transaction failed.")); };
                const store = transaction.objectStore(SECRET_STORE);
                const request = store.index(SECRET_NAME_INDEX).get(name);
                request.onsuccess = () => {
                    const current = request.result;
                    if ((current?.id ?? null) !== expectedId) {
                        retry = true;
                        return;
                    }
                    try {
                        const result = current ? store.put(update(current)) : store.add(update(undefined));
                        result.onerror = () => {
                            try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                        };
                    } catch (error) {
                        failure = error;
                        try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                    }
                };
                request.onerror = () => {
                    try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                };
            } catch (error) {
                if (transaction) this.#writeTransactions.delete(transaction);
                try { transaction?.abort(); } catch { /* The transaction might already be inactive. */ }
                reject(error);
            }
        });
    }

    #deleteSecret(name) {
        // Resolve and delete by immutable primary key in one transaction.
        return new Promise((resolve, reject) => {
            let transaction;
            try {
                transaction = this.#database.transaction(SECRET_STORE, "readwrite");
                this.#writeTransactions.add(transaction);
                const cleanup = () => this.#writeTransactions.delete(transaction);
                transaction.oncomplete = () => { cleanup(); resolve(); };
                transaction.onabort = () => { cleanup(); reject(transaction.error || new Error("IndexedDB transaction aborted.")); };
                transaction.onerror = () => { cleanup(); reject(transaction.error || new Error("IndexedDB transaction failed.")); };
                const store = transaction.objectStore(SECRET_STORE);
                const request = store.index(SECRET_NAME_INDEX).get(name);
                request.onsuccess = () => {
                    if (!request.result) return;
                    const result = store.delete(request.result.id);
                    result.onerror = () => {
                        try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                    };
                };
                request.onerror = () => {
                    try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                };
            } catch (error) {
                if (transaction) this.#writeTransactions.delete(transaction);
                try { transaction?.abort(); } catch { /* The transaction might already be inactive. */ }
                reject(error);
            }
        });
    }

    async #renameSecret(oldName, newName, epoch) {
        // Treat an existing secret's current name as a true no-op.
        if (oldName === newName) {
            if (!await this.#findSecret(oldName)) throw new Error(`Secret '${oldName}' was not found.`);
            return;
        }
        return new Promise((resolve, reject) => {
            let transaction;
            let failure;
            try {
                transaction = this.#database.transaction(SECRET_STORE, "readwrite");
                this.#writeTransactions.add(transaction);
                const cleanup = () => this.#writeTransactions.delete(transaction);
                transaction.oncomplete = () => { cleanup(); resolve(); };
                transaction.onabort = () => { cleanup(); reject(failure || transaction.error || new Error("IndexedDB transaction aborted.")); };
                transaction.onerror = () => { cleanup(); reject(failure || transaction.error || new Error("IndexedDB transaction failed.")); };
                const store = transaction.objectStore(SECRET_STORE);
                const oldRequest = store.index(SECRET_NAME_INDEX).get(oldName);
                oldRequest.onsuccess = () => {
                    const current = oldRequest.result;
                    if (!current) {
                        failure = new Error(`Secret '${oldName}' was not found.`);
                        try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                        return;
                    }
                    const newRequest = store.index(SECRET_NAME_INDEX).get(newName);
                    newRequest.onsuccess = () => {
                        if (newRequest.result && newRequest.result.id !== current.id) {
                            failure = new Error(`A secret named '${newName}' already exists.`);
                            try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                            return;
                        }
                        try {
                            this.#assertCurrent(epoch);
                            this.#validateSecretRecord(current);
                            const revision = secretRevision(current);
                            if (revision === Number.MAX_SAFE_INTEGER) throw new RangeError("Secret revision cannot exceed the maximum safe integer.");
                            const result = store.put({ ...current, name:newName, modifiedAt:new Date().toISOString(), revision:revision + 1 });
                            result.onerror = () => {
                                try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                            };
                        } catch (error) {
                            failure = error;
                            try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                        }
                    };
                    newRequest.onerror = () => {
                        try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                    };
                };
                oldRequest.onerror = () => {
                    try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                };
            } catch (error) {
                if (transaction) this.#writeTransactions.delete(transaction);
                try { transaction?.abort(); } catch { /* The transaction might already be inactive. */ }
                reject(error);
            }
        });
    }

    #updateRecord(name, id, update) {
        // Update one IndexedDB record while tracking cancellation-sensitive writes.
        return new Promise((resolve, reject) => {
            let transaction;
            let failure;
            try {
                transaction = this.#database.transaction(name, "readwrite");
                this.#writeTransactions.add(transaction);
                const cleanup = () => this.#writeTransactions.delete(transaction);
                transaction.oncomplete = () => { cleanup(); resolve(); };
                transaction.onabort = () => { cleanup(); reject(failure || transaction.error || new Error("IndexedDB transaction aborted.")); };
                transaction.onerror = () => { cleanup(); reject(failure || transaction.error || new Error("IndexedDB transaction failed.")); };
                const store = transaction.objectStore(name);
                const request = store.get(id);
                request.onsuccess = () => {
                    try {
                        const result = store.put(update(request.result));
                        result.onerror = () => {
                            try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                        };
                    } catch (error) {
                        failure = error;
                        try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                    }
                };
                request.onerror = () => {
                    try { transaction.abort(); } catch { /* The transaction might already be inactive. */ }
                };
            } catch (error) {
                if (transaction) this.#writeTransactions.delete(transaction);
                try { transaction?.abort(); } catch { /* The transaction might already be inactive. */ }
                reject(error);
            }
        });
    }

    async #activate(rawDek, metadata, rememberMinutes, epoch, operation) {
        // Install the decrypted key and optionally persist a remembered session.
        let session = null;
        const dek = await importDek(rawDek);
        if (epoch !== this.#epoch) throw new Error(`Vault was locked during ${operation}.`);
        try {
            if (rememberMinutes > 0) session = await this.#persistSession(rawDek, metadata, rememberMinutes, epoch);
            else await this.#revokeRememberedSession();
            if (epoch !== this.#epoch) throw new Error(`Vault was locked during ${operation}.`);
            this.#metadata = metadata;
            this.#key = dek;
            this.#sessionId = session?.sessionId || null;
            this.#sessionExpiresAt = session?.expiresAt || null;
            this.#scheduleExpiration();
            this.#setStatus("unlocked", true);
        } catch (error) {
            if (session) await this.#discardStoredSession(session);
            if (epoch !== this.#epoch) throw new Error(`Vault was locked during ${operation}.`, { cause: error });
            throw error;
        }
    }

    async #persistSession(rawDek, metadata, rememberMinutes, epoch) {
        // Wrap and persist the data-encryption key for this browser session.
        if (!globalThis.sessionStorage) throw new Error("Remembered Secrets sessions require sessionStorage.");
        const sessionId = base64urlEncode(randomBytes(16));
        const now = Date.now();
        const createdAt = new Date(now).toISOString();
        const expiresAt = new Date(now + rememberMinutes * 60_000).toISOString();
        const record = { version: SESSION_FORMAT_VERSION, sessionId, vaultId: metadata.vaultId, createdAt, expiresAt };
        const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
        this.#assertCurrent(epoch, false);
        const wrappedDek = await encrypt(key, rawDek, sessionPurpose(record));
        record.wrappedDek = { iv: base64urlEncode(wrappedDek.iv), ciphertext: base64urlEncode(wrappedDek.ciphertext) };
        const previous = this.#readStoredSession();
        try {
            await this.#request(SESSION_STORE, "readwrite", store => store.put({ id: sessionId, key }));
            this.#assertCurrent(epoch, false);
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(record));
            this.#assertCurrent(epoch, false);
        } catch (error) {
            this.#removeStoredMetadata(sessionId);
            await this.#deleteSessionRecord(sessionId).catch(() => {});
            throw new Error("Remembered Secrets session could not be persisted.", { cause: error });
        }
        if (previous?.sessionId && previous.sessionId !== sessionId) void this.#deleteSessionRecord(previous.sessionId).catch(() => {});
        return record;
    }

    async #restore(epoch) {
        // Restore and validate a previously persisted remembered session.
        const record = this.#readStoredSession();
        if (!record) return { restored: false, status: this.#status, sessionExpiresAt: null, reason: "not-found" };
        try {
            validateMetadata(this.#metadata);
            const { expiresAt } = validateSessionMetadata(record, this.#metadata, this.#options.maxRememberMinutes);
            const stored = await this.#request(SESSION_STORE, "readonly", store => store.get(record.sessionId));
            if (!stored?.key || stored.id !== record.sessionId || stored.key.extractable !== false ||
                stored.key.algorithm?.name !== "AES-GCM" || !stored.key.usages?.includes("decrypt")) {
                throw new Error("Remembered Secrets session key is missing or invalid.");
            }
            const rawDek = await decrypt(stored.key, {
                iv: sessionBytes(record.wrappedDek.iv, 12),
                ciphertext: sessionBytes(record.wrappedDek.ciphertext, 48)
            }, sessionPurpose(record));
            let dek;
            try {
                dek = await importDek(rawDek);
            } finally {
                rawDek.fill(0);
            }
            if (epoch !== this.#epoch) throw new Error("Vault was locked during session restoration.");
            this.#key = dek;
            this.#sessionId = record.sessionId;
            this.#sessionExpiresAt = new Date(expiresAt).toISOString();
            this.#scheduleExpiration();
            this.#setStatus("unlocked", true);
            return { restored: true, status: this.#status, sessionExpiresAt: this.#sessionExpiresAt };
        } catch (error) {
            await this.#discardStoredSession(record);
            if (epoch !== this.#epoch) {
                return { restored: false, status: this.#status, sessionExpiresAt: this.#sessionExpiresAt, reason: "interrupted" };
            }
            this.#key = null;
            this.#sessionId = null;
            this.#sessionExpiresAt = null;
            this.#clearExpirationTimer();
            this.#setStatus(this.#metadata ? "locked" : "uninitialized");
            return { restored: false, status: this.#status, sessionExpiresAt: null, reason: "invalid" };
        }
    }

    #readStoredSession() {
        // Read and parse remembered-session metadata defensively.
        try {
            const value = globalThis.sessionStorage?.getItem(SESSION_STORAGE_KEY);
            return value ? JSON.parse(value) : null;
        } catch {
            try { globalThis.sessionStorage?.removeItem(SESSION_STORAGE_KEY); } catch { /* Storage can be unavailable or blocked. */ }
            return null;
        }
    }

    #removeStoredMetadata(sessionId) {
        // Remove session metadata only when it still belongs to this session.
        try {
            const current = this.#readStoredSession();
            if (!sessionId || current?.sessionId === sessionId) globalThis.sessionStorage?.removeItem(SESSION_STORAGE_KEY);
        } catch { /* Storage can be unavailable or blocked. */ }
    }

    #clearStoredSession() {
        // Clear browser session metadata and its IndexedDB key asynchronously.
        const record = this.#readStoredSession();
        if (!record) return;
        this.#removeStoredMetadata(record.sessionId);
        if (record.sessionId) this.#deleteSessionRecordWhenReady(record.sessionId);
    }

    async #revokeRememberedSession() {
        // Revoke any remembered session before switching to memory-only access.
        const sessionId = this.#sessionId || this.#readStoredSession()?.sessionId;
        this.#removeStoredMetadata(sessionId);
        if (sessionId) {
            try { await this.#deleteSessionRecord(sessionId); }
            catch (error) { throw new Error("Existing remembered Secrets session could not be revoked.", { cause: error }); }
        }
    }

    async #discardStoredSession(record) {
        // Remove invalid or superseded remembered-session data.
        if (!record) return;
        this.#removeStoredMetadata(record.sessionId);
        if (record.sessionId) await this.#deleteSessionRecord(record.sessionId).catch(() => {});
    }

    async #deleteSessionRecord(sessionId) {
        // Delete the IndexedDB key associated with a remembered session.
        if (!this.#database) return;
        await this.#request(SESSION_STORE, "readwrite", store => store.delete(sessionId), false);
    }

    #deleteSessionRecordWhenReady(sessionId) {
        // Delete a session key immediately or after database startup completes.
        if (this.#database) void this.#deleteSessionRecord(sessionId).catch(() => {});
        else void this.#ready.then(() => this.#deleteSessionRecord(sessionId)).catch(() => {});
    }

    #scheduleExpiration() {
        // Schedule automatic locking at the remembered-session expiry time.
        this.#clearExpirationTimer();
        if (!this.#sessionExpiresAt) return;
        const delay = Date.parse(this.#sessionExpiresAt) - Date.now();
        if (delay <= 0) return void this.lock();
        this.#expirationTimer = globalThis.setTimeout(() => {
            this.#expirationTimer = null;
            if (this.#sessionExpiresAt && Date.parse(this.#sessionExpiresAt) <= Date.now()) this.lock();
            else this.#scheduleExpiration();
        }, delay);
        this.#expirationTimer?.unref?.();
    }

    #clearExpirationTimer() {
        // Cancel the active remembered-session expiry timer.
        if (this.#expirationTimer !== null) globalThis.clearTimeout(this.#expirationTimer);
        this.#expirationTimer = null;
    }

    async #unwrapWithPassword(password, metadata) {
        // Unwrap the vault key with the persisted password-derived key.
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
        // Load and validate the current vault metadata from IndexedDB.
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

    async #ensureUnlocked(interactive) {
        // Ensure the vault is unlocked, opening authentication when permitted.
        await this.#ready;
        if (this.#sessionExpiresAt && Date.parse(this.#sessionExpiresAt) <= Date.now()) this.lock();
        if (this.#status === "unlocked" && this.#key) return;
        if (!interactive || this.#options.pageUnlock === null) throw new Error("Secrets vault is locked.");
        if (!this.#dialog || typeof this.#dialog.open !== "function") {
            throw new Error("Secrets vault authentication requires the Dialog service.");
        }

        if (!this.#unlockPromise) {
            const pending = this.#openUnlockDialog();
            this.#unlockPromise = pending;
            void pending.then(
                () => { if (this.#unlockPromise === pending) this.#unlockPromise = null; },
                () => { if (this.#unlockPromise === pending) this.#unlockPromise = null; }
            );
        }

        await this.#unlockPromise;
        if (this.#status !== "unlocked" || !this.#key) {
            throw new DOMException("Secrets access cancelled.", "AbortError");
        }
    }

    async #openUnlockDialog() {
        // Open the configured authentication Page and await its result.
        await this.#dialog.open({
            href: this.#options.pageUnlock,
            context: {}
        });
        if (this.#status !== "unlocked" || !this.#key) {
            throw new DOMException("Secrets access cancelled.", "AbortError");
        }
    }

    async #session() {
        // Return the active key and epoch for a guarded operation.
        await this.#ready;
        if (this.#sessionExpiresAt && Date.parse(this.#sessionExpiresAt) <= Date.now()) this.lock();
        if (this.#status !== "unlocked" || !this.#key) throw new Error("Secrets vault is locked.");
        return { key: this.#key, epoch: this.#epoch };
    }

    #assertCurrent(epoch, requireKey = true) {
        // Reject work that was invalidated by locking or a newer operation.
        if (epoch !== this.#epoch || (requireKey && !this.#key)) {
            throw new Error("Secrets vault was locked during the operation.");
        }
    }

    #requirePasskeys(registration = false) {
        // Verify secure-context and WebAuthn support before passkey use.
        if (globalThis.isSecureContext !== true || !globalThis.navigator?.credentials ||
            typeof navigator.credentials.get !== "function" ||
            (registration && typeof navigator.credentials.create !== "function")) {
            throw new Error("WebAuthn passkeys require a secure context and browser credential support.");
        }
    }

    #setStatus(status, force = false) {
        // Update status and publish the corresponding service event.
        if (this.#status === status && !force) return;
        this.#status = status;
        this.#bus?.emit("secrets:status-changed", { status, sessionExpiresAt: this.#sessionExpiresAt });
    }

    #notifyChanged(kind, action) {
        // Keep committed vault mutations successful when a notification listener fails.
        try { this.#bus?.emit("secrets:changed", {kind, action}); }
        catch {
            this.#logger.warn("Secrets: change notification failed");
        }
    }

    #request(name, mode, operation, trackWrite = true) {
        // Execute one IndexedDB request with transaction cleanup and tracking.
        return new Promise((resolve, reject) => {
            let transaction;
            try {
                transaction = this.#database.transaction(name, mode);
                const tracked = mode === "readwrite" && trackWrite;
                if (tracked) this.#writeTransactions.add(transaction);
                let result;
                const cleanup = () => { if (tracked) this.#writeTransactions.delete(transaction); };
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
                if (mode === "readwrite" && trackWrite && transaction) this.#writeTransactions.delete(transaction);
                try { transaction?.abort(); } catch { /* The transaction might already be inactive. */ }
                reject(error);
            }
        });
    }

    #open() {
        // Open the vault database and create its stores on first use.
        return new Promise((resolve, reject) => {
            if (!globalThis.indexedDB || !globalThis.crypto?.subtle) {
                reject(new Error("Secrets requires IndexedDB and Web Crypto."));
                return;
            }
            const request = indexedDB.open(this.#databaseName, DB_VERSION);
            request.onupgradeneeded = () => {
                const database = request.result;
                database.createObjectStore(META_STORE, { keyPath: "id" });
                database.createObjectStore(PASSKEY_STORE, { keyPath: "id" });
                const secrets = database.createObjectStore(SECRET_STORE, { keyPath: "id" });
                secrets.createIndex(SECRET_NAME_INDEX, "name", { unique:true });
                database.createObjectStore(SESSION_STORE, { keyPath: "id" });
            };
            request.onerror = () => reject(request.error || new Error("Secrets database could not be opened."));
            request.onblocked = () => reject(new Error("Opening the Secrets database is blocked by another tab."));
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
