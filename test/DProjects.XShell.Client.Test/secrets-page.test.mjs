import assert from "node:assert/strict";
import test from "node:test";

import SecretsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/secrets.js";

function createPage({ rememberMinutes = 0, maxRememberMinutes = 0 } = {}) {
    const state = structuredClone(SecretsPage.state);
    const calls = { lock: 0, list: 0, unlock: [], unlockWithPasskey: [] };
    const secrets = {
        status: "locked",
        sessionExpiresAt: null,
        async ready() { return this.status; },
        async listPasskeys() { return [{ id: "passkey", label: "Laptop", createdAt: "2026-01-01T00:00:00.000Z" }]; },
        async list() { calls.list++; return []; },
        async unlock(options) { calls.unlock.push(options); },
        async unlockWithPasskey(options) { calls.unlockWithPasskey.push(options); },
        lock() { calls.lock++; this.status = "locked"; }
    };
    const controller = SecretsPage.controller({
        state,
        secrets,
        config: { xshell: { services: { secrets: { options: { rememberMinutes, maxRememberMinutes } } } } },
        page: { invalidate() {}, async close() {} },
        dialog: {},
        bus: {},
        events: { on() {} }
    });
    return { state, secrets, calls, controller };
}

test("Secrets Page offers only policy-allowed remembered durations and uses one selection for both unlock methods", async () => {
    const { state, calls, controller } = createPage({ rememberMinutes: 30, maxRememberMinutes: 60 });
    await controller.load();
    assert.equal(state.rememberMinutes, 30);
    assert.deepEqual(state.rememberOptions, [
        { value: 0, label: "This session only" },
        { value: 15, label: "15 minutes" },
        { value: 30, label: "30 minutes" },
        { value: 60, label: "60 minutes" }
    ]);

    state.password = "password";
    state.rememberMinutes = "60";
    await controller.unlock();
    assert.deepEqual(calls.unlock, [{ password: "password", rememberMinutes: 60 }]);
    assert.equal(calls.list, 0, "unlock completion waits for the status-change event instead of refreshing twice");

    state.busy = false;
    state.passkeySupported = true;
    state.passkeys = [{ id: "passkey" }];
    await controller.unlockPasskey();
    assert.deepEqual(calls.unlockWithPasskey, [{ rememberMinutes: 60 }]);
});

test("Secrets Page hides remembered-session choices when disabled and unload clears sensitive state without locking", async () => {
    const { state, calls, controller } = createPage();
    await controller.load();
    assert.deepEqual(state.rememberOptions, []);
    state.password = "password";
    state.confirmPassword = "password";
    state.passkeyLabel = "Laptop";
    state.editorValue = "decrypted value";
    state.items = [{ id: "token" }];
    state.passkeys = [{ id: "passkey" }];

    controller.unload();
    assert.equal(calls.lock, 0);
    assert.equal(state.password, "");
    assert.equal(state.confirmPassword, "");
    assert.equal(state.passkeyLabel, "");
    assert.equal(state.editorValue, "");
    assert.deepEqual(state.items, []);
    assert.deepEqual(state.passkeys, []);
});
