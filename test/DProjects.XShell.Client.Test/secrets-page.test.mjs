import assert from "node:assert/strict";
import test from "node:test";

import SecretsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/secrets.js";

function createPage({ rememberMinutes = 0, maxRememberMinutes = 0, mode = "manage", secretId = "", passkeyId = "" } = {}) {
    const state = structuredClone(SecretsPage.state);
    state.mode = mode;
    state.secretId = secretId;
    state.passkeyId = passkeyId;
    const calls = { lock: 0, list: 0, unlock: [], unlockWithPasskey: [], set: [], addPasskey: [], updatePasskey: [], close: [] };
    const secrets = {
        status: mode == "manage" ? "locked" : "unlocked",
        rememberMinutes,
        maxRememberMinutes,
        sessionExpiresAt: null,
        async ready() { return this.status; },
        async listPasskeys() { return [{ id: "passkey", label: "Laptop", description: "Work computer", createdAt: "2026-01-01T00:00:00.000Z" }]; },
        async list() { calls.list++; return []; },
        async get() { return "decrypted value"; },
        async getInfo() { return { id:"token", description:"API credential", createdAt:"2026-01-02T00:00:00.000Z" }; },
        async set(...args) { calls.set.push(args); },
        async addPasskey(options) { calls.addPasskey.push(options); },
        async updatePasskey(...args) { calls.updatePasskey.push(args); },
        async unlock(options) { calls.unlock.push(options); },
        async unlockWithPasskey(options) { calls.unlockWithPasskey.push(options); },
        lock() { calls.lock++; this.status = "locked"; }
    };
    const controller = SecretsPage.controller({
        state,
        secrets,
        page: { invalidate() {}, async close(result) { calls.close.push(result); } },
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
    state.description = "sensitive description";
    state.createdAt = "2026-01-01T00:00:00.000Z";
    state.createdDisplay = "created date";
    state.editorValue = "decrypted value";
    state.items = [{ id: "token" }];
    state.passkeys = [{ id: "passkey" }];

    controller.unload();
    assert.equal(calls.lock, 0);
    assert.equal(state.password, "");
    assert.equal(state.confirmPassword, "");
    assert.equal(state.passkeyLabel, "");
    assert.equal(state.description, "");
    assert.equal(state.createdAt, null);
    assert.equal(state.createdDisplay, "");
    assert.equal(state.editorValue, "");
    assert.deepEqual(state.items, []);
    assert.deepEqual(state.passkeys, []);
});

test("Secrets Page loads and saves encrypted secret metadata", async () => {
    const { state, calls, controller } = createPage({ mode:"edit", secretId:"token" });
    await controller.load();
    assert.equal(state.editorValue, "decrypted value");
    assert.equal(state.description, "API credential");
    assert.notEqual(state.createdDisplay, "");

    state.description = "Rotated API credential";
    state.editorValue = "replacement";
    await controller.save();
    assert.deepEqual(calls.set, [["token", "replacement", { description:"Rotated API credential" }]]);
    assert.deepEqual(calls.close, [{ saved:true }]);
});

test("Secrets Page adds and edits passkey descriptions", async () => {
    const add = createPage({ mode:"add-passkey" });
    await add.controller.load();
    add.state.passkeyLabel = "Tablet";
    add.state.description = "Travel device";
    add.state.password = "master password";
    await add.controller.enrollPasskey();
    assert.deepEqual(add.calls.addPasskey, [{ label:"Tablet", password:"master password", description:"Travel device" }]);

    const edit = createPage({ mode:"edit-passkey", passkeyId:"passkey" });
    await edit.controller.load();
    assert.equal(edit.state.passkeyLabel, "Laptop");
    assert.equal(edit.state.description, "Work computer");
    assert.notEqual(edit.state.createdDisplay, "");
    edit.state.description = "Primary workstation";
    await edit.controller.savePasskey();
    assert.deepEqual(edit.calls.updatePasskey, [["passkey", { description:"Primary workstation" }]]);
    assert.deepEqual(edit.calls.close, [{ saved:true }]);
});
