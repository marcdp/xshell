import assert from "node:assert/strict";
import test from "node:test";

import SecretsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/secrets-manager.js";

function createPage({ rememberMinutes = 0, maxRememberMinutes = 0, mode = "manage", secretName = "", passkeyId = "", status, items = [], dialogResult = null, confirmResult = "yes", renameError = null } = {}) {
    const state = structuredClone(SecretsPage.state);
    state.mode = mode;
    state.secretName = secretName;
    state.passkeyId = passkeyId;
    const calls = { lock:0, list:0, listPasskeys:0, get:[], open:[], confirm:[], set:[], rename:[], delete:[], addPasskey:[], updatePasskey:[], removePasskey:[], close:[], invalidate:0, replaceHash:[] };
    const secrets = {
        status: status ?? (mode == "manage" ? "locked" : "unlocked"),
        page: "page:x:/pages/secrets-unlock.js",
        rememberMinutes,
        maxRememberMinutes,
        sessionExpiresAt: null,
        async ready() { return this.status; },
        async listPasskeys() { calls.listPasskeys++; return [{ id: "passkey", label: "Laptop", description: "Work computer", createdAt: "2026-01-01T00:00:00.000Z" }]; },
        async list() { calls.list++; return items; },
        async get(...args) { calls.get.push(args); return "decrypted value"; },
        async getInfo() {
            return {
                id:"token",
                name:"token",
                label:"API token",
                description:"API credential",
                createdAt:"2026-01-02T00:00:00.000Z",
                modifiedAt:"2026-01-03T00:00:00.000Z",
                revision:2
            };
        },
        async set(...args) { calls.set.push(args); },
        async rename(...args) { calls.rename.push(args); if (renameError) throw renameError; },
        async delete(...args) { calls.delete.push(args); },
        async addPasskey(options) { calls.addPasskey.push(options); },
        async updatePasskey(...args) { calls.updatePasskey.push(args); },
        async removePasskey(...args) { calls.removePasskey.push(args); },
        lock() { calls.lock++; this.status = "locked"; }
    };
    const controller = SecretsPage.controller({
        state,
        secrets,
        page: {
            invalidate() { calls.invalidate++; },
            replaceHash(value) { calls.replaceHash.push(value); },
            async close(result) { calls.close.push(result); }
        },
        dialog: {
            async open(options) {
                calls.open.push(options);
                if (dialogResult?.unlocked) secrets.status = "unlocked";
                return dialogResult;
            },
            async confirm(options) { calls.confirm.push(options); return confirmResult; }
        },
        bus: {},
        events: { on() {} }
    });
    return { state, secrets, calls, controller };
}

test("Secrets Manager delegates initialization and unlocking to the dedicated authentication Page", async () => {
    const { state, secrets, calls, controller } = createPage({dialogResult:{unlocked:true}});
    await controller.load();
    await controller.openUnlock();
    assert.deepEqual(calls.open, [{
        href:"page:x:/pages/secrets-unlock.js",
        context:{}
    }]);
    assert.equal(calls.list, 1);
    assert.equal(calls.listPasskeys, 2, "the Manager refreshes passkeys after authentication completes");
    assert.equal(state.status, "unlocked");
});

test("Secrets Manager refreshes after successful secret and passkey dialogs without changing the tab hash", async () => {
    const page = createPage({status:"unlocked", dialogResult:{saved:true}});
    await page.controller.load();
    const initialLists = page.calls.list;
    const initialPasskeyLists = page.calls.listPasskeys;

    await page.controller.openEditor("edit", "token");
    await page.controller.openPasskey();
    await page.controller.openPasskeyEditor("passkey");

    assert.equal(page.calls.list, initialLists + 3);
    assert.equal(page.calls.listPasskeys, initialPasskeyLists + 3);
    assert.deepEqual(page.calls.open.map(item => item.context), [
        {mode:"edit", secretName:"token"},
        {mode:"add-passkey"},
        {mode:"edit-passkey", passkeyId:"passkey"}
    ]);
    assert.deepEqual(page.calls.replaceHash, [], "normal refreshes leave the hash-selected x-tab untouched");
    assert.match(SecretsPage.template, /<x-tabs[^>]*use-hash/u);
});

test("Secrets Manager refreshes after removing secrets and passkeys", async () => {
    const page = createPage({status:"unlocked"});
    await page.controller.load();
    const initialLists = page.calls.list;
    const initialPasskeyLists = page.calls.listPasskeys;

    await page.controller.remove({event:{currentTarget:{dataset:{name:"token"}}}});
    await page.controller.removePasskey({event:{currentTarget:{dataset:{id:"passkey"}}}});

    assert.deepEqual(page.calls.delete, [["token"]]);
    assert.deepEqual(page.calls.removePasskey, [["passkey"]]);
    assert.equal(page.calls.list, initialLists + 2);
    assert.equal(page.calls.listPasskeys, initialPasskeyLists + 2);
});

test("Secrets Manager status changes clear locked data and reload unlocked data", async () => {
    const page = createPage({status:"unlocked", items:[{id:"id", name:"token", label:"Token", description:"", createdAt:"2026-01-01T00:00:00.000Z", modifiedAt:"2026-01-01T00:00:00.000Z", revision:1}]});
    await page.controller.load();
    assert.equal(page.state.items.length, 1);

    page.secrets.status = "locked";
    await page.controller.onStatusChanged();
    assert.deepEqual(page.state.items, []);
    assert.equal(page.state.status, "locked");

    page.secrets.status = "unlocked";
    await page.controller.onStatusChanged();
    assert.equal(page.state.items.length, 1);
    assert.equal(page.state.status, "unlocked");
});

test("Secrets Manager unload clears sensitive state without locking", async () => {
    const { state, calls, controller } = createPage();
    await controller.load();
    state.password = "password";
    state.passkeyLabel = "Laptop";
    state.secretName = "token";
    state.label = "Token";
    state.description = "sensitive description";
    state.createdAt = "2026-01-01T00:00:00.000Z";
    state.createdDisplay = "created date";
    state.modifiedAt = "2026-01-02T00:00:00.000Z";
    state.modifiedDisplay = "modified date";
    state.revision = 7;
    state.editorValue = "decrypted value";
    state.items = [{ id: "token" }];
    state.passkeys = [{ id: "passkey" }];

    controller.unload();
    assert.equal(calls.lock, 0);
    assert.equal(state.password, "");
    assert.equal(state.passkeyLabel, "");
    assert.equal(state.secretName, "");
    assert.equal(state.label, "");
    assert.equal(state.description, "");
    assert.equal(state.createdAt, null);
    assert.equal(state.createdDisplay, "");
    assert.equal(state.modifiedAt, null);
    assert.equal(state.modifiedDisplay, "");
    assert.equal(state.revision, null);
    assert.equal(state.editorValue, "");
    assert.deepEqual(state.items, []);
    assert.deepEqual(state.passkeys, []);
});

test("Secrets Page loads and saves encrypted secret metadata", async () => {
    const { state, calls, controller } = createPage({ mode:"edit", secretName:"token" });
    await controller.load();
    assert.deepEqual(calls.get, [["token", {interactive:false}]]);
    assert.equal(state.editorValue, "decrypted value");
    assert.equal(state.secretName, "token");
    assert.equal(state.label, "API token");
    assert.equal(state.description, "API credential");
    assert.notEqual(state.createdDisplay, "");
    assert.notEqual(state.modifiedDisplay, "");
    assert.equal(state.revision, 2);
    assert.match(SecretsPage.template, /label="Created" readonly x-model="state\.createdDisplay"/u);
    assert.match(SecretsPage.template, /label="Modified" readonly x-model="state\.modifiedDisplay"/u);
    assert.match(SecretsPage.template, /label="Revision" readonly x-model="state\.revision"/u);

    state.description = "Rotated API credential";
    state.editorValue = "replacement";
    await controller.save();
    assert.deepEqual(calls.set, [["token", "replacement", { description:"Rotated API credential" }]]);
    assert.deepEqual(calls.rename, []);
    assert.deepEqual(calls.close, [{ saved:true }]);
});

test("Secrets Manager renders names, labels, and modification metadata after edits", async () => {
    const items = [{
        id:"550e8400-e29b-41d4-a716-446655440000",
        name:"token",
        label:"Token",
        description:"API token",
        createdAt:"2026-01-01T00:00:00.000Z",
        modifiedAt:"2026-01-02T00:00:00.000Z",
        revision:1
    }];
    const manager = createPage({ status:"unlocked", items });
    await manager.controller.load();
    assert.notEqual(manager.state.items[0].createdDisplay, "—");
    assert.notEqual(manager.state.items[0].modifiedDisplay, "—");
    assert.equal(manager.state.items[0].revision, 1);
    assert.match(SecretsPage.template, /label="Label"[\s\S]*label="Name"[\s\S]*label="Description"[\s\S]*label="Revision"[\s\S]*label="Created"[\s\S]*label="Modified"[\s\S]*label="Actions"/u);
    assert.match(SecretsPage.template, /x-attr:key="item\.id"[\s\S]*x-attr:label="item\.label"/u);

    items[0] = {
        ...items[0],
        modifiedAt:"2026-01-04T00:00:00.000Z",
        revision:2
    };
    const refreshed = createPage({ status:"unlocked", items, dialogResult:{saved:true} });
    await refreshed.controller.openEditor("edit", "token");
    assert.equal(refreshed.calls.list, 1);
    assert.notEqual(refreshed.state.items[0].modifiedDisplay, "—");
    assert.equal(refreshed.state.items[0].revision, 2);
});

test("Secrets Page renames by name and reports partial save failures", async () => {
    const success = createPage({mode:"edit", secretName:"token"});
    await success.controller.load();
    success.state.secretName = "token-prod";
    await success.controller.save();
    assert.deepEqual(success.calls.set, [], "an unchanged value and metadata are not rewritten");
    assert.deepEqual(success.calls.rename, [["token", "token-prod"]]);
    assert.deepEqual(success.calls.close, [{saved:true}]);

    const partial = createPage({mode:"edit", secretName:"token", renameError:new Error("duplicate name")});
    await partial.controller.load();
    partial.state.description = "Updated before rename";
    partial.state.secretName = "existing";
    await partial.controller.save();
    assert.deepEqual(partial.calls.set, [["token", "decrypted value", {description:"Updated before rename"}]]);
    assert.deepEqual(partial.calls.rename, [["token", "existing"]]);
    assert.match(partial.state.error, /changes were saved.*rename failed.*duplicate name/u);
    assert.deepEqual(partial.calls.close, []);
});

test("Secrets Page adds secrets by name with optional labels", async () => {
    const add = createPage({mode:"add"});
    await add.controller.load();
    add.state.secretName = "github-token";
    add.state.label = "GitHub token";
    add.state.description = "API authentication";
    add.state.editorValue = "secret-value";
    await add.controller.save();
    assert.deepEqual(add.calls.set, [["github-token", "secret-value", {label:"GitHub token", description:"API authentication"}]]);
    assert.deepEqual(add.calls.close, [{saved:true}]);
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
