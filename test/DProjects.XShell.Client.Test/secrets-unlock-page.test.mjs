import assert from "node:assert/strict";
import test from "node:test";

import SecretsUnlockPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/secrets-unlock.js";

function createPage({status = "locked", rememberMinutes = 0, maxRememberMinutes = 0} = {}) {
    const state = structuredClone(SecretsUnlockPage.state);
    const calls = {get: 0, initialize: [], unlock: [], unlockWithPasskey: [], close: [], lock: 0};
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
        async unlock(options) { calls.unlock.push(options); this.status = "unlocked"; },
        async unlockWithPasskey(options) { calls.unlockWithPasskey.push(options); this.status = "unlocked"; },
        lock() { calls.lock++; }
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

test("Secrets authentication Page initializes the vault and returns only an unlock marker", async () => {
    const {state, calls, controller} = createPage({status:"uninitialized"});
    await controller.load();
    state.password = "master password";
    state.confirmPassword = "master password";
    await controller.initialize();

    assert.deepEqual(calls.initialize, [{password:"master password"}]);
    assert.deepEqual(calls.close, [{unlocked:true}]);
    assert.equal(JSON.stringify(calls.close).includes("master password"), false);
    assert.equal(calls.get, 0);
});

test("Secrets authentication Page keeps password failures open for retry", async () => {
    const {state, secrets, calls, controller} = createPage({rememberMinutes:30, maxRememberMinutes:60});
    let attempts = 0;
    secrets.unlock = async options => {
        calls.unlock.push(options);
        if (++attempts === 1) throw new Error("Invalid master password.");
        secrets.status = "unlocked";
    };
    await controller.load();
    assert.deepEqual(state.rememberOptions, [
        {value:0, label:"This session only"},
        {value:15, label:"15 minutes"},
        {value:30, label:"30 minutes"},
        {value:60, label:"60 minutes"}
    ]);

    state.password = "wrong";
    state.rememberMinutes = "60";
    await controller.unlock();
    assert.equal(state.error, "Invalid master password.");
    assert.deepEqual(calls.close, []);

    state.password = "correct";
    await controller.unlock();
    assert.deepEqual(calls.unlock, [
        {password:"wrong", rememberMinutes:60},
        {password:"correct", rememberMinutes:60}
    ]);
    assert.deepEqual(calls.close, [{unlocked:true}]);
});

test("Secrets authentication Page supports explicit passkey unlock and cancellation", async () => {
    const originalSecureContext = Object.getOwnPropertyDescriptor(globalThis, "isSecureContext");
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "isSecureContext", {configurable:true, value:true});
    Object.defineProperty(globalThis, "navigator", {configurable:true, value:{credentials:{async get() {}}}});
    try {
        const passkey = createPage({maxRememberMinutes:15});
        await passkey.controller.load();
        assert.equal(passkey.state.passkeySupported, true);
        passkey.state.rememberMinutes = "15";
        await passkey.controller.unlockPasskey();
        assert.deepEqual(passkey.calls.unlockWithPasskey, [{rememberMinutes:15}]);
        assert.deepEqual(passkey.calls.close, [{unlocked:true}]);

        const cancelled = createPage();
        await cancelled.controller.load();
        cancelled.state.password = "sensitive";
        await cancelled.controller.cancel();
        assert.deepEqual(cancelled.calls.close, [null]);
        assert.equal(cancelled.state.password, "");
    } finally {
        if (originalSecureContext) Object.defineProperty(globalThis, "isSecureContext", originalSecureContext);
        else delete globalThis.isSecureContext;
        if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
        else delete globalThis.navigator;
    }
});

test("Secrets authentication Page closes once when another operation unlocks and unload never locks", async () => {
    const {state, secrets, calls, controller} = createPage();
    await controller.load();
    state.password = "sensitive";
    secrets.status = "unlocked";
    await Promise.all([controller.onStatusChanged(), controller.onStatusChanged()]);
    controller.unload();

    assert.deepEqual(calls.close, [{unlocked:true}]);
    assert.equal(calls.lock, 0);
    assert.equal(state.password, "");
    assert.deepEqual(state.passkeys, []);
});
