import assert from "node:assert/strict";
import test from "node:test";

import SecretsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/preferences/secrets.js";
import SecretPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/preferences/secrets-secret.js";
import PasskeyPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/preferences/secrets-passkey.js";
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import PageSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/page.schema.json" with { type: "json" };
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";

const secret = {
    id:"secret-id", name:"token", label:"API token", description:"API credential",
    createdAt:"2026-01-01T00:00:00.000Z", modifiedAt:"2026-01-02T00:00:00.000Z", revision:2
};
const passkey = {id:"passkey-id", label:"Laptop", description:"Work computer", createdAt:"2026-01-01T00:00:00.000Z"};
const secretButton = {event:{currentTarget:{dataset:{name:secret.name}}}};
const passkeyButton = {event:{currentTarget:{dataset:{id:passkey.id}}}};

function createPage({status = "locked", pageUnlock = "page:x:/pages/preferences/secrets-unlock.js", dialogResult = null, confirmResult = "yes"} = {}) {
    // Record calls at the Secrets, Dialog, and Bus boundaries.
    const state = structuredClone(SecretsPage.state);
    const calls = {list:0, listPasskeys:0, get:0, lock:0, delete:[], removePasskey:[], open:[], confirm:[]};
    const secrets = {
        status,
        options:{pageUnlock, pageManager:"page:x:/pages/preferences/secrets.js"},
        sessionExpiresAt:null,
        async ready() { return this.status; },
        async list() { calls.list++; return [secret]; },
        async listPasskeys() { calls.listPasskeys++; return [passkey]; },
        async get() { calls.get++; throw new Error("Management must not load decrypted values."); },
        async delete(name) { calls.delete.push(name); },
        async removePasskey(id) { calls.removePasskey.push(id); },
        lock() { calls.lock++; this.status = "locked"; this.sessionExpiresAt = null; }
    };
    const dialog = {
        async open(options) {
            calls.open.push(options);
            if (dialogResult?.unlocked) secrets.status = "unlocked";
            return dialogResult;
        },
        async confirm(options) { calls.confirm.push(options); return confirmResult; }
    };
    const bus = {};
    let onStatusChanged;
    const controller = SecretsPage.controller({
        state, secrets, dialog, bus,
        events:{on(target, event, listener) {
            assert.equal(target, bus);
            assert.equal(event, "secrets:status-changed");
            onStatusChanged = listener;
        }}
    });
    return {
        state, secrets, dialog, calls, controller,
        changeStatus(status, sessionExpiresAt = null) {
            Object.assign(secrets, {status, sessionExpiresAt});
            return onStatusChanged({detail:{status, sessionExpiresAt}});
        }
    };
}

test("Secrets Pages satisfy the Page schema and expose only dedicated editor context properties", () => {
    for (const [definition, properties] of [[SecretsPage, []], [SecretPage, ["secretName"]], [PasskeyPage, ["passkeyId"]]]) {
        const result = new JsonValidator().validate({...definition, controller:{}}, PageSchema, {"./contract.schema.json":ContractSchema});
        assert.equal(result.valid, true, JSON.stringify(result.errors));
        assert.deepEqual(Object.keys(definition.contract.properties ?? {}), properties);
        for (const property of properties) assert.equal(definition.contract.properties[property].context, true);
    }
});

test("management discovers an uninitialized or locked vault without reading its lists", async () => {
    for (const status of ["uninitialized", "locked"]) {
        const {state, calls, controller} = createPage({status});
        await controller.load();
        assert.equal(state.ready, true);
        assert.equal(state.status, status);
        assert.equal(state.sessionExpiresAt, null);
        assert.deepEqual(state.items, []);
        assert.deepEqual(state.passkeys, []);
        assert.equal(calls.list + calls.listPasskeys, 0);
    }
});

test("management delegates creation or unlock to the configured authentication Page", async () => {
    for (const status of ["uninitialized", "locked"]) {
        const {state, calls, controller} = createPage({status, dialogResult:{unlocked:true}, pageUnlock:"/_assets/custom/unlock.js"});
        await controller.load();
        await controller.openUnlock();
        assert.deepEqual(calls.open, [{href:"/_assets/custom/unlock.js", context:{}}]);
        assert.equal(state.status, "unlocked");
        assert.equal(calls.list, 1);
        assert.equal(calls.listPasskeys, 1);
    }

    const {state, calls, controller} = createPage({pageUnlock:null});
    await controller.load();
    await controller.openUnlock();
    assert.match(state.error, /not configured/u);
    assert.deepEqual(calls.open, []);
});

test("management displays session expiration, secret metadata, and passkey metadata", async () => {
    const {state, secrets, calls, controller} = createPage({status:"unlocked"});
    secrets.sessionExpiresAt = "2026-01-04T00:00:00.000Z";
    await controller.load();
    assert.equal(state.sessionExpiresAt, secrets.sessionExpiresAt);
    assert.match(SecretsPage.template, /<x-countdown x-attr:value="state\.sessionExpiresAt"/u);
    assert.deepEqual(state.items, [{
        ...secret,
        createdDisplay:new Date(secret.createdAt).toLocaleDateString(),
        modifiedDisplay:new Date(secret.modifiedAt).toLocaleDateString()
    }]);
    assert.deepEqual(state.passkeys, [{...passkey, createdDisplay:new Date(passkey.createdAt).toLocaleDateString()}]);
    assert.equal(calls.get, 0);
    for (const field of ["editorValue", "password", "originalEditorValue"]) assert.equal(Object.hasOwn(state, field), false);
    for (const label of ["Vault", "Secrets", "Passkeys"]) {
        assert.equal([...SecretsPage.template.matchAll(new RegExp(`<x-datafield label="${label}"`, "gu"))].length, 1);
    }
});

test("management opens dedicated editors and refreshes after each successful save", async () => {
    const {state, calls, controller} = createPage({status:"unlocked", dialogResult:{saved:true}});
    await controller.load();
    state.passkeySupported = true;

    await controller.add();
    await controller.edit(secretButton);
    await controller.addPasskey();
    await controller.editPasskey({event:{detail:{value:passkey.id}}});

    assert.deepEqual(calls.open, [
        {href:"page:x:/pages/preferences/secrets-secret.js", title:"Add secret", context:{}},
        {href:"page:x:/pages/preferences/secrets-secret.js", title:"Edit secret", context:{secretName:secret.name}},
        {href:"page:x:/pages/preferences/secrets-passkey.js", title:"Add passkey", context:{}},
        {href:"page:x:/pages/preferences/secrets-passkey.js", title:"Edit passkey", context:{passkeyId:passkey.id}}
    ]);
    assert.equal(calls.list, 5);
    assert.equal(calls.listPasskeys, 5);
    assert.equal(calls.get, 0);
});

test("management keeps the lists when secret or passkey editing is cancelled", async () => {
    const {state, calls, controller} = createPage({status:"unlocked"});
    await controller.load();
    const {items, passkeys} = state;

    await controller.edit({event:{detail:{value:secret.name}}});
    await controller.editPasskey(passkeyButton);

    assert.equal(calls.open.length, 2);
    assert.equal(calls.list, 1);
    assert.equal(calls.listPasskeys, 1);
    assert.equal(state.items, items);
    assert.equal(state.passkeys, passkeys);
});

test("management deletes secrets and removes passkeys only after confirmation", async () => {
    for (const confirmed of [false, true]) {
        const {calls, controller} = createPage({status:"unlocked", confirmResult:confirmed ? "yes" : null});
        await controller.load();
        await controller.remove(secretButton);
        await controller.removePasskey(passkeyButton);

        assert.deepEqual(calls.confirm, [
            {title:"Delete secret", message:"Delete secret 'token'?"},
            {title:"Remove passkey", message:"Remove passkey 'Laptop' from this local vault?"}
        ]);
        assert.deepEqual(calls.delete, confirmed ? [secret.name] : []);
        assert.deepEqual(calls.removePasskey, confirmed ? [passkey.id] : []);
        assert.equal(calls.list, confirmed ? 3 : 1);
        assert.equal(calls.listPasskeys, calls.list);
    }
});

test("management clears the lists immediately on lock and reloads them on unlock", async () => {
    const {state, secrets, calls, controller, changeStatus} = createPage({status:"unlocked"});
    await controller.load();
    await changeStatus("unlocked", "2026-01-04T00:00:00.000Z");
    assert.equal(state.sessionExpiresAt, secrets.sessionExpiresAt);
    const locking = controller.lock();

    assert.equal(calls.lock, 1);
    assert.equal(state.status, "locked");
    assert.equal(state.sessionExpiresAt, null);
    assert.deepEqual(state.items, []);
    assert.deepEqual(state.passkeys, []);
    await locking;
    await changeStatus("unlocked");
    assert.equal(state.items.length, 1);
    assert.equal(state.passkeys.length, 1);
    assert.equal(state.status, "unlocked");
});

test("management ignores a list result from before an external lock or unload", async () => {
    for (const unload of [false, true]) {
        const {state, secrets, calls, controller, changeStatus} = createPage({status:"unlocked"});
        await controller.load();
        const pending = Promise.withResolvers();
        const started = Promise.withResolvers();
        secrets.list = () => { started.resolve(); return pending.promise; };
        const refresh = controller.refresh();
        await started.promise;

        if (unload) controller.unload();
        else await changeStatus("locked");

        pending.resolve([secret]);
        await refresh;
        assert.deepEqual(state.items, []);
        assert.deepEqual(state.passkeys, []);
        assert.equal(calls.lock, 0);
    }
});

test("management ignores confirmation from a previous vault session", async () => {
    const {dialog, calls, controller, changeStatus} = createPage({status:"unlocked"});
    await controller.load();
    const confirmation = Promise.withResolvers();
    dialog.confirm = () => confirmation.promise;
    const removal = controller.remove(secretButton);
    await changeStatus("locked");
    await changeStatus("unlocked");
    confirmation.resolve("yes");
    await removal;
    assert.deepEqual(calls.delete, []);
});
