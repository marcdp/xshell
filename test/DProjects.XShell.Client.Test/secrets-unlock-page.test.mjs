import assert from "node:assert/strict";
import test from "node:test";

import SecretsUnlockPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/preferences/secrets-unlock.js";

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return {promise, resolve, reject};
}

function createPage({status = "locked", rememberMinutes = 0, maxRememberMinutes = 0} = {}) {
    // Create lightweight service and Page doubles while retaining observable lifecycle calls.
    const state = structuredClone(SecretsUnlockPage.state);
    const calls = {get:0, initialize:[], addPasskey:[], unlock:[], unlockWithPasskey:[], close:[], lock:0};
    const secrets = {
        status,
        options: {rememberMinutes, maxRememberMinutes, pageUnlock:null, pageManager:null},
        async ready() { return this.status; },
        async listPasskeys() {
            return this.status == "uninitialized" ? [] : [{id:"passkey", label:"Laptop", description:"", createdAt:"2026-01-01T00:00:00.000Z"}];
        },
        async get() { calls.get++; throw new Error("authentication Page must not call get()"); },
        async initialize(options) { calls.initialize.push(options); this.status = "unlocked"; },
        async addPasskey(options) { calls.addPasskey.push(options); },
        async unlock(options) { calls.unlock.push(options); this.status = "unlocked"; },
        async unlockWithPasskey(options) { calls.unlockWithPasskey.push(options); this.status = "unlocked"; },
        lock() { calls.lock++; this.status = "locked"; }
    };
    const controller = SecretsUnlockPage.controller({
        state,
        secrets,
        page:{async close(result) { calls.close.push(result); }},
        bus:{},
        events:{on() {}}
    });
    return {state, secrets, calls, controller};
}

async function withWebAuthn(callback, {create = true, get = true} = {}) {
    // Install only the browser capabilities relevant to Page feature detection.
    const originalSecureContext = Object.getOwnPropertyDescriptor(globalThis, "isSecureContext");
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const credentials = {};
    if (create) credentials.create = async () => {};
    if (get) credentials.get = async () => {};
    Object.defineProperty(globalThis, "isSecureContext", {configurable:true, value:true});
    Object.defineProperty(globalThis, "navigator", {configurable:true, value:{credentials}});
    try { await callback(); }
    finally {
        if (originalSecureContext) Object.defineProperty(globalThis, "isSecureContext", originalSecureContext);
        else delete globalThis.isSecureContext;
        if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
        else delete globalThis.navigator;
    }
}

async function loadInitializationPage(options = {}) {
    const page = createPage({status:"uninitialized", ...options});
    await page.controller.load();
    page.state.password = "master password";
    page.state.confirmPassword = "master password";
    return page;
}

test("Secrets authentication Page validates initialization input and selected duration", async () => {
    const page = createPage({status:"uninitialized", rememberMinutes:30, maxRememberMinutes:480});
    await page.controller.load();
    assert.deepEqual(page.state.rememberOptions, [
        {value:"0", label:"Do not keep unlocked"},
        {value:"15", label:"15 minutes"},
        {value:"30", label:"30 minutes"},
        {value:"480", label:"8 hours"}
    ]);

    await page.controller.initialize();
    assert.equal(page.state.error, "Enter a master password.");
    page.state.password = "one";
    page.state.confirmPassword = "two";
    await page.controller.initialize();
    assert.equal(page.state.error, "Passwords do not match.");
    page.state.confirmPassword = "one";
    page.state.rememberMinutes = "60";
    await page.controller.initialize();
    assert.equal(page.state.error, "Select a valid session duration.");
    assert.deepEqual(page.calls.initialize, []);
});

test("Secrets authentication Page initializes memory-only without a second password derivation", async () => {
    await withWebAuthn(async () => {
        const page = await loadInitializationPage();
        page.state.createPasskey = false;
        await page.controller.initialize();

        assert.deepEqual(page.calls.initialize, [{password:"master password"}]);
        assert.deepEqual(page.calls.unlock, []);
        assert.deepEqual(page.calls.addPasskey, []);
        assert.equal(page.secrets.status, "unlocked");
        assert.deepEqual(page.calls.close, [{unlocked:true}]);
        assert.equal(page.state.password, "");
        assert.equal(page.state.confirmPassword, "");
        assert.equal(page.calls.get, 0);
    });
});

test("Secrets authentication Page establishes the selected remembered session before closing", async () => {
    const page = await loadInitializationPage({rememberMinutes:15, maxRememberMinutes:60});
    page.state.createPasskey = false;
    page.secrets.initialize = async options => {
        page.calls.initialize.push(options);
        page.secrets.status = "unlocked";
        await page.controller.onStatusChanged();
    };
    await page.controller.initialize();

    assert.deepEqual(page.calls.initialize, [{password:"master password"}]);
    assert.deepEqual(page.calls.unlock, [{password:"master password", rememberMinutes:15}]);
    assert.equal(page.state.status, "unlocked");
    assert.deepEqual(page.calls.close, [{unlocked:true}], "the initialization status event must not close the dialog early");
});

test("Secrets authentication Page keeps a created vault retryable when session persistence fails", async () => {
    const page = await loadInitializationPage({rememberMinutes:15, maxRememberMinutes:15});
    page.state.createPasskey = false;
    page.secrets.unlock = async options => {
        page.calls.unlock.push(options);
        throw new Error("Session storage is unavailable.");
    };
    await page.controller.initialize();

    assert.equal(page.calls.lock, 1);
    assert.equal(page.secrets.status, "locked");
    assert.equal(page.state.status, "locked");
    assert.match(page.state.error, /Vault created.*session could not be established.*Session storage is unavailable/u);
    assert.deepEqual(page.calls.close, []);
});

test("Secrets authentication Page prevents duplicate initialization", async () => {
    const gate = deferred();
    const page = await loadInitializationPage();
    page.state.createPasskey = false;
    page.secrets.initialize = async options => {
        page.calls.initialize.push(options);
        await gate.promise;
        page.secrets.status = "unlocked";
    };
    const first = page.controller.initialize();
    await Promise.resolve();
    await page.controller.initialize();
    assert.equal(page.calls.initialize.length, 1);
    gate.resolve();
    await first;
    assert.deepEqual(page.calls.close, [{unlocked:true}]);
});

test("Secrets authentication Page automatically enrolls the selected default passkey", async () => {
    await withWebAuthn(async () => {
        const enrollment = deferred();
        const page = await loadInitializationPage();
        page.secrets.addPasskey = async options => {
            page.calls.addPasskey.push(options);
            await enrollment.promise;
        };
        const initializing = page.controller.initialize();
        await new Promise(resolve => setImmediate(resolve));

        assert.deepEqual(page.calls.addPasskey, [{
            label:"This device",
            description:"Use this device to unlock the vault.",
            password:"master password"
        }]);
        assert.equal(page.state.setupPasskey, true);
        assert.equal(page.state.busy, true);
        assert.equal(page.state.password, "", "the enrollment password must not remain in reactive Page state");
        assert.deepEqual(page.calls.close, [], "the dialog must remain open until registration completes");

        enrollment.resolve();
        await initializing;
        await Promise.all([page.controller.onStatusChanged(), page.controller.onStatusChanged()]);
        assert.equal(page.state.setupPasskey, false);
        assert.deepEqual(page.calls.close, [{unlocked:true}], "successful enrollment closes the dialog exactly once");
    });
});

test("Secrets authentication Page skips enrollment when deselected or unsupported", async () => {
    await withWebAuthn(async () => {
        const deselected = await loadInitializationPage();
        deselected.state.createPasskey = false;
        await deselected.controller.initialize();
        assert.deepEqual(deselected.calls.addPasskey, []);
        assert.deepEqual(deselected.calls.close, [{unlocked:true}]);
    });

    await withWebAuthn(async () => {
        const unsupported = await loadInitializationPage();
        await unsupported.controller.initialize();
        assert.equal(unsupported.state.passkeyEnrollmentSupported, false);
        assert.deepEqual(unsupported.calls.addPasskey, []);
        assert.deepEqual(unsupported.calls.close, [{unlocked:true}]);
    }, {create:false});
});

test("Secrets authentication Page preserves initialization after enrollment failure and supports retry", async () => {
    await withWebAuthn(async () => {
        const page = await loadInitializationPage();
        let attempts = 0;
        page.secrets.addPasskey = async options => {
            page.calls.addPasskey.push(options);
            if (++attempts === 1) throw new Error("Passkey registration was cancelled.");
        };
        await page.controller.initialize();

        assert.equal(page.secrets.status, "unlocked");
        assert.equal(page.state.setupPasskey, true);
        assert.equal(page.state.error, "Passkey registration was cancelled.");
        assert.deepEqual(page.calls.close, []);

        page.state.passkeyLabel = "  Work laptop  ";
        page.state.passkeyDescription = "  Primary device  ";
        await page.controller.enrollPasskey();
        assert.deepEqual(page.calls.addPasskey[1], {label:"Work laptop", description:"Primary device", password:"master password"});
        assert.deepEqual(page.calls.close, [{unlocked:true}]);
    });
});

test("Secrets authentication Page permits skipping after cancelled automatic enrollment", async () => {
    await withWebAuthn(async () => {
        const page = await loadInitializationPage();
        page.secrets.addPasskey = async options => {
            page.calls.addPasskey.push(options);
            throw new Error("No eligible authenticator.");
        };
        await page.controller.initialize();
        await page.controller.skipPasskey();
        await page.controller.enrollPasskey();

        assert.equal(page.calls.addPasskey.length, 1);
        assert.equal(page.secrets.status, "unlocked");
        assert.deepEqual(page.calls.close, [{unlocked:true}]);
    });
});

test("Secrets authentication Page does not complete enrollment after an external lock", async () => {
    await withWebAuthn(async () => {
        const pending = deferred();
        const page = await loadInitializationPage();
        page.secrets.addPasskey = async options => {
            page.calls.addPasskey.push(options);
            await pending.promise;
        };
        const initializing = page.controller.initialize();
        await new Promise(resolve => setImmediate(resolve));
        page.secrets.status = "locked";
        await page.controller.onStatusChanged();
        pending.resolve();
        await initializing;

        assert.deepEqual(page.calls.close, []);
        assert.equal(page.state.setupPasskey, false);
        assert.equal(page.state.status, "locked");
        assert.match(page.state.error, /locked before passkey setup completed/u);
    });
});

test("Secrets authentication Page clears sensitive enrollment state on unload", async () => {
    await withWebAuthn(async () => {
        const pending = deferred();
        const page = await loadInitializationPage();
        page.secrets.addPasskey = async options => {
            page.calls.addPasskey.push(options);
            await pending.promise;
        };
        const initializing = page.controller.initialize();
        await new Promise(resolve => setImmediate(resolve));
        page.controller.unload();
        pending.resolve();
        await initializing;
        await page.controller.enrollPasskey();

        assert.equal(page.state.setupPasskey, false);
        assert.equal(page.state.password, "");
        assert.equal(page.state.confirmPassword, "");
        assert.deepEqual(page.state.credentials, []);
        assert.deepEqual(page.calls.close, []);
    });
});

test("Secrets authentication Page preserves password and passkey unlock flows", async () => {
    const password = createPage({rememberMinutes:30, maxRememberMinutes:480});
    let attempts = 0;
    password.secrets.unlock = async options => {
        password.calls.unlock.push(options);
        if (++attempts === 1) throw new Error("Invalid master password.");
        password.secrets.status = "unlocked";
    };
    await password.controller.load();
    password.state.password = "wrong";
    password.state.rememberMinutes = "480";
    await password.controller.authenticate();
    assert.equal(password.state.error, "Invalid master password.");
    assert.deepEqual(password.calls.close, []);
    password.state.password = "master password";
    await password.controller.authenticate();
    assert.deepEqual(password.calls.unlock, [
        {password:"wrong", rememberMinutes:480},
        {password:"master password", rememberMinutes:480}
    ]);
    assert.deepEqual(password.calls.close, [{unlocked:true}]);

    await withWebAuthn(async () => {
        const passkey = createPage({maxRememberMinutes:15});
        await passkey.controller.load();
        passkey.state.credential = "passkey:passkey";
        passkey.state.rememberMinutes = "15";
        await passkey.controller.authenticate();
        assert.deepEqual(passkey.calls.unlockWithPasskey, [{id:"passkey", rememberMinutes:15}]);
        assert.deepEqual(passkey.calls.close, [{unlocked:true}]);
        assert.equal(passkey.calls.get, 0);
    });
});

test("Secrets authentication Page cancellation clears credentials without locking", async () => {
    const page = createPage();
    await page.controller.load();
    page.state.password = "sensitive";
    await page.controller.cancel();
    assert.deepEqual(page.calls.close, [null]);
    assert.equal(page.calls.lock, 0);
    assert.equal(page.state.password, "");
});
