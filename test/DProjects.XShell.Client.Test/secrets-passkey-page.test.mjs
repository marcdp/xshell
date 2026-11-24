import assert from "node:assert/strict";
import test from "node:test";

import PasskeyPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/preferences/secrets-passkey.js";

const registration = {id:"passkey-id", label:"Laptop", description:"Work computer", createdAt:"2026-01-01T00:00:00.000Z"};

function createPage({passkeyId = "", status = "unlocked"} = {}) {
    // Record enrollment, metadata edits, and dialog closure independently.
    const state = {...structuredClone(PasskeyPage.state), passkeyId};
    const calls = {listPasskeys:0, addPasskey:[], updatePasskey:[], close:[]};
    const secrets = {
        status,
        async ready() { return this.status; },
        async listPasskeys() { calls.listPasskeys++; return [registration]; },
        async addPasskey(options) { calls.addPasskey.push(options); },
        async updatePasskey(...args) { calls.updatePasskey.push(args); }
    };
    let onStatusChanged;
    const controller = PasskeyPage.controller({
        state, secrets,
        page:{async close(result) { calls.close.push(result); }},
        bus:{},
        events:{on(target, event, listener) { onStatusChanged = listener; }}
    });
    return {
        state, secrets, calls, controller,
        changeStatus(status) {
            secrets.status = status;
            onStatusChanged({detail:{status}});
        }
    };
}

function mockWebAuthn(t, {secure = true, create = true, get = true} = {}) {
    // Expose only the browser capabilities needed by the editor.
    for (const [key, value] of Object.entries({
        isSecureContext:secure,
        navigator:{credentials:{create:create ? async () => {} : undefined, get:get ? async () => {} : undefined}}
    })) {
        const original = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, {configurable:true, value});
        t.after(() => {
            if (original) Object.defineProperty(globalThis, key, original);
            else delete globalThis[key];
        });
    }
}

test("passkey editor enrolls with master-password reauthentication and clears the password during submission", async t => {
    mockWebAuthn(t);
    const {state, secrets, calls, controller} = createPage();
    await controller.load();
    assert.match(PasskeyPage.template, /descriptions are stored as plaintext local metadata/u);

    state.label = "  Tablet  ";
    state.description = "Travel device";
    await controller.save();
    assert.match(state.error, /master password/u);
    state.password = "master password";

    const pending = Promise.withResolvers();
    const addPasskey = secrets.addPasskey;
    secrets.addPasskey = options => { addPasskey(options); return pending.promise; };
    const save = controller.save();
    assert.equal(state.password, "");
    await controller.save();
    assert.deepEqual(calls.addPasskey, [{label:"Tablet", description:"Travel device", password:"master password"}]);
    pending.resolve();
    await save;

    assert.equal(state.password, "");
    assert.deepEqual(calls.close, [undefined]);
});

test("passkey editor loads registration metadata and updates only the description", async () => {
    const {state, calls, controller} = createPage({passkeyId:registration.id});
    await controller.load();
    assert.equal(calls.listPasskeys, 1);
    assert.equal(state.label, "Laptop");
    assert.equal(state.description, "Work computer");
    assert.equal(state.createdDisplay, new Date(registration.createdAt).toLocaleString());
    assert.match(PasskeyPage.template, /label="Label"[^>]*x-attr:readonly="state\.editing"/u);
    state.description = "Primary workstation";

    await controller.save();

    assert.deepEqual(calls.addPasskey, []);
    assert.deepEqual(calls.updatePasskey, [[registration.id, {description:"Primary workstation"}]]);
    assert.deepEqual(calls.close, [undefined]);
});

for (const capabilities of [{secure:false}, {create:false}, {get:false}]) {
    test(`passkey editor blocks enrollment when ${Object.keys(capabilities)[0]} support is missing`, async t => {
        mockWebAuthn(t, capabilities);
        const {state, calls, controller} = createPage();
        await controller.load();
        assert.equal(state.ready, false);
        assert.match(state.error, /secure origin and WebAuthn/u);
        await controller.save();
        assert.deepEqual(calls.addPasskey, []);
        await controller.cancel();
        assert.deepEqual(calls.close, [undefined]);
    });
}

test("passkey editor reports enrollment failure and keeps nonsensitive input available for retry", async t => {
    mockWebAuthn(t);
    const {state, secrets, calls, controller} = createPage();
    await controller.load();
    Object.assign(state, {label:"Tablet", description:"Travel device", password:"mistyped password"});
    secrets.addPasskey = async () => { throw new Error("The master password is incorrect."); };

    await controller.save();

    assert.match(state.error, /master password is incorrect/u);
    assert.equal(state.password, "");
    assert.equal(state.label, "Tablet");
    assert.equal(state.description, "Travel device");
    assert.equal(state.busy, false);
    assert.deepEqual(calls.close, []);
});

test("passkey editor requires an unlocked vault before reading a registration", async () => {
    const {state, calls, controller} = createPage({passkeyId:registration.id, status:"locked"});
    await controller.load();
    assert.equal(calls.listPasskeys, 0);
    assert.equal(state.ready, false);
    assert.match(state.error, /vault is locked/u);
});

test("passkey editor clears the form on lock and ignores a late enrollment result", async t => {
    mockWebAuthn(t);
    const {state, secrets, calls, controller, changeStatus} = createPage();
    await controller.load();
    const enrollment = Promise.withResolvers();
    secrets.addPasskey = () => enrollment.promise;
    Object.assign(state, {label:"Tablet", description:"Travel device", password:"master password"});
    const save = controller.save();

    changeStatus("locked");
    changeStatus("unlocked");
    enrollment.resolve();
    await save;

    assert.equal(state.password, "");
    assert.equal(state.description, "");
    assert.equal(state.ready, false);
    assert.match(state.error, /reopen the editor/u);
    assert.deepEqual(calls.close, []);
    await controller.cancel();
    assert.deepEqual(calls.close, [undefined]);
});

test("passkey editor ignores a metadata update finishing after an external lock", async () => {
    const {state, secrets, calls, controller, changeStatus} = createPage({passkeyId:registration.id});
    await controller.load();
    const update = Promise.withResolvers();
    secrets.updatePasskey = () => update.promise;
    state.description = "Updated description";
    const save = controller.save();
    changeStatus("locked");
    update.reject(new Error("Vault was locked during the operation."));
    await save;

    assert.equal(state.label, "");
    assert.equal(state.description, "");
    assert.match(state.error, /reopen the editor/u);
    assert.deepEqual(calls.close, []);
});

test("passkey editor clears the password on cancel or unload and ignores late completion", async t => {
    mockWebAuthn(t);
    for (const cancel of [false, true]) {
        const {state, secrets, calls, controller} = createPage();
        await controller.load();
        const enrollment = Promise.withResolvers();
        secrets.addPasskey = () => enrollment.promise;
        Object.assign(state, {label:"Tablet", password:"master password"});
        const save = controller.save();
        if (cancel) await controller.cancel();
        else controller.unload();
        enrollment.resolve();
        await save;

        assert.equal(state.password, "");
        assert.equal(state.ready, false);
        assert.deepEqual(calls.close, cancel ? [undefined] : []);
    }
});
