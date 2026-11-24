import assert from "node:assert/strict";
import test from "node:test";

import SecretPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/preferences/secrets-secret.js";

const metadata = {
    id:"secret-id", name:"token", label:"API token", description:"API credential",
    createdAt:"2026-01-01T00:00:00.000Z", modifiedAt:"2026-01-02T00:00:00.000Z", revision:2
};

function createPage({secretName = "", value = "decrypted value", status = "unlocked"} = {}) {
    // Record service calls and deliver status events to the Page's subscription.
    const state = {...structuredClone(SecretPage.state), secretName};
    const calls = {get:[], getInfo:[], set:[], rename:[], close:[]};
    const secrets = {
        status,
        async ready() { return this.status; },
        async get(...args) { calls.get.push(args); return value; },
        async getInfo(name) {
            calls.getInfo.push(name);
            return name === metadata.name ? metadata : undefined;
        },
        async set(...args) { calls.set.push(args); },
        async rename(...args) { calls.rename.push(args); }
    };
    let onStatusChanged;
    const controller = SecretPage.controller({
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

test("secret editor creates Text and JSON secrets with optional metadata", async () => {
    for (const [type, input, value] of [
        ["text", "secret-value", "secret-value"],
        ["json", '{"project":"demo","active":true}', {project:"demo", active:true}],
        ["json", "null", null]
    ]) {
        const {state, calls, controller} = createPage();
        await controller.load();
        Object.assign(state, {name:"github-token", valueType:type, editorValue:input, label:"GitHub token", description:"API authentication"});

        await controller.save();

        assert.deepEqual(calls.get, []);
        assert.deepEqual(calls.getInfo, ["github-token"]);
        assert.deepEqual(calls.set, [["github-token", value, {label:"GitHub token", description:"API authentication"}]]);
        assert.deepEqual(calls.close, [undefined]);
        assert.equal(state.editorValue, "");
    }
});

test("secret editor loads and updates a JSON value and its metadata", async () => {
    const {state, calls, controller} = createPage({secretName:"token", value:{scope:"read"}});
    await controller.load();
    assert.deepEqual(calls.get, [["token", {interactive:false}]]);
    assert.deepEqual(calls.getInfo, ["token"]);
    assert.equal(state.name, "token");
    assert.equal(state.label, "API token");
    assert.equal(state.description, "API credential");
    assert.equal(state.valueType, "json");
    assert.equal(state.editorValue, JSON.stringify({scope:"read"}, null, 2));
    assert.equal(state.createdDisplay, new Date(metadata.createdAt).toLocaleString());
    assert.equal(state.modifiedDisplay, new Date(metadata.modifiedAt).toLocaleString());
    assert.equal(state.revision, 2);

    Object.assign(state, {editorValue:'{"scope":"write"}', label:"", description:"Rotated API credential"});
    await controller.save();
    assert.deepEqual(calls.set, [["token", {scope:"write"}, {label:"", description:"Rotated API credential"}]]);
    assert.deepEqual(calls.rename, []);
    assert.deepEqual(calls.close, [undefined]);
});

test("secret editor renames by the original name without rewriting an unchanged value", async () => {
    const {state, calls, controller} = createPage({secretName:"token"});
    await controller.load();
    state.name = "token-prod";
    assert.equal(state.secretName, "token", "editing the name leaves the original Page query identity intact");
    await controller.save();
    assert.deepEqual(calls.set, []);
    assert.deepEqual(calls.rename, [["token", "token-prod"]]);
    assert.deepEqual(calls.close, [undefined]);
});

test("secret editor finishes an unchanged edit without writing", async () => {
    const {calls, controller} = createPage({secretName:"token", value:""});
    await controller.load();
    await controller.save();
    assert.deepEqual(calls.set, []);
    assert.deepEqual(calls.rename, []);
    assert.deepEqual(calls.close, [undefined]);
});

test("secret editor rejects blank names, empty Text, invalid JSON, and duplicate names", async () => {
    const {state, calls, controller} = createPage();
    await controller.load();
    state.name = " ";
    await controller.save();
    assert.match(state.error, /name is required/u);

    state.name = "new-secret";
    await controller.save();
    assert.match(state.error, /Enter a secret value/u);

    Object.assign(state, {valueType:"json", editorValue:"{invalid}"});
    await controller.save();
    assert.match(state.error, /valid JSON/u);

    Object.assign(state, {name:"token", editorValue:"42"});
    await controller.save();
    assert.match(state.error, /already exists/u);
    assert.deepEqual(calls.getInfo, ["token"]);
    assert.deepEqual(calls.set, []);
    assert.deepEqual(calls.close, []);
});

test("secret editor reports partial save failures and retries only the rename", async () => {
    const {state, secrets, calls, controller} = createPage({secretName:"token"});
    await controller.load();
    const rename = secrets.rename;
    secrets.rename = async (...args) => {
        await rename(...args);
        throw new Error("duplicate name");
    };
    Object.assign(state, {name:"existing", description:"Updated before rename"});
    await controller.save();
    assert.deepEqual(calls.set, [["token", "decrypted value", {description:"Updated before rename"}]]);
    assert.deepEqual(calls.rename, [["token", "existing"]]);
    assert.match(state.error, /changes were saved under 'token'.*rename failed.*duplicate name/u);
    assert.deepEqual(calls.close, []);

    secrets.rename = rename;
    state.name = "available";
    await controller.save();
    assert.equal(calls.set.length, 1);
    assert.deepEqual(calls.rename[1], ["token", "available"]);
    assert.deepEqual(calls.close, [undefined]);
});

test("secret editor requires an unlocked session and ignores a read finishing after a lock", async () => {
    const locked = createPage({secretName:"token", status:"locked"});
    await locked.controller.load();
    assert.deepEqual(locked.calls.get, []);
    assert.equal(locked.state.ready, false);
    assert.match(locked.state.error, /vault is locked/u);

    const {state, secrets, calls, controller, changeStatus} = createPage({secretName:"token"});
    const started = Promise.withResolvers();
    const reading = Promise.withResolvers();
    secrets.get = () => { started.resolve(); return reading.promise; };
    const load = controller.load();
    await started.promise;
    changeStatus("locked");
    changeStatus("unlocked");
    reading.resolve("late decrypted value");
    await load;

    assert.equal(state.editorValue, "");
    assert.equal(state.label, "");
    assert.equal(state.ready, false);
    assert.match(state.error, /reopen the editor/u);
    await controller.save();
    assert.deepEqual(calls.set, []);
});

test("secret editor suppresses duplicate submissions and skips rename after a lock", async () => {
    const {state, secrets, calls, controller, changeStatus} = createPage({secretName:"token"});
    await controller.load();
    const writing = Promise.withResolvers();
    const set = secrets.set;
    secrets.set = (...args) => { set(...args); return writing.promise; };
    Object.assign(state, {name:"replacement", editorValue:"replacement value"});
    const save = controller.save();
    await controller.save();
    changeStatus("locked");
    changeStatus("unlocked");
    writing.resolve();
    await save;

    assert.equal(calls.set.length, 1);
    assert.deepEqual(calls.rename, []);
    assert.deepEqual(calls.close, []);
    assert.equal(state.editorValue, "");
    assert.equal(state.description, "");
    assert.equal(state.ready, false);
});

test("secret editor clears decrypted values and metadata on cancel or unload", async () => {
    for (const cancel of [false, true]) {
        const {state, calls, controller} = createPage({secretName:"token"});
        await controller.load();
        if (cancel) await controller.cancel();
        else controller.unload();

        assert.deepEqual(calls.close, cancel ? [undefined] : []);
        assert.equal(state.ready, false);
        assert.equal(state.secretName, "");
        assert.equal(state.editorValue, "");
        assert.equal(state.description, "");
        assert.equal(state.revision, null);
        await controller.save();
        assert.deepEqual(calls.set, []);
    }
});

test("secret editor does not write when cancelled during the duplicate check", async () => {
    const {state, secrets, calls, controller} = createPage();
    await controller.load();
    const lookup = Promise.withResolvers();
    secrets.getInfo = () => lookup.promise;
    Object.assign(state, {name:"new-secret", editorValue:"secret value"});
    const save = controller.save();
    await controller.cancel();
    lookup.resolve(undefined);
    await save;
    assert.deepEqual(calls.set, []);
    assert.deepEqual(calls.close, [undefined]);
    assert.equal(state.editorValue, "");
});
