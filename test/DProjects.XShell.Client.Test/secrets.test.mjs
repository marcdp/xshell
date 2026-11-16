import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import contract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/secrets.json" with { type: "json" };
import commonSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import serviceSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/service.schema.json" with { type: "json" };
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Secrets from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/secrets.js";

const originalDescriptors = new Map();

function setGlobal(name, value) {
    if (!originalDescriptors.has(name)) originalDescriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

afterEach(() => {
    for (const [name, descriptor] of originalDescriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
    }
    originalDescriptors.clear();
});

function copy(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function createIndexedDB(seed = {}) {
    const stores = new Map();
    let version = seed.version || 0;
    for (const [name, definition] of Object.entries(seed.stores || {})) {
        stores.set(name, {
            keyPath: definition.keyPath || "id",
            records: new Map((definition.records || []).map(record => [record[definition.keyPath || "id"], copy(record)]))
        });
    }

    function createTransaction(name, mode) {
        const definition = stores.get(name);
        if (!definition) throw new Error(`Missing object store ${name}.`);
        const before = mode === "readwrite" ? new Map([...definition.records].map(([key, value]) => [key, copy(value)])) : null;
        let pending = 0;
        let completionQueued = false;
        let finished = false;
        let aborted = false;
        const transaction = {
            error: null,
            oncomplete: null,
            onabort: null,
            onerror: null,
            abort() {
                if (finished || aborted) throw new Error("Transaction is inactive.");
                aborted = true;
                transaction.error ||= new Error("Transaction aborted.");
                if (before) definition.records = new Map([...before].map(([key, value]) => [key, copy(value)]));
                queueMicrotask(() => {
                    if (finished) return;
                    finished = true;
                    transaction.onabort?.();
                });
            },
            objectStore() {
                const operation = callback => {
                    if (finished || aborted) throw new Error("Transaction is inactive.");
                    pending++;
                    const request = { result: undefined, error: null, onsuccess: null, onerror: null };
                    queueMicrotask(() => {
                        if (aborted) return;
                        try {
                            request.result = callback();
                            request.onsuccess?.();
                        } catch (error) {
                            request.error = error;
                            transaction.error = error;
                            request.onerror?.();
                            if (!aborted) transaction.abort();
                            return;
                        } finally {
                            pending--;
                        }
                        if (!completionQueued && pending === 0) {
                            completionQueued = true;
                            queueMicrotask(() => {
                                if (finished || aborted || pending !== 0) return;
                                finished = true;
                                transaction.oncomplete?.();
                            });
                        }
                    });
                    return request;
                };
                const keyFor = value => value[definition.keyPath];
                return {
                    get(key) { return operation(() => copy(definition.records.get(key))); },
                    getAll() { return operation(() => [...definition.records.values()].map(copy)); },
                    getAllKeys() { return operation(() => [...definition.records.keys()]); },
                    add(value) {
                        return operation(() => {
                            const key = keyFor(value);
                            if (definition.records.has(key)) throw new DOMException("Key already exists.", "ConstraintError");
                            definition.records.set(key, copy(value));
                            return key;
                        });
                    },
                    put(value) {
                        return operation(() => {
                            const key = keyFor(value);
                            definition.records.set(key, copy(value));
                            return key;
                        });
                    },
                    delete(key) {
                        return operation(() => { definition.records.delete(key); });
                    }
                };
            }
        };
        return transaction;
    }

    const indexedDB = {
        open(_name, requestedVersion) {
            const request = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
            queueMicrotask(() => {
                const database = {
                    onversionchange: null,
                    objectStoreNames: { contains(name) { return stores.has(name); } },
                    createObjectStore(name, { keyPath }) {
                        if (!stores.has(name)) stores.set(name, { keyPath, records: new Map() });
                        return stores.get(name);
                    },
                    transaction(name, mode) { return createTransaction(name, mode); },
                    close() {}
                };
                request.result = database;
                if (requestedVersion > version) {
                    version = requestedVersion;
                    request.onupgradeneeded?.();
                }
                request.onsuccess?.();
            });
            return request;
        }
    };

    return {
        indexedDB,
        records(name) {
            const definition = stores.get(name);
            return definition ? [...definition.records.values()].map(copy) : [];
        }
    };
}

function base64url(value) {
    return Buffer.from(value).toString("base64url");
}

function createWebAuthn({ registrationEnabled = true, registrationResult = false, assertionResult = true } = {}) {
    const credentials = new Map();
    const calls = { create: [], get: [] };
    let counter = 0;
    let selectedId = null;
    let createError = null;
    let getError = null;

    const result = (id, output, registration = false) => ({
        id,
        rawId: Uint8Array.from(Buffer.from(id, "base64url")).buffer,
        type: "public-key",
        getClientExtensionResults() {
            if (registration) {
                return {
                    prf: {
                        enabled: registrationEnabled,
                        ...(registrationResult && output ? { results: { first: Uint8Array.from(output).buffer } } : {})
                    }
                };
            }
            return { prf: assertionResult && output ? { results: { first: Uint8Array.from(output).buffer } } : {} };
        }
    });

    const api = {
        credentials,
        calls,
        set selectedId(value) { selectedId = value; },
        set createError(value) { createError = value; },
        set getError(value) { getError = value; },
        credentialsContainer: {
            async create(options) {
                calls.create.push(copy(options));
                if (createError) throw createError;
                counter++;
                const rawId = Uint8Array.from([counter, counter + 1, counter + 2, counter + 3]);
                const id = base64url(rawId);
                const output = new Uint8Array(32).fill(16 + counter);
                credentials.set(id, output);
                return result(id, output, true);
            },
            async get(options) {
                calls.get.push(copy(options));
                if (getError) throw getError;
                const allowed = options.publicKey.allowCredentials.map(item => base64url(new Uint8Array(item.id)));
                const id = selectedId || allowed[0];
                return result(id, credentials.get(id), false);
            }
        }
    };
    return api;
}

function installEnvironment(database, webauthn = createWebAuthn()) {
    setGlobal("indexedDB", database.indexedDB);
    setGlobal("isSecureContext", true);
    setGlobal("navigator", { credentials: webauthn.credentialsContainer });
    return webauthn;
}

test("Secrets V2 contract validates against the service contract schema", () => {
    const result = new JsonValidator().validate(contract, serviceSchema, { "./contract.schema.json": commonSchema });
    assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
});

test("Secrets V2 initializes a random-DEK vault and preserves JSON CRUD across password unlocks", async () => {
    const database = createIndexedDB();
    installEnvironment(database);
    const events = [];
    const secrets = new Secrets({ bus: { emit(name, detail) { events.push({ name, detail }); } } });

    assert.equal(await secrets.ready(), "uninitialized");
    await secrets.initialize({ password: "correct horse battery staple" });
    assert.equal(secrets.status, "unlocked");

    const [metadata] = database.records("metadata");
    assert.equal(metadata.version, 2);
    assert.equal(metadata.password.kdf.algorithm, "PBKDF2-SHA-256");
    assert.equal(metadata.password.kdf.iterations, 600_000);
    assert.equal(metadata.password.kdf.salt.byteLength, 16);
    assert.equal(metadata.password.wrappedDek.iv.byteLength, 12);
    assert.ok(metadata.password.wrappedDek.ciphertext.byteLength > 32);
    assert.equal(JSON.stringify(metadata).includes("correct horse battery staple"), false);
    assert.deepEqual(Object.keys(metadata).sort(), ["id", "password", "user", "vaultId", "version"]);

    await secrets.set("text", "sensitive value");
    await secrets.set("structured", { enabled: true, values: [1, "two", null] });
    assert.deepEqual(await secrets.list(), [{ id: "structured" }, { id: "text" }]);
    assert.equal(await secrets.get("text"), "sensitive value");
    assert.deepEqual(await secrets.get("structured"), { enabled: true, values: [1, "two", null] });
    assert.equal(await secrets.get("missing"), undefined);

    const storedSecrets = database.records("secrets");
    assert.equal(storedSecrets.length, 2);
    assert.ok(storedSecrets.every(record => record.version === 2 && record.iv.byteLength === 12));
    assert.equal(storedSecrets.some(record => JSON.stringify(record).includes("sensitive value")), false);
    assert.notDeepEqual([...storedSecrets[0].iv], [...storedSecrets[1].iv]);

    secrets.lock();
    await assert.rejects(secrets.get("text"), /locked/u);
    const reopened = new Secrets();
    assert.equal(await reopened.ready(), "locked");
    const metadataBeforeWrongPassword = database.records("metadata");
    await assert.rejects(reopened.unlock({ password: "wrong" }), /Invalid master password/u);
    assert.equal(reopened.status, "locked");
    assert.deepEqual(database.records("metadata"), metadataBeforeWrongPassword);
    await reopened.unlock({ password: "correct horse battery staple" });
    assert.equal(await reopened.get("text"), "sensitive value");
    await reopened.delete("text");
    assert.equal(await reopened.get("text"), undefined);
    assert.ok(events.some(event => event.name === "secrets:status-changed" && event.detail.status === "unlocked"));
});

test("multiple PRF passkeys wrap the same DEK without re-encrypting secrets", async () => {
    const database = createIndexedDB();
    const webauthn = installEnvironment(database, createWebAuthn());
    const secrets = new Secrets();
    await secrets.ready();
    await secrets.initialize({ password: "master password" });
    await secrets.set("token", { value: "unchanged" });
    const encryptedSecret = database.records("secrets")[0];

    const laptop = await secrets.addPasskey({ label: "Laptop", password: "master password" });
    const phone = await secrets.addPasskey({ label: "Phone", password: "master password" });
    assert.equal(webauthn.calls.create.length, 2);
    assert.equal(webauthn.calls.get.length, 2, "registration without PRF output must obtain an assertion");
    assert.deepEqual(await secrets.listPasskeys(), [
        { id: laptop.id, label: "Laptop", createdAt: laptop.createdAt },
        { id: phone.id, label: "Phone", createdAt: phone.createdAt }
    ]);
    assert.deepEqual(database.records("secrets")[0], encryptedSecret);

    const registrations = database.records("passkeys");
    assert.equal(registrations.length, 2);
    assert.notDeepEqual([...registrations[0].prfSalt], [...registrations[1].prfSalt]);
    assert.notDeepEqual([...new Uint8Array(registrations[0].wrappedDek.ciphertext)],
        [...new Uint8Array(registrations[1].wrappedDek.ciphertext)]);
    assert.deepEqual(Object.keys(registrations[0]).sort(), ["createdAt", "id", "label", "prfSalt", "version", "wrappedDek"]);

    secrets.lock();
    await secrets.unlockWithPasskey({ id: laptop.id });
    assert.deepEqual(await secrets.get("token"), { value: "unchanged" });
    secrets.lock();
    webauthn.selectedId = phone.id;
    await secrets.unlockWithPasskey();
    assert.deepEqual(await secrets.get("token"), { value: "unchanged" });
    const lastRequest = webauthn.calls.get.at(-1).publicKey;
    assert.ok(lastRequest.extensions.prf.evalByCredential);
    assert.equal(lastRequest.userVerification, "required");

    await secrets.removePasskey(laptop.id);
    assert.deepEqual((await secrets.listPasskeys()).map(item => item.id), [phone.id]);
    assert.deepEqual(database.records("secrets")[0], encryptedSecret);
    secrets.lock();
    await assert.rejects(secrets.unlockWithPasskey({ id: laptop.id }), /not registered/u);
    await secrets.unlockWithPasskey({ id: phone.id });
    assert.deepEqual(await secrets.get("token"), { value: "unchanged" });
});

test("passkey enrollment rejects missing passwords, unsupported PRF, missing PRF output, and cancellation", async () => {
    const database = createIndexedDB();
    const unsupported = installEnvironment(database, createWebAuthn({ registrationEnabled: false }));
    const secrets = new Secrets();
    await secrets.ready();
    await secrets.initialize({ password: "master password" });

    await assert.rejects(secrets.addPasskey({ label: "No password" }), /master password/u);
    assert.equal(unsupported.calls.create.length, 0);
    await assert.rejects(secrets.addPasskey({ label: "Unsupported", password: "master password" }), /does not support.*PRF/u);
    assert.deepEqual(await secrets.listPasskeys(), []);

    const missing = createWebAuthn({ registrationEnabled: true, assertionResult: false });
    setGlobal("navigator", { credentials: missing.credentialsContainer });
    await assert.rejects(secrets.addPasskey({ label: "Missing result", password: "master password" }), /did not return.*PRF/u);
    assert.deepEqual(await secrets.listPasskeys(), []);

    const cancelled = createWebAuthn();
    cancelled.createError = new DOMException("Cancelled", "NotAllowedError");
    setGlobal("navigator", { credentials: cancelled.credentialsContainer });
    await assert.rejects(secrets.addPasskey({ label: "Cancelled", password: "master password" }), /cancelled, timed out/u);
    assert.deepEqual(await secrets.listPasskeys(), []);
});

test("passkey unlocking rejects cancellation, unexpected credentials, missing output, and incorrect PRF material", async () => {
    const database = createIndexedDB();
    const webauthn = installEnvironment(database, createWebAuthn());
    const secrets = new Secrets();
    await secrets.ready();
    await secrets.initialize({ password: "master password" });
    await secrets.set("token", "value");
    const registration = await secrets.addPasskey({ label: "Laptop", password: "master password" });
    secrets.lock();

    webauthn.getError = new DOMException("Cancelled", "NotAllowedError");
    await assert.rejects(secrets.unlockWithPasskey({ id: registration.id }), /cancelled, timed out/u);
    assert.equal(secrets.status, "locked");
    webauthn.getError = null;

    webauthn.selectedId = base64url(Uint8Array.from([99, 98, 97]));
    await assert.rejects(secrets.unlockWithPasskey({ id: registration.id }), /not registered/u);
    webauthn.selectedId = null;

    const originalOutput = webauthn.credentials.get(registration.id);
    webauthn.credentials.set(registration.id, new Uint8Array(32).fill(255));
    await assert.rejects(secrets.unlockWithPasskey({ id: registration.id }), /could not unlock/u);
    webauthn.credentials.set(registration.id, originalOutput);

    const missing = createWebAuthn({ assertionResult: false });
    missing.credentials.set(registration.id, originalOutput);
    setGlobal("navigator", { credentials: missing.credentialsContainer });
    await assert.rejects(secrets.unlockWithPasskey({ id: registration.id }), /did not return.*PRF/u);
    assert.equal(secrets.status, "locked");
});

test("locking invalidates in-flight password unlock and encrypted writes", async () => {
    const database = createIndexedDB();
    installEnvironment(database);
    const secrets = new Secrets();
    await secrets.ready();
    await secrets.initialize({ password: "master password" });
    secrets.lock();

    const unlocking = secrets.unlock({ password: "master password" });
    secrets.lock();
    await assert.rejects(unlocking, /locked during unlocking/u);
    assert.equal(secrets.status, "locked");
    await secrets.unlock({ password: "master password" });

    const nativeCrypto = globalThis.crypto;
    let releaseEncryption;
    let encryptionStarted;
    const started = new Promise(resolve => { encryptionStarted = resolve; });
    const gate = new Promise(resolve => { releaseEncryption = resolve; });
    const subtle = new Proxy(nativeCrypto.subtle, {
        get(target, property) {
            if (property === "encrypt") {
                return async (...args) => {
                    encryptionStarted();
                    await gate;
                    return target.encrypt(...args);
                };
            }
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
        }
    });
    setGlobal("crypto", {
        subtle,
        getRandomValues(value) { return nativeCrypto.getRandomValues(value); }
    });

    const writing = secrets.set("late", "must not persist");
    await started;
    secrets.lock();
    releaseEncryption();
    await assert.rejects(writing, /locked during the operation/u);
    assert.equal(database.records("secrets").some(record => record.id === "late"), false);
});

test("locking during passkey registration does not persist a registration", async () => {
    const database = createIndexedDB();
    let releaseCreation;
    let creationStarted;
    const started = new Promise(resolve => { creationStarted = resolve; });
    const gate = new Promise(resolve => { releaseCreation = resolve; });
    const webauthn = createWebAuthn({ registrationResult: true });
    const nativeCreate = webauthn.credentialsContainer.create;
    webauthn.credentialsContainer.create = async options => {
        creationStarted();
        await gate;
        return nativeCreate(options);
    };
    installEnvironment(database, webauthn);
    const secrets = new Secrets();
    await secrets.ready();
    await secrets.initialize({ password: "master password" });

    const enrollment = secrets.addPasskey({ label: "Interrupted", password: "master password" });
    await started;
    secrets.lock();
    releaseCreation();
    await assert.rejects(enrollment, /locked during the operation/u);
    assert.deepEqual(database.records("passkeys"), []);
    assert.equal(secrets.status, "locked");
});

test("legacy V1 metadata is rejected without deletion or replacement", async () => {
    const legacy = {
        id: "vault",
        version: 1,
        kdf: "PBKDF2-SHA-256",
        iterations: 600_000,
        salt: new Uint8Array(16),
        iv: new Uint8Array(12),
        ciphertext: new ArrayBuffer(32)
    };
    const database = createIndexedDB({
        version: 1,
        stores: {
            metadata: { records: [legacy] },
            secrets: { records: [{ id: "legacy", iv: new Uint8Array(12), ciphertext: new ArrayBuffer(16) }] }
        }
    });
    installEnvironment(database);
    const secrets = new Secrets();
    assert.equal(await secrets.ready(), "locked");
    await assert.rejects(secrets.unlock({ password: "password" }), /Unsupported Secrets vault format version 1/u);
    await assert.rejects(secrets.listPasskeys(), /Unsupported Secrets vault format version 1/u);
    await assert.rejects(secrets.initialize({ password: "replacement" }), /already initialized/u);
    assert.deepEqual(database.records("metadata"), [legacy]);
    assert.equal(database.records("secrets").length, 1);
    assert.deepEqual(database.records("passkeys"), []);
});
