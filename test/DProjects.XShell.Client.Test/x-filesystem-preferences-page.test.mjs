import assert from "node:assert/strict";
import test from "node:test";

import FilesystemsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/pages/preferences/filesystems.js";
import FilesystemDetailPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/pages/preferences/filesystems-detail.js";
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import PageSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/page.schema.json" with { type: "json" };
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";

const definition = {name: "work", label: "Work Files", provider: "secure", options: {path: "/documents"}, credentials: {token: "private"}};
const providers = [
    {id: "secure", label: "Secure", defaults: {path: "/default", readonly: false}, optionsSchema: {type: "object"}, credentialsSchema: {type: "object", properties: {token: {type: "string", writeOnly: true}}}},
    {id: "mem", label: "Memory", defaults: {instance: null}, optionsSchema: {type: "object"}, credentialsSchema: null}
];

function createManager({dialogResult = null, confirmResult = null} = {}) {
    // Record only the Filesystems and Dialog boundaries used by the manager Page.
    const state = structuredClone(FilesystemsPage.state);
    const calls = {list: 0, remove: [], open: [], confirm: []};
    const filesystems = {
        async listDefinitions() { calls.list++; return [definition]; },
        async removeDefinition(name) { calls.remove.push(name); }
    };
    const dialog = {
        async open(options) { calls.open.push(options); return dialogResult; },
        async confirm(options) { calls.confirm.push(options); return confirmResult; }
    };
    const controller = FilesystemsPage.controller({state, filesystems, dialog});
    return {state, calls, controller};
}

function createDetail({filesystemName = "", validationErrors = []} = {}) {
    // Provide generated-schema validators and capture the generic Filesystems editor calls.
    const state = {...structuredClone(FilesystemDetailPage.state), filesystemName};
    const calls = {listProviders: 0, getDefinition: [], saveDefinition: [], close: []};
    const filesystems = {
        async listProviders() { calls.listProviders++; return structuredClone(providers); },
        async getDefinition(name) { calls.getDefinition.push(name); return name === definition.name ? structuredClone(definition) : null; },
        async saveDefinition(...args) { calls.saveDefinition.push(structuredClone(args)); }
    };
    const editors = {
        optionsEditor: {validate() { return structuredClone(validationErrors); }},
        credentialsEditor: {validate() { return structuredClone(validationErrors); }}
    };
    const page = {
        host: {querySelector(selector) { return editors[selector.match(/ref="([^"]+)"/)?.[1]] ?? null; }},
        async close(result) { calls.close.push(result); }
    };
    const controller = FilesystemDetailPage.controller({state, filesystems, page});
    return {state, calls, controller};
}

test("Filesystem preference Pages satisfy the Page schema and keep storage Services private", () => {
    // Validate both definitions and ensure only the detail Page exposes editor context.
    for (const [page, properties] of [[FilesystemsPage, []], [FilesystemDetailPage, ["filesystemName"]]]) {
        const result = new JsonValidator().validate({...page, controller: {}}, PageSchema, {"./contract.schema.json": ContractSchema});
        assert.equal(result.valid, true, JSON.stringify(result.errors));
        assert.deepEqual(Object.keys(page.contract.properties ?? {}), properties);
    }
    assert.match(FilesystemsPage.controller.toString(), /^controller\(\{state, filesystems, dialog\}\)/u);
    assert.match(FilesystemDetailPage.controller.toString(), /^controller\(\{state, filesystems, page\}\)/u);
});

test("Filesystem manager loads, opens add and edit dialogs, and refreshes only after saves", async () => {
    // Exercise list loading and the save-result refresh contract for both editor entry points.
    const saved = createManager({dialogResult: {saved: true}});
    await saved.controller.load();
    await saved.controller.add();
    await saved.controller.edit({event: {detail: {value: "work"}, currentTarget: {dataset: {}}}});
    assert.deepEqual(saved.state.items, [definition]);
    assert.deepEqual(saved.calls.open, [
        {href: "page:x-filesystem:/pages/preferences/filesystems-detail.js", title: "Add filesystem", context: {}},
        {href: "page:x-filesystem:/pages/preferences/filesystems-detail.js", title: "Edit filesystem", context: {filesystemName: "work"}}
    ]);
    assert.equal(saved.calls.list, 3);

    const cancelled = createManager();
    await cancelled.controller.load();
    await cancelled.controller.add();
    assert.equal(cancelled.calls.list, 1);
});

test("Filesystem manager confirms before removal and refreshes only after deletion", async () => {
    // Keep cancellation side-effect free and route confirmed removal through Filesystems.
    for (const [confirmResult, removed] of [[null, false], ["yes", true]]) {
        const {calls, controller} = createManager({confirmResult});
        await controller.load();
        await controller.remove({event: {currentTarget: {dataset: {name: "work"}}}});
        assert.deepEqual(calls.confirm, [{title: "Delete filesystem", message: "Delete filesystem 'Work Files'?"}]);
        assert.deepEqual(calls.remove, removed ? ["work"] : []);
        assert.equal(calls.list, removed ? 2 : 1);
    }
});

test("Filesystem detail selects Memory for new definitions and switches provider-driven schemas", async () => {
    // Initialize the preferred provider, then prove a provider change replaces schemas and defaults.
    const {state, calls, controller} = createDetail();
    await controller.load();
    assert.equal(calls.listProviders, 1);
    assert.deepEqual(calls.getDefinition, []);
    assert.equal(state.provider, "mem");
    assert.deepEqual(state.providerDomain, [{value: "secure", label: "Secure"}, {value: "mem", label: "Memory"}]);
    assert.deepEqual(state.options, {instance: null});
    assert.equal(state.credentialsSchema, null);

    state.provider = "secure";
    controller.providerChanged();
    assert.deepEqual(state.optionsSchema, providers[0].optionsSchema);
    assert.deepEqual(state.credentialsSchema, providers[0].credentialsSchema);
    assert.deepEqual(state.options, providers[0].defaults);
    assert.match(FilesystemDetailPage.template, /x-prop:schema="state\.optionsSchema"/u);
    assert.match(FilesystemDetailPage.template, /x-if="state\.credentialsSchema"[\s\S]*x-prop:schema="state\.credentialsSchema"/u);
});

test("Filesystem detail loads existing values, merges defaults, and locks identity fields", async () => {
    // Overlay authored options and credentials without mutating provider metadata.
    const {state, calls, controller} = createDetail({filesystemName: "work"});
    await controller.load();
    assert.deepEqual(calls.getDefinition, ["work"]);
    assert.equal(state.editing, true);
    assert.equal(state.name, "work");
    assert.equal(state.provider, "secure");
    assert.deepEqual(state.options, {path: "/documents", readonly: false});
    assert.deepEqual(state.credentials, {token: "private"});
    assert.deepEqual(providers[0].defaults, {path: "/default", readonly: false});
    assert.equal((FilesystemDetailPage.template.match(/state\.busy \|\| state\.editing/gu) ?? []).length, 2);
});

test("Filesystem detail validates generated schemas before saving", async () => {
    // Prevent Service calls when either generated editor reports a validation error.
    const {state, calls, controller} = createDetail({filesystemName: "work", validationErrors: [{label: "Schema", message: "Token is required."}]});
    await controller.load();
    await controller.save();
    assert.deepEqual(calls.saveDefinition, []);
    assert.match(state.error, /Token is required/u);
});

test("Filesystem detail saves through Filesystems and clears credentials on every close path", async () => {
    // Pass detached provider data, return the saved identity, and discard sensitive Page state.
    const saved = createDetail({filesystemName: "work"});
    await saved.controller.load();
    saved.controller.optionsChanged({event: {detail: {newValue: {path: "/updated", readonly: true}}}});
    saved.controller.credentialsChanged({event: {detail: {newValue: {token: "replacement"}}}});
    await saved.controller.save();
    assert.deepEqual(saved.calls.saveDefinition, [[
        {name: "work", label: "Work Files", provider: "secure", options: {path: "/updated", readonly: true}},
        {token: "replacement"}
    ]]);
    assert.deepEqual(saved.calls.close, [{saved: true, name: "work"}]);
    assert.deepEqual(saved.state.credentials, {});

    const cancelled = createDetail({filesystemName: "work"});
    await cancelled.controller.load();
    await cancelled.controller.cancel();
    assert.deepEqual(cancelled.calls.close, [null]);
    assert.deepEqual(cancelled.state.credentials, {});

    const unloaded = createDetail({filesystemName: "work"});
    await unloaded.controller.load();
    unloaded.controller.unload();
    assert.deepEqual(unloaded.state.credentials, {});
});

test("Filesystem detail omits credentials for providers without a credential schema", async () => {
    // Preserve existing credentials semantics by passing undefined when the selected provider has no credential form.
    const {state, calls, controller} = createDetail();
    await controller.load();
    Object.assign(state, {name: "scratch", label: "", options: {instance: "scratch"}});
    await controller.save();
    assert.deepEqual(calls.saveDefinition, [[
        {name: "scratch", label: "scratch", provider: "mem", options: {instance: "scratch"}},
        undefined
    ]]);
    assert.deepEqual(calls.close, [{saved: true, name: "scratch"}]);
});
