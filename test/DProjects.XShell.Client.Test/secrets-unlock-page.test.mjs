import assert from "node:assert/strict";
import test from "node:test";

import SecretsUnlockPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/secrets-unlock.js";

function createPage({status = "locked", rememberMinutes = 0, maxRememberMinutes = 0} = {}) {
    const state = structuredClone(SecretsUnlockPage.state);
    const calls = {get: 0, initialize: [], addPasskey: [], unlock: [], unlockWithPasskey: [], close: [], lock: 0};
    const secrets = {
        status,
        rememberMinutes,
        maxRememberMinutes,
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
        page: {async close(result) { calls.close.push(result); }},
        bus: {},
        events: {on() {}}
    });
    return {state, secrets, calls, controller};
}

async function withWebAuthn(callback, {create = true, get = true} = {}) {
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

function deferred() {
    let resolve;
    const promise = new Promise(resolvePromise => {
        resolve = resolvePromise;
    });
    return {promise, resolve};
}

test("Secrets authentication Page offers optional passkey enrollment after initialization", async () => {
    await withWebAuthn(async () => {
        const {state, calls, controller} = createPage({status:"uninitialized"});
        await controller.load();
        state.password = "master password";
        state.confirmPassword = "master password";
        await controller.initialize();

        assert.deepEqual(calls.initialize, [{password:"master password"}]);
        assert.deepEqual(calls.addPasskey, []);
        assert.deepEqual(calls.close, []);
        assert.equal(state.setupPasskey, true);
        assert.equal(state.passkeyLabel, "My device");
        assert.equal(state.password, "");
        assert.equal(state.confirmPassword, "");
        assert.equal(calls.get, 0);
    });
});

test("Secrets authentication Page enrolls an explicitly requested passkey and closes once", async () => {
    await withWebAuthn(async () => {
        const page = createPage({status:"uninitialized"});
        await page.controller.load();
        page.state.password = "master password";
        page.state.confirmPassword = "master password";
        await page.controller.initialize();
        page.state.passkeyLabel = "   ";
        await page.controller.enrollPasskey();
        assert.equal(page.state.error, "Passkey name is required.");
        assert.deepEqual(page.calls.addPasskey, []);
        page.state.passkeyLabel = "  Work laptop  ";
        await page.controller.enrollPasskey();
        await page.controller.onStatusChanged();

        assert.deepEqual(page.calls.addPasskey, [{label:"Work laptop", password:"master password"}]);
        assert.deepEqual(page.calls.close, [{unlocked:true}]);
        assert.equal(page.state.setupPasskey, false);
        assert.equal(JSON.stringify(page.calls.close).includes("master password"), false);
    });
});

test("Secrets authentication Page can skip optional enrollment", async () => {
    await withWebAuthn(async () => {
        const page = createPage({status:"uninitialized"});
        await page.controller.load();
        page.state.password = "master password";
        page.state.confirmPassword = "master password";
        await page.controller.initialize();
        await page.controller.skipPasskey();
        await page.controller.enrollPasskey();

        assert.deepEqual(page.calls.addPasskey, []);
        assert.deepEqual(page.calls.close, [{unlocked:true}]);
        assert.equal(page.state.password, "");
        assert.equal(page.state.confirmPassword, "");
    });
});

test("Secrets authentication Page closes after initialization when passkey enrollment is unsupported", async () => {
    await withWebAuthn(async () => {
        const page = createPage({status:"uninitialized"});
        await page.controller.load();
        page.state.password = "master password";
        page.state.confirmPassword = "master password";
        await page.controller.initialize();

        assert.equal(page.state.passkeySupported, true);
        assert.equal(page.state.passkeyEnrollmentSupported, false);
        assert.equal(page.state.setupPasskey, false);
        assert.deepEqual(page.calls.close, [{unlocked:true}]);
    }, {create:false});
});

test("Secrets authentication Page preserves initialization after enrollment failure and permits retry", async () => {
    await withWebAuthn(async () => {
        const page = createPage({status:"uninitialized"});
        let attempts = 0;
        page.secrets.addPasskey = async options => {
            page.calls.addPasskey.push(options);
            if (++attempts === 1) throw new Error("Passkey registration was cancelled.");
        };
        await page.controller.load();
        page.state.password = "master password";
        page.state.confirmPassword = "master password";
        await page.controller.initialize();
        await page.controller.enrollPasskey();

        assert.equal(page.secrets.status, "unlocked");
        assert.equal(page.state.setupPasskey, true);
        assert.equal(page.state.error, "Passkey registration was cancelled.");
        assert.deepEqual(page.calls.close, []);

        await page.controller.enrollPasskey();
        assert.equal(page.calls.addPasskey.length, 2);
        assert.deepEqual(page.calls.close, [{unlocked:true}]);
    });
});

test("Secrets authentication Page permits skipping after enrollment failure", async () => {
    await withWebAuthn(async () => {
        const page = createPage({status:"uninitialized"});
        page.secrets.addPasskey = async options => {
            page.calls.addPasskey.push(options);
            throw new Error("No eligible authenticator.");
        };
        await page.controller.load();
        page.state.password = "master password";
        page.state.confirmPassword = "master password";
        await page.controller.initialize();
        await page.controller.enrollPasskey();
        await page.controller.skipPasskey();

        assert.deepEqual(page.calls.close, [{unlocked:true}]);
        assert.equal(page.secrets.status, "unlocked");
        assert.equal(page.state.password, "");
    });
});

test("Secrets status changes do not close the optional enrollment step", async () => {
    await withWebAuthn(async () => {
        const page = createPage({status:"uninitialized"});
        page.secrets.initialize = async options => {
            page.calls.initialize.push(options);
            page.secrets.status = "unlocked";
            await page.controller.onStatusChanged();
        };
        await page.controller.load();
        page.state.password = "master password";
        page.state.confirmPassword = "master password";
        await page.controller.initialize();
        await page.controller.onStatusChanged();

        assert.equal(page.state.setupPasskey, true);
        assert.deepEqual(page.calls.close, []);
    });
});

test("Secrets authentication Page preserves password and passkey unlock flows", async () => {
    const password = createPage({rememberMinutes:30, maxRememberMinutes:480});
    let passwordAttempts = 0;
    password.secrets.unlock = async options => {
        password.calls.unlock.push(options);
        if (++passwordAttempts === 1) throw new Error("Invalid master password.");
        password.secrets.status = "unlocked";
    };
    await password.controller.load();
    assert.deepEqual(password.state.rememberOptions, [
        {value:"0", label:"Do not remember"},
        {value:"15", label:"15 minutes"},
        {value:"30", label:"30 minutes"},
        {value:"480", label:"8 hours"}
    ]);
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

    const cancelled = createPage();
    await cancelled.controller.load();
    cancelled.state.password = "sensitive";
    await cancelled.controller.cancel();
    assert.deepEqual(cancelled.calls.close, [null]);
    assert.equal(cancelled.state.password, "");
});

test("Secrets authentication Page ignores stale completion after an external lock", async () => {
    await withWebAuthn(async () => {
        const pending = deferred();
        const page = createPage({status:"uninitialized"});
        page.secrets.addPasskey = async options => {
            page.calls.addPasskey.push(options);
            await pending.promise;
        };
        await page.controller.load();
        page.state.password = "master password";
        page.state.confirmPassword = "master password";
        await page.controller.initialize();
        const enrollment = page.controller.enrollPasskey();
        page.secrets.status = "locked";
        await page.controller.onStatusChanged();
        pending.resolve();
        await enrollment;

        assert.deepEqual(page.calls.close, []);
        assert.equal(page.state.setupPasskey, false);
        assert.equal(page.state.status, "locked");
        assert.equal(page.state.password, "");
    });
});

test("Secrets authentication Page ignores asynchronous completion after unload and never locks", async () => {
    const pending = deferred();
    const page = createPage();
    page.secrets.unlock = async options => {
        page.calls.unlock.push(options);
        await pending.promise;
        page.secrets.status = "unlocked";
    };
    await page.controller.load();
    page.state.password = "sensitive";
    const authentication = page.controller.authenticate();
    page.controller.unload();
    pending.resolve();
    await authentication;

    assert.deepEqual(page.calls.close, []);
    assert.equal(page.calls.lock, 0);
    assert.equal(page.state.password, "");
    assert.equal(page.state.confirmPassword, "");
    assert.deepEqual(page.state.credentials, []);
});

test("Secrets authentication Page clears optional enrollment state on unload", async () => {
    await withWebAuthn(async () => {
        const page = createPage({status:"uninitialized"});
        await page.controller.load();
        page.state.password = "master password";
        page.state.confirmPassword = "master password";
        await page.controller.initialize();
        page.controller.unload();
        await page.controller.enrollPasskey();

        assert.equal(page.state.setupPasskey, false);
        assert.equal(page.state.password, "");
        assert.equal(page.state.confirmPassword, "");
        assert.deepEqual(page.calls.addPasskey, []);
        assert.deepEqual(page.calls.close, []);
    });
});
