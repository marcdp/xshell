import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import contract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/secrets.json" with { type: "json" };
import commonSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import serviceSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/service.schema.json" with { type: "json" };
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Secrets from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/secrets.js";

const originalDescriptors = new Map();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

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
    const opens = [];
    let version = seed.version || 0;
    for (const [name, definition] of Object.entries(seed.stores || {})) {
        stores.set(name, {
            keyPath: definition.keyPath || "id",
            records: new Map((definition.records || []).map(record => [record[definition.keyPath || "id"], copy(record)])),
            indexes: new Map((definition.indexes || []).map(index => [index.name, { keyPath:index.keyPath, unique:index.unique === true }])),
            writeActive: false,
            writeQueue: [],
            failNextPut: false
        });
    }

    function schemaStore(definition) {
        return {
            indexNames: { contains(name) { return definition.indexes.has(name); } },
            createIndex(name, keyPath, options = {}) {
                if (options.unique) {
                    const values = new Set();
                    for (const record of definition.records.values()) {
                        const value = record[keyPath];
                        if (value === undefined) continue;
                        if (values.has(value)) throw new DOMException("Index value already exists.", "ConstraintError");
                        values.add(value);
                    }
                }
                definition.indexes.set(name, {keyPath, unique:options.unique === true});
            }
        };
    }

    function createTransaction(name, mode) {
        const definition = stores.get(name);
        if (!definition) throw new Error(`Missing object store ${name}.`);
        let before = null;
        let pending = 0;
        let completionQueued = false;
        let finished = false;
        let aborted = false;
        let active = mode !== "readwrite";
        let ownsWriteLock = false;
        const deferred = [];
        const releaseWriteLock = () => {
            if (!ownsWriteLock) return;
            ownsWriteLock = false;
            const next = definition.writeQueue.shift();
            if (next) queueMicrotask(next);
            else definition.writeActive = false;
        };
        const start = () => {
            if (finished || aborted) {
                const next = definition.writeQueue.shift();
                if (next) queueMicrotask(next);
                else definition.writeActive = false;
                return;
            }
            active = true;
            ownsWriteLock = true;
            before = new Map([...definition.records].map(([key, value]) => [key, copy(value)]));
            for (const operation of deferred.splice(0)) queueMicrotask(operation);
        };
        if (mode === "readwrite") {
            if (definition.writeActive) definition.writeQueue.push(start);
            else {
                definition.writeActive = true;
                start();
            }
        }
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
                    releaseWriteLock();
                    transaction.onabort?.();
                });
            },
            objectStore() {
                const operation = callback => {
                    if (finished || aborted) throw new Error("Transaction is inactive.");
                    pending++;
                    const request = { result: undefined, error: null, onsuccess: null, onerror: null };
                    const run = () => {
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
                                releaseWriteLock();
                                transaction.oncomplete?.();
                            });
                        }
                    };
                    if (active) queueMicrotask(run);
                    else deferred.push(run);
                    return request;
                };
                const keyFor = value => value[definition.keyPath];
                const checkUniqueIndexes = (value, key) => {
                    for (const index of definition.indexes.values()) {
                        if (!index.unique || value[index.keyPath] === undefined) continue;
                        if ([...definition.records].some(([existingKey, record]) => existingKey !== key && record[index.keyPath] === value[index.keyPath])) {
                            throw new DOMException("Index value already exists.", "ConstraintError");
                        }
                    }
                };
                return {
                    ...schemaStore(definition),
                    get(key) { return operation(() => copy(definition.records.get(key))); },
                    getAll() { return operation(() => [...definition.records.values()].map(copy)); },
                    getAllKeys() { return operation(() => [...definition.records.keys()]); },
                    add(value) {
                        return operation(() => {
                            const key = keyFor(value);
                            if (definition.records.has(key)) throw new DOMException("Key already exists.", "ConstraintError");
                            checkUniqueIndexes(value, key);
                            definition.records.set(key, copy(value));
                            return key;
                        });
                    },
                    put(value) {
                        return operation(() => {
                            if (definition.failNextPut) {
                                definition.failNextPut = false;
                                throw new Error("Injected put failure.");
                            }
                            const key = keyFor(value);
                            checkUniqueIndexes(value, key);
                            definition.records.set(key, copy(value));
                            return key;
                        });
                    },
                    delete(key) {
                        return operation(() => { definition.records.delete(key); });
                    },
                    index(name) {
                        const index = definition.indexes.get(name);
                        if (!index) throw new DOMException("Index not found.", "NotFoundError");
                        return {
                            get(value) {
                                return operation(() => copy([...definition.records.values()].find(record => record[index.keyPath] === value)));
                            }
                        };
                    }
                };
            }
        };
        return transaction;
    }

    const indexedDB = {
        open(name, requestedVersion) {
            opens.push({name, version:requestedVersion});
            const request = { result: null, transaction: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
            queueMicrotask(() => {
                const database = {
                    onversionchange: null,
                    objectStoreNames: { contains(name) { return stores.has(name); } },
                    createObjectStore(name, { keyPath }) {
                        if (!stores.has(name)) stores.set(name, { keyPath, records: new Map(), indexes: new Map(), writeActive: false, writeQueue: [], failNextPut: false });
                        return schemaStore(stores.get(name));
                    },
                    transaction(name, mode) { return createTransaction(name, mode); },
                    close() {}
                };
                request.result = database;
                if (requestedVersion > version) {
                    version = requestedVersion;
                    request.transaction = { objectStore(name) { return schemaStore(stores.get(name)); } };
                    request.onupgradeneeded?.();
                    request.transaction = null;
                }
                request.onsuccess?.();
            });
            return request;
        }
    };

    return {
        indexedDB,
        opens,
        records(name) {
            const definition = stores.get(name);
            return definition ? [...definition.records.values()].map(copy) : [];
        },
        deleteRecord(name, key) {
            stores.get(name)?.records.delete(key);
        },
        putRecord(name, value) {
            const definition = stores.get(name);
            definition.records.set(value[definition.keyPath], copy(value));
        },
        failNextPut(name) {
            stores.get(name).failNextPut = true;
        },
        hasIndex(name, index) {
            return stores.get(name)?.indexes.has(index) === true;
        }
    };
}

function createSessionStorage(seed = {}) {
    const values = new Map(Object.entries(seed));
    return {
        failSet: false,
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) {
            if (this.failSet) throw new DOMException("Storage blocked.", "SecurityError");
            values.set(key, String(value));
        },
        removeItem(key) { values.delete(key); },
        value(key) { return values.get(key) ?? null; }
    };
}

function secretsConfig(rememberMinutes = 0, maxRememberMinutes = 0, pageUnlock = null, pageManager = null) {
    return { xshell: { services: { secrets: { options: { pageUnlock, pageManager, rememberMinutes, maxRememberMinutes } } } } };
}

function createSecrets(config, dependencies = { config }) {
    return new Secrets(dependencies, config?.xshell?.services?.secrets?.options);
}

function installClock(initial) {
    const NativeDate = globalThis.Date;
    let now = initial;
    let nextId = 0;
    const timers = new Map();
    class FakeDate extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    setGlobal("Date", FakeDate);
    setGlobal("setTimeout", (callback, delay) => {
        const timer = { id: ++nextId, at: now + delay, callback, unref() {} };
        timers.set(timer.id, timer);
        return timer;
    });
    setGlobal("clearTimeout", timer => timers.delete(timer?.id ?? timer));
    return {
        advance(milliseconds) {
            now += milliseconds;
            for (const timer of [...timers.values()].filter(item => item.at <= now).sort((left, right) => left.at - right.at)) {
                timers.delete(timer.id);
                timer.callback();
            }
        },
        get now() { return now; }
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

function installEnvironment(database, webauthn = createWebAuthn(), storage = createSessionStorage()) {
    setGlobal("indexedDB", database.indexedDB);
    setGlobal("isSecureContext", true);
    setGlobal("navigator", { credentials: webauthn.credentialsContainer });
    setGlobal("sessionStorage", storage);
    webauthn.sessionStorage = storage;
    return webauthn;
}

test("Secrets V2 contract validates against the service contract schema", () => {
    const result = new JsonValidator().validate(contract, serviceSchema, { "./contract.schema.json": commonSchema });
    assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
    assert.deepEqual(Object.keys(contract.properties).filter(name => name === "options" || name === "page" || name === "rememberMinutes" || name === "maxRememberMinutes"), ["options"]);
    assert.deepEqual(contract.types.options.schema.required, ["rememberMinutes", "maxRememberMinutes", "pageUnlock", "pageManager"]);
    assert.equal(contract.types.options.schema.additionalProperties, false);
    assert.equal(contract.properties.options.readonly, true);
    assert.deepEqual(Object.keys(contract.events), ["secrets:changed", "secrets:status-changed"]);
    assert.deepEqual(contract.events["secrets:changed"].detail.kind.schema.enum, ["secret", "passkey"]);
    assert.deepEqual(contract.events["secrets:changed"].detail.action.schema.enum, ["saved", "removed"]);
});

test("Secrets Service options schema accepts normalized Pages and rejects obsolete or invalid options", () => {
    const validator = new JsonValidator();
    for (const page of [null, "page:x:/pages/preferences/secrets-unlock.js", "/_assets/x/pages/preferences/secrets-unlock.js", "https://example.test/pages/unlock.js"]) {
        assert.equal(validator.validate({pageUnlock:page, pageManager:page}, Secrets.optionsSchema).valid, true);
    }
    for (const options of [{page:"page:x:/pages/preferences/secrets-unlock.js"}, {pageUnlock:"page:"}, {pageManager:" "}, {rememberMinutes:-1}, {maxRememberMinutes:43201}]) {
        assert.equal(validator.validate(options, Secrets.optionsSchema).valid, false);
    }
});

test("Secrets V2 initializes a random-DEK vault and preserves JSON CRUD across password unlocks", async () => {
    const database = createIndexedDB();
    installEnvironment(database);
    const events = [];
    const secrets = new Secrets({ bus: { emit(name, detail) { events.push({ name, detail }); } } });

    assert.equal(await secrets.ready(), "uninitialized");
    assert.equal(database.hasIndex("secrets", "name"), true);
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
    const listed = await secrets.list();
    assert.deepEqual(listed.map(item => ({ name:item.name, label:item.label, description:item.description })), [
        { name: "structured", label:"structured", description: "" },
        { name: "text", label:"text", description: "" }
    ]);
    assert.ok(listed.every(item => UUID_PATTERN.test(item.id)));
    assert.equal(new Set(listed.map(item => item.id)).size, 2);
    assert.ok(listed.every(item => typeof item.createdAt === "string"));
    assert.ok(listed.every(item => item.modifiedAt === item.createdAt && item.revision === 1));
    assert.equal(await secrets.get("text"), "sensitive value");
    assert.deepEqual(await secrets.get("structured"), { enabled: true, values: [1, "two", null] });
    assert.equal(await secrets.get("missing"), undefined);

    const storedSecrets = database.records("secrets");
    assert.equal(storedSecrets.length, 2);
    assert.ok(storedSecrets.every(record => record.version === 2 && record.iv.byteLength === 12 && record.description.iv.byteLength === 12));
    assert.equal(storedSecrets.some(record => JSON.stringify(record).includes("sensitive value")), false);
    assert.notDeepEqual([...storedSecrets[0].iv], [...storedSecrets[1].iv]);

    secrets.lock();
    await assert.rejects(secrets.get("text"), /locked/u);
    const reopened = new Secrets({ bus: { emit(name, detail) { events.push({ name, detail }); } } });
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
    assert.deepEqual(events.filter(event => event.name === "secrets:changed"), [
        {name:"secrets:changed", detail:{kind:"secret", action:"saved"}},
        {name:"secrets:changed", detail:{kind:"secret", action:"saved"}},
        {name:"secrets:changed", detail:{kind:"secret", action:"removed"}}
    ]);
});

test("Secrets mutation notifications cannot turn committed writes into failures", async () => {
    // Preserve successful encrypted persistence when a mutation listener throws.
    const database = createIndexedDB();
    installEnvironment(database);
    const secrets = new Secrets({bus:{emit(name) { if (name === "secrets:changed") throw new Error("Listener failed."); }}});
    const originalError = console.error;
    console.error = () => {};
    try {
        await secrets.ready();
        await secrets.initialize({password:"master password"});
        await secrets.set("token", "value");
        assert.equal(await secrets.get("token"), "value");
        await secrets.delete("token");
        assert.equal(await secrets.has("token"), false);
    } finally {
        console.error = originalError;
    }
});

test("has checks exact Secret names without decrypting, unlocking, or authenticating", async () => {
    // Store one Secret, then verify boolean-only indexed lookup in every vault state.
    const database = createIndexedDB();
    installEnvironment(database);
    let dialogCalls = 0;
    const config = secretsConfig(0, 0, "page:x:/pages/preferences/secrets-unlock.js");
    const secrets = createSecrets(config, {config, dialog:{async open() { dialogCalls++; throw new Error("must not authenticate"); }}});

    assert.equal(await secrets.has("stored"), false);
    assert.equal(secrets.status, "uninitialized");
    await secrets.initialize({password:"master password"});
    await secrets.set("stored", {token:"private-value"});
    assert.strictEqual(await secrets.has("stored"), true);
    assert.strictEqual(await secrets.has("missing"), false);

    secrets.lock();
    assert.strictEqual(await secrets.has("stored"), true);
    assert.strictEqual(await secrets.has("missing"), false);
    assert.equal(secrets.status, "locked");
    assert.equal(dialogCalls, 0);
    await assert.rejects(() => secrets.has(" "), /Secret name must be a non-empty string/u);
    await assert.rejects(() => secrets.has(null), /Secret name must be a non-empty string/u);
    assert.equal(dialogCalls, 0);
});

test("Secrets namespaces independent databases by normalized application base path", async () => {
    // The configured hosting prefix selects storage without changing the schema or Service API.
    const cases = [
        ["", "xshell-secrets"],
        ["/admin", "admin-xshell-secrets"],
        ["/admin/", "admin-xshell-secrets"],
        ["/company/admin/", "company-admin-xshell-secrets"],
        ["/encoded%20path/", "encoded%2520path-xshell-secrets"]
    ];
    for (const [basePath, name] of cases) {
        const database = createIndexedDB();
        installEnvironment(database);
        const secrets = new Secrets({config:{app:{basePath}}});
        assert.equal(await secrets.ready(), "uninitialized");
        assert.deepEqual(database.opens, [{name, version:1}]);
        assert.equal(database.hasIndex("secrets", "name"), true);
    }
    assert.notEqual(cases[1][1], cases[3][1]);
});

test("get transparently shares one configured authentication dialog and resumes each caller", async () => {
    const database = createIndexedDB();
    installEnvironment(database);
    const config = secretsConfig(0, 0, "page:x:/pages/preferences/secrets-unlock.js", "page:x:/pages/preferences/secrets.js");
    let secrets;
    const calls = [];
    const dialog = {
        async open(options) {
            calls.push(options);
            await secrets.unlock({password:"master password"});
            return {unlocked:true};
        }
    };
    secrets = createSecrets(config, {config, dialog});
    assert.equal(secrets.options.pageManager, "page:x:/pages/preferences/secrets.js");
    await secrets.ready();
    await secrets.initialize({password:"master password"});
    await secrets.set("first", "one");
    await secrets.set("second", "two");
    assert.equal(await secrets.get("first"), "one");
    assert.deepEqual(calls, []);
    secrets.lock();

    assert.deepEqual(await Promise.all([secrets.get("first"), secrets.get("second")]), ["one", "two"]);
    assert.deepEqual(calls, [{href:"page:x:/pages/preferences/secrets-unlock.js", context:{}}]);
});

test("get distinguishes authentication cancellation, retries later, and honors non-interactive policy", async () => {
    const database = createIndexedDB();
    installEnvironment(database);
    const config = secretsConfig(0, 0, "page:x:/pages/preferences/secrets-unlock.js");
    let opens = 0;
    const secrets = createSecrets(config, {config, dialog:{async open() { opens++; return null; }}});
    await secrets.ready();
    await secrets.initialize({password:"master password"});
    await secrets.set("token", "value");
    secrets.lock();

    const cancelled = await Promise.allSettled([secrets.get("token"), secrets.get("token")]);
    assert.equal(opens, 1);
    assert.ok(cancelled.every(result => result.status === "rejected" && result.reason.name === "AbortError"));
    await assert.rejects(secrets.get("token"), error => error.name === "AbortError");
    assert.equal(opens, 2, "a later request starts a fresh authentication attempt");
    await assert.rejects(secrets.get("token", {interactive:false}), /locked/u);
    assert.equal(opens, 2);

    const disabled = createSecrets(secretsConfig(), {dialog:{async open() { throw new Error("must not open"); }}});
    assert.equal(await disabled.ready(), "locked");
    await assert.rejects(disabled.get("token"), /locked/u);
});

test("get supports dialog initialization without creating a missing secret and preserves dialog load failures", async () => {
    const database = createIndexedDB();
    installEnvironment(database);
    const config = secretsConfig(0, 0, "page:x:/pages/preferences/secrets-unlock.js");
    let secrets;
    let received;
    secrets = createSecrets(config, {config, dialog:{async open(options) {
        received = options;
        await secrets.initialize({password:"master password"});
        return {unlocked:true};
    }}});
    assert.equal(await secrets.get("missing"), undefined);
    assert.deepEqual(received.context, {});
    assert.equal(JSON.stringify(received).includes("master password"), false);

    secrets.lock();
    const failure = new Error("Authentication Page could not be loaded.");
    const failing = createSecrets(config, {config, dialog:{async open() { throw failure; }}});
    assert.equal(await failing.ready(), "locked");
    await assert.rejects(failing.get("missing"), error => error === failure);
});

test("secret metadata tracks timestamps, revisions, and encrypted descriptions", async () => {
    const database = createIndexedDB();
    installEnvironment(database);
    const secrets = new Secrets();
    await secrets.ready();
    await secrets.initialize({ password: "master password" });

    const NativeDate = Date;
    let now = Date.parse("2026-11-17T10:00:00.000Z");
    class ControlledDate extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    setGlobal("Date", ControlledDate);

    await secrets.set("api-token", "first", { label:"Production token", description: "Production API token" });
    const originalInfo = await secrets.getInfo("api-token");
    const originalRecord = database.records("secrets")[0];
    assert.deepEqual(originalInfo, {
        id:originalRecord.id,
        name:"api-token",
        label:"Production token",
        description:"Production API token",
        createdAt:"2026-11-17T10:00:00.000Z",
        modifiedAt:"2026-11-17T10:00:00.000Z",
        revision:1
    });
    assert.match(originalInfo.id, UUID_PATTERN);
    assert.equal(await secrets.get("api-token"), "first", "get() continues to return only the decrypted value");
    assert.equal(JSON.stringify(originalRecord).includes("Production API token"), false);
    assert.equal(JSON.stringify(originalRecord).includes("Production token"), false);
    assert.deepEqual(Object.keys(originalRecord).sort(), ["ciphertext", "createdAt", "description", "id", "iv", "label", "modifiedAt", "name", "revision", "version"]);

    now = Date.parse("2026-11-17T10:05:00.000Z");
    await secrets.set("api-token", "first");
    const preservedRecord = database.records("secrets")[0];
    assert.deepEqual(preservedRecord.description, originalRecord.description, "omitted descriptions are not re-encrypted");
    assert.deepEqual(await secrets.getInfo("api-token"), {
        ...originalInfo,
        modifiedAt:"2026-11-17T10:05:00.000Z",
        revision:2
    });

    now = Date.parse("2026-11-17T10:10:00.000Z");
    await secrets.set("api-token", "first", { description: "Rotated token" });
    assert.deepEqual(await secrets.getInfo("api-token"), {
        ...originalInfo,
        description:"Rotated token",
        modifiedAt:"2026-11-17T10:10:00.000Z",
        revision:3
    });
    assert.deepEqual(await secrets.list(), [await secrets.getInfo("api-token")]);

    database.failNextPut("secrets");
    await assert.rejects(secrets.set("api-token", "failed update"), /Injected put failure/u);
    assert.equal((await secrets.getInfo("api-token")).revision, 3, "a failed write does not persist a revision increment");
    assert.equal(await secrets.get("api-token"), "first");

    const invalid = database.records("secrets")[0];
    for (const revision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        database.putRecord("secrets", {...invalid, revision});
        await assert.rejects(secrets.getInfo("api-token"), /positive safe integer/u);
        await assert.rejects(secrets.set("api-token", "invalid revision update"), /positive safe integer/u);
        assert.equal(database.records("secrets")[0].revision, revision);
    }
    database.putRecord("secrets", {...invalid, revision:Number.MAX_SAFE_INTEGER});
    await assert.rejects(secrets.set("api-token", "overflow update"), /maximum safe integer/u);
    assert.equal(database.records("secrets")[0].revision, Number.MAX_SAFE_INTEGER);

    await secrets.delete("api-token");
    now = Date.parse("2026-11-17T10:20:00.000Z");
    await secrets.set("api-token", "recreated");
    const recreated = await secrets.getInfo("api-token");
    assert.deepEqual(recreated, {
        id:recreated.id,
        name:"api-token",
        label:"api-token",
        description:"",
        createdAt:"2026-11-17T10:20:00.000Z",
        modifiedAt:"2026-11-17T10:20:00.000Z",
        revision:1
    });
    assert.match(recreated.id, UUID_PATTERN);
    assert.notEqual(recreated.id, originalInfo.id);
});

test("concurrent secret updates serialize revision increments", async () => {
    const database = createIndexedDB();
    installEnvironment(database);
    const secrets = new Secrets();
    await secrets.ready();
    await secrets.initialize({ password: "master password" });
    await secrets.set("api-token", "first");

    await Promise.all([
        secrets.set("api-token", "second"),
        secrets.set("api-token", "third"),
        secrets.set("api-token", "fourth")
    ]);

    assert.equal((await secrets.getInfo("api-token")).revision, 4);
    assert.equal(database.records("secrets")[0].revision, 4);
});

test("secret names, labels, and renaming preserve immutable encrypted identities", async () => {
    const database = createIndexedDB();
    installEnvironment(database);
    const secrets = new Secrets();
    await secrets.ready();
    await secrets.initialize({ password:"master password" });

    const NativeDate = Date;
    let now = Date.parse("2026-11-17T11:00:00.000Z");
    class ControlledDate extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    setGlobal("Date", ControlledDate);

    await secrets.set("token", "value", {description:"Primary token"});
    const created = await secrets.getInfo("token");
    assert.match(created.id, UUID_PATTERN);
    assert.equal(created.label, "token");

    now += 60_000;
    await secrets.set("token", "value", {label:"Readable token"});
    assert.equal((await secrets.getInfo("token")).id, created.id);
    now += 60_000;
    await secrets.set("token", "value");
    assert.equal((await secrets.getInfo("token")).label, "Readable token");
    now += 60_000;
    await secrets.set("token", "value", {label:""});
    assert.equal((await secrets.getInfo("token")).label, "token");

    const beforeRename = database.records("secrets").find(record => record.id === created.id);
    now += 60_000;
    await secrets.rename("token", "Token");
    const renamed = await secrets.getInfo("Token");
    const afterRename = database.records("secrets").find(record => record.id === created.id);
    assert.equal(renamed.id, created.id);
    assert.equal(renamed.name, "Token");
    assert.equal(renamed.label, "Token");
    assert.equal(renamed.createdAt, created.createdAt);
    assert.equal(renamed.modifiedAt, "2026-11-17T11:04:00.000Z");
    assert.equal(renamed.revision, 5);
    assert.equal(await secrets.get("Token"), "value");
    assert.equal(await secrets.get("token"), undefined);
    assert.deepEqual(afterRename.iv, beforeRename.iv);
    assert.deepEqual(afterRename.ciphertext, beforeRename.ciphertext);
    assert.deepEqual(afterRename.description, beforeRename.description);

    const noOp = await secrets.getInfo("Token");
    await secrets.rename("Token", "Token");
    assert.deepEqual(await secrets.getInfo("Token"), noOp);

    await secrets.set("second", "two", {label:"Shared"});
    await secrets.set("third", "three", {label:"Shared"});
    const secondId = (await secrets.getInfo("second")).id;
    await secrets.rename("second", "second-prod");
    assert.equal((await secrets.getInfo("second-prod")).id, secondId);
    assert.equal((await secrets.getInfo("second-prod")).label, "Shared");
    await assert.rejects(secrets.rename("second-prod", "third"), /already exists/u);
    assert.equal((await secrets.getInfo("second-prod")).id, secondId);
    assert.equal(await secrets.get("third"), "three");

    await secrets.set("case", "lower");
    await secrets.set("Case", "upper");
    assert.equal(await secrets.get("case"), "lower");
    assert.equal(await secrets.get("Case"), "upper");
    await assert.rejects(secrets.set("   ", "invalid"), /name must be a non-empty string/u);
    await assert.rejects(secrets.get(""), /name must be a non-empty string/u);
    await assert.rejects(secrets.rename("Case", "  "), /name must be a non-empty string/u);
    await assert.rejects(secrets.set("managed", "value", {id:"caller-id"}), /unknown property/u);
});

test("concurrent creation uses one unique name and monotonic revisions", async () => {
    const database = createIndexedDB();
    installEnvironment(database);
    const secrets = new Secrets();
    await secrets.ready();
    await secrets.initialize({ password:"master password" });

    await Promise.all([
        secrets.set("shared", "first"),
        secrets.set("shared", "second"),
        secrets.set("shared", "third")
    ]);

    const matches = (await secrets.list()).filter(item => item.name === "shared");
    assert.equal(matches.length, 1);
    assert.match(matches[0].id, UUID_PATTERN);
    assert.equal(matches[0].revision, 3);
});

test("multiple PRF passkeys wrap the same DEK without re-encrypting secrets", async () => {
    const database = createIndexedDB();
    const webauthn = installEnvironment(database, createWebAuthn());
    const events = [];
    const secrets = new Secrets({bus:{emit(name, detail) { events.push({name, detail}); }}});
    await secrets.ready();
    await secrets.initialize({ password: "master password" });
    await secrets.set("token", { value: "unchanged" });
    const encryptedSecret = database.records("secrets")[0];

    const laptop = await secrets.addPasskey({ label: "Laptop", password: "master password", description: "Work computer" });
    const phone = await secrets.addPasskey({ label: "Phone", password: "master password" });
    assert.equal(webauthn.calls.create.length, 2);
    assert.equal(webauthn.calls.get.length, 2, "registration without PRF output must obtain an assertion");
    assert.deepEqual(await secrets.listPasskeys(), [
        { id: laptop.id, label: "Laptop", description: "Work computer", createdAt: laptop.createdAt },
        { id: phone.id, label: "Phone", description: "", createdAt: phone.createdAt }
    ]);
    assert.deepEqual(database.records("secrets")[0], encryptedSecret);

    const registrations = database.records("passkeys");
    assert.equal(registrations.length, 2);
    assert.notDeepEqual([...registrations[0].prfSalt], [...registrations[1].prfSalt]);
    assert.notDeepEqual([...new Uint8Array(registrations[0].wrappedDek.ciphertext)],
        [...new Uint8Array(registrations[1].wrappedDek.ciphertext)]);
    assert.deepEqual(Object.keys(registrations[0]).sort(), ["createdAt", "description", "id", "label", "prfSalt", "version", "wrappedDek"]);

    const laptopRegistration = registrations[0];
    await secrets.updatePasskey(laptop.id, { description: "Primary workstation" });
    const updatedLaptop = database.records("passkeys").find(item => item.id === laptop.id);
    assert.deepEqual(updatedLaptop, { ...laptopRegistration, description:"Primary workstation" });
    assert.equal((await secrets.listPasskeys()).find(item => item.id === laptop.id).description, "Primary workstation");
    const legacyPhone = database.records("passkeys").find(item => item.id === phone.id);
    delete legacyPhone.description;
    database.putRecord("passkeys", legacyPhone);
    assert.equal((await secrets.listPasskeys()).find(item => item.id === phone.id).description, "");

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
    assert.deepEqual(events.filter(event => event.name === "secrets:changed" && event.detail.kind === "passkey"), [
        {name:"secrets:changed", detail:{kind:"passkey", action:"saved"}},
        {name:"secrets:changed", detail:{kind:"passkey", action:"saved"}},
        {name:"secrets:changed", detail:{kind:"passkey", action:"saved"}},
        {name:"secrets:changed", detail:{kind:"passkey", action:"removed"}}
    ]);
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
        randomUUID() { return nativeCrypto.randomUUID(); },
        getRandomValues(value) { return nativeCrypto.getRandomValues(value); }
    });

    const writing = secrets.set("late", "must not persist");
    await started;
    secrets.lock();
    releaseEncryption();
    await assert.rejects(writing, /locked during the operation/u);
    assert.equal(database.records("secrets").some(record => record.id === "late"), false);
});

test("locking during an in-flight get never returns the decrypted value", async () => {
    const database = createIndexedDB();
    installEnvironment(database);
    const secrets = new Secrets();
    await secrets.ready();
    await secrets.initialize({password:"master password"});
    await secrets.set("token", "must not return");

    const nativeCrypto = globalThis.crypto;
    let releaseDecryption;
    let decryptionStarted;
    const started = new Promise(resolve => { decryptionStarted = resolve; });
    const gate = new Promise(resolve => { releaseDecryption = resolve; });
    const subtle = new Proxy(nativeCrypto.subtle, {
        get(target, property) {
            if (property === "decrypt") {
                return async (...args) => {
                    decryptionStarted();
                    await gate;
                    return target.decrypt(...args);
                };
            }
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
        }
    });
    setGlobal("crypto", {subtle, randomUUID() { return nativeCrypto.randomUUID(); }, getRandomValues(value) { return nativeCrypto.getRandomValues(value); }});

    const reading = secrets.get("token");
    await started;
    secrets.lock();
    releaseDecryption();
    await assert.rejects(reading, /locked during the operation/u);
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

test("remembered-session policy defaults to memory-only and validates durations", async () => {
    const database = createIndexedDB();
    const { sessionStorage } = installEnvironment(database);
    const secrets = new Secrets();
    await secrets.ready();
    await secrets.initialize({ password: "master password" });
    secrets.lock();
    await secrets.unlock({ password: "master password" });
    assert.equal(secrets.sessionExpiresAt, null);
    assert.equal(sessionStorage.value("xshell-secrets:session:v1"), null);
    assert.deepEqual(database.records("sessions"), []);

    assert.throws(() => createSecrets(secretsConfig(15, 0)), /cannot exceed/u);
    assert.throws(() => createSecrets(secretsConfig(-1, 60)), /integer from 0/u);
    assert.throws(() => createSecrets(secretsConfig(0, 1.5)), /integer from 0/u);
    assert.throws(() => createSecrets(secretsConfig(0, 43201)), /integer from 0/u);
    assert.throws(() => createSecrets(secretsConfig(0, 0, "page:")), /Page resource reference/u);
    assert.throws(() => createSecrets(secretsConfig(0, 0, " ")), /Page resource reference/u);
    assert.throws(() => createSecrets(secretsConfig(0, 0, null, "page:")), /Page resource reference/u);
    assert.throws(() => new Secrets({}, {page:null}), /unknown option/u);

    const configuredOptions = {rememberMinutes:15, maxRememberMinutes:60, pageUnlock:"/_assets/x/pages/preferences/secrets-unlock.js", pageManager:"page:x:/pages/preferences/secrets.js"};
    const configured = new Secrets({}, configuredOptions);
    assert.deepEqual(configured.options, configuredOptions);
    assert.equal(Object.isFrozen(configured.options), true);
    configuredOptions.rememberMinutes = 30;
    assert.equal(configured.options.rememberMinutes, 15);
    assert.throws(() => { configured.options.pageManager = null; }, TypeError);
    assert.deepEqual(new Secrets().options, {rememberMinutes:0, maxRememberMinutes:0, pageUnlock:null, pageManager:null});

    const configurable = createSecrets(secretsConfig(15, 60));
    await configurable.ready();
    await assert.rejects(configurable.unlock({ password: "master password", rememberMinutes: -1 }), /nonnegative integer/u);
    await assert.rejects(configurable.unlock({ password: "master password", rememberMinutes: 1.5 }), /nonnegative integer/u);
    await assert.rejects(configurable.unlock({ password: "master password", rememberMinutes: "15" }), /nonnegative integer/u);
    await assert.rejects(configurable.unlock({ password: "master password", rememberMinutes: 61 }), /cannot exceed 60/u);
});

test("password unlock persists a non-extractable session key and restores without authentication", async () => {
    const database = createIndexedDB();
    const environment = installEnvironment(database);
    const config = secretsConfig(15, 60);
    const secrets = createSecrets(config);
    await secrets.ready();
    await secrets.initialize({ password: "master password" });
    await secrets.set("token", "remembered");
    secrets.lock();
    const waiting = createSecrets(config);
    assert.equal(await waiting.ready(), "locked");
    await secrets.unlock({ password: "master password" });

    assert.match(secrets.sessionExpiresAt, /Z$/u);
    const session = JSON.parse(environment.sessionStorage.value("xshell-secrets:session:v1"));
    const [stored] = database.records("sessions");
    assert.equal(stored.id, session.sessionId);
    assert.deepEqual(Object.keys(stored).sort(), ["id", "key"]);
    assert.equal(stored.key.extractable, false);
    assert.equal(stored.key.algorithm.name, "AES-GCM");
    assert.deepEqual(stored.key.usages.sort(), ["decrypt", "encrypt"]);
    assert.equal(Object.hasOwn(session, "password"), false);
    assert.deepEqual(Object.keys(session).sort(), ["createdAt", "expiresAt", "sessionId", "vaultId", "version", "wrappedDek"]);
    assert.deepEqual(await waiting.restoreSession(), {
        restored: true,
        status: "unlocked",
        sessionExpiresAt: secrets.sessionExpiresAt
    });

    const nativeCrypto = globalThis.crypto;
    const subtle = new Proxy(nativeCrypto.subtle, {
        get(target, property) {
            if (property === "deriveKey") return async () => { throw new Error("PBKDF2 or HKDF must not run during restoration."); };
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
        }
    });
    setGlobal("crypto", { subtle, randomUUID() { return nativeCrypto.randomUUID(); }, getRandomValues(value) { return nativeCrypto.getRandomValues(value); } });
    setGlobal("navigator", { credentials: { async get() { throw new Error("WebAuthn must not run during restoration."); } } });
    const restored = createSecrets(config, {config, dialog:{async open() { throw new Error("restored access must not open a dialog"); }}});
    assert.equal(await restored.ready(), "unlocked");
    assert.equal(await restored.get("token"), "remembered");
    assert.deepEqual(await restored.restoreSession(), {
        restored: false,
        status: "unlocked",
        sessionExpiresAt: restored.sessionExpiresAt,
        reason: "already-unlocked"
    });
});

test("passkey unlock can create a remembered session", async () => {
    const database = createIndexedDB();
    const webauthn = installEnvironment(database, createWebAuthn());
    const config = secretsConfig(0, 60);
    const secrets = createSecrets(config);
    await secrets.ready();
    await secrets.initialize({ password: "master password" });
    const registration = await secrets.addPasskey({ label: "Laptop", password: "master password" });
    secrets.lock();
    await secrets.unlockWithPasskey({ id: registration.id, rememberMinutes: 60 });
    assert.match(secrets.sessionExpiresAt, /Z$/u);
    assert.equal(webauthn.calls.get.length, 2);
    const restored = createSecrets(config);
    assert.equal(await restored.ready(), "unlocked");
    assert.equal(webauthn.calls.get.length, 2, "restoration must not invoke WebAuthn");
});

test("remembered sessions retain an absolute expiration across reloads and expire while active", async () => {
    const clock = installClock(Date.parse("2026-01-01T00:00:00.000Z"));
    const database = createIndexedDB();
    const environment = installEnvironment(database);
    const config = secretsConfig(0, 60);
    const secrets = createSecrets(config);
    await secrets.ready();
    await secrets.initialize({ password: "master password" });
    await secrets.set("token", "value");
    secrets.lock();
    await secrets.unlock({ password: "master password", rememberMinutes: 15 });
    const expiration = secrets.sessionExpiresAt;

    clock.advance(14 * 60_000);
    const restored = createSecrets(config);
    assert.equal(await restored.ready(), "unlocked");
    assert.equal(restored.sessionExpiresAt, expiration);
    assert.equal(await restored.get("token"), "value");

    clock.advance(60_000);
    assert.equal(secrets.status, "locked");
    assert.equal(restored.status, "locked");
    assert.equal(environment.sessionStorage.value("xshell-secrets:session:v1"), null);
    await assert.rejects(restored.get("token"), /locked/u);
    const afterExpiration = createSecrets(config);
    assert.equal(await afterExpiration.ready(), "locked");
});

test("explicit lock revokes remembered access and a memory-only unlock removes stale session material", async () => {
    const database = createIndexedDB();
    const environment = installEnvironment(database);
    const config = secretsConfig(0, 60);
    const secrets = createSecrets(config);
    await secrets.ready();
    await secrets.initialize({ password: "master password" });
    secrets.lock();
    await secrets.unlock({ password: "master password", rememberMinutes: 15 });
    assert.notEqual(environment.sessionStorage.value("xshell-secrets:session:v1"), null);
    secrets.lock();
    secrets.lock();
    assert.equal(environment.sessionStorage.value("xshell-secrets:session:v1"), null);
    assert.equal(secrets.sessionExpiresAt, null);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(database.records("sessions"), []);
    assert.equal(await createSecrets(config).ready(), "locked");

    await secrets.unlock({ password: "master password", rememberMinutes: 15 });
    await secrets.unlock({ password: "master password", rememberMinutes: 0 });
    assert.equal(secrets.status, "unlocked");
    assert.equal(secrets.sessionExpiresAt, null);
    assert.equal(environment.sessionStorage.value("xshell-secrets:session:v1"), null);
    assert.equal(await createSecrets(config).ready(), "locked");
});

test("remembering fails closed when session storage is unavailable or persistence is interrupted", async () => {
    const database = createIndexedDB();
    const environment = installEnvironment(database);
    const config = secretsConfig(0, 60);
    const secrets = createSecrets(config);
    await secrets.ready();
    await secrets.initialize({ password: "master password" });
    secrets.lock();

    setGlobal("sessionStorage", undefined);
    await assert.rejects(secrets.unlock({ password: "master password", rememberMinutes: 15 }), /require sessionStorage/u);
    assert.equal(secrets.status, "locked");
    assert.deepEqual(database.records("sessions"), []);

    setGlobal("sessionStorage", environment.sessionStorage);
    environment.sessionStorage.failSet = true;
    await assert.rejects(secrets.unlock({ password: "master password", rememberMinutes: 15 }), /could not be persisted/u);
    assert.equal(secrets.status, "locked");
    assert.deepEqual(database.records("sessions"), []);
});

test("damaged remembered material, tampered metadata, and vault mismatches are discarded", async () => {
    async function remembered() {
        const database = createIndexedDB();
        const environment = installEnvironment(database);
        const config = secretsConfig(0, 60);
        const secrets = createSecrets(config);
        await secrets.ready();
        await secrets.initialize({ password: "master password" });
        secrets.lock();
        await secrets.unlock({ password: "master password", rememberMinutes: 60 });
        return { database, environment, config };
    }

    {
        const { database, environment, config } = await remembered();
        const record = JSON.parse(environment.sessionStorage.value("xshell-secrets:session:v1"));
        database.deleteRecord("sessions", record.sessionId);
        assert.equal(await createSecrets(config).ready(), "locked");
        assert.equal(environment.sessionStorage.value("xshell-secrets:session:v1"), null);
    }
    {
        const { environment, config } = await remembered();
        const record = JSON.parse(environment.sessionStorage.value("xshell-secrets:session:v1"));
        record.wrappedDek.ciphertext = record.wrappedDek.ciphertext.slice(0, -2) + "aa";
        environment.sessionStorage.setItem("xshell-secrets:session:v1", JSON.stringify(record));
        assert.equal(await createSecrets(config).ready(), "locked");
    }
    {
        const { environment, config } = await remembered();
        const record = JSON.parse(environment.sessionStorage.value("xshell-secrets:session:v1"));
        record.expiresAt = new Date(Date.parse(record.expiresAt) - 60_000).toISOString();
        environment.sessionStorage.setItem("xshell-secrets:session:v1", JSON.stringify(record));
        assert.equal(await createSecrets(config).ready(), "locked");
    }
    {
        const { environment, config } = await remembered();
        const record = JSON.parse(environment.sessionStorage.value("xshell-secrets:session:v1"));
        record.vaultId = "different-vault";
        environment.sessionStorage.setItem("xshell-secrets:session:v1", JSON.stringify(record));
        assert.equal(await createSecrets(config).ready(), "locked");
    }
});

test("restoration enforces a more restrictive application policy", async () => {
    const database = createIndexedDB();
    const environment = installEnvironment(database);
    const secrets = createSecrets(secretsConfig(0, 60));
    await secrets.ready();
    await secrets.initialize({ password: "master password" });
    secrets.lock();
    await secrets.unlock({ password: "master password", rememberMinutes: 60 });
    assert.equal(await createSecrets(secretsConfig(0, 15)).ready(), "locked");
    assert.equal(environment.sessionStorage.value("xshell-secrets:session:v1"), null);
    await secrets.unlock({ password: "master password", rememberMinutes: 60 });
    assert.equal(await createSecrets(secretsConfig(0, 0)).ready(), "locked");
    assert.equal(environment.sessionStorage.value("xshell-secrets:session:v1"), null);
});

test("locking during asynchronous restoration cannot reactivate the vault", async () => {
    const database = createIndexedDB();
    installEnvironment(database);
    const config = secretsConfig(0, 60);
    const secrets = createSecrets(config);
    await secrets.ready();
    await secrets.initialize({ password: "master password" });
    secrets.lock();
    await secrets.unlock({ password: "master password", rememberMinutes: 60 });

    const nativeCrypto = globalThis.crypto;
    let releaseDecryption;
    let decryptionStarted;
    const started = new Promise(resolve => { decryptionStarted = resolve; });
    const gate = new Promise(resolve => { releaseDecryption = resolve; });
    const subtle = new Proxy(nativeCrypto.subtle, {
        get(target, property) {
            if (property === "decrypt") return async (...args) => { decryptionStarted(); await gate; return target.decrypt(...args); };
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
        }
    });
    setGlobal("crypto", { subtle, randomUUID() { return nativeCrypto.randomUUID(); }, getRandomValues(value) { return nativeCrypto.getRandomValues(value); } });
    const restoring = createSecrets(config);
    const ready = restoring.ready();
    await started;
    restoring.lock();
    releaseDecryption();
    assert.equal(await ready, "locked");
    assert.equal(restoring.status, "locked");
});

test("an explicit unlock supersedes a concurrent restoration attempt", async () => {
    const database = createIndexedDB();
    installEnvironment(database);
    const config = secretsConfig(0, 60);
    const source = createSecrets(config);
    await source.ready();
    await source.initialize({ password: "master password" });
    source.lock();

    const target = createSecrets(config);
    assert.equal(await target.ready(), "locked");
    await source.unlock({ password: "master password", rememberMinutes: 60 });

    const nativeCrypto = globalThis.crypto;
    let releaseDecryption;
    let decryptionStarted;
    let gated = false;
    const started = new Promise(resolve => { decryptionStarted = resolve; });
    const gate = new Promise(resolve => { releaseDecryption = resolve; });
    const subtle = new Proxy(nativeCrypto.subtle, {
        get(target, property) {
            if (property === "decrypt") return async (...args) => {
                if (!gated) { gated = true; decryptionStarted(); await gate; }
                return target.decrypt(...args);
            };
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
        }
    });
    setGlobal("crypto", { subtle, randomUUID() { return nativeCrypto.randomUUID(); }, getRandomValues(value) { return nativeCrypto.getRandomValues(value); } });
    const restoring = target.restoreSession();
    await started;
    const unlocking = target.unlock({ password: "master password", rememberMinutes: 0 });
    await unlocking;
    releaseDecryption();
    assert.equal((await restoring).reason, "interrupted");
    assert.equal(target.status, "unlocked");
    assert.equal(target.sessionExpiresAt, null);
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
