import assert from "node:assert/strict";
import test from "node:test";

import PreferencesPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/preferences.js";

function createPage({mode = "manage", preferenceName = "", records = [], confirmResult = "yes", dialogResult = null} = {}) {
    // Create the controller with lightweight service and dialog doubles used by existing Page tests.
    const state = structuredClone(PreferencesPage.state);
    state.mode = mode;
    state.preferenceName = preferenceName;
    const calls = {list:[], set:[], delete:[], open:[], confirm:[], close:[], invalidate:0};
    const preferences = {
        async list(prefix = "") {
            calls.list.push(prefix);
            return records.filter(record => record.name.startsWith(prefix));
        },
        async set(name, value, options) { calls.set.push([name, value, options]); },
        async delete(name) { calls.delete.push(name); }
    };
    const page = {
        invalidate() { calls.invalidate++; },
        async close(value) { calls.close.push(value); }
    };
    const dialog = {
        async open(options) { calls.open.push(options); return dialogResult; },
        async confirm(options) { calls.confirm.push(options); return confirmResult; }
    };
    const controller = PreferencesPage.controller({state, page, preferences, dialog});
    return {calls, controller, state};
}

const record = {
    id:"550e8400-e29b-41d4-a716-446655440000",
    name:"x-editor:fontSize",
    label:"Editor Font Size",
    description:"Font size in pixels",
    createdAt:"2026-11-17T10:00:00.000Z",
    modifiedAt:"2026-11-17T10:30:00.000Z",
    revision:2,
    value:14
};

test("Preferences Page loads, summarizes, and prefix-filters records", async () => {
    // The manager strips raw values from reactive list state and exposes all required metadata columns.
    const native = {...record, id:"650e8400-e29b-41d4-a716-446655440000", name:"x-native:map", label:"Native map", value:new Map([["a", 1]])};
    const manager = createPage({records:[native, record]});
    await manager.controller.load();
    assert.deepEqual(manager.calls.list, [""]);
    assert.equal(manager.state.items.length, 2);
    assert.equal(manager.state.items[0].value, undefined);
    assert.equal(manager.state.items[0].valueSummary, "Map (1 entries)");
    assert.notEqual(manager.state.items[1].createdDisplay, "—");
    assert.notEqual(manager.state.items[1].modifiedDisplay, "—");
    assert.equal(manager.state.items[1].revision, 2);

    manager.state.prefix = "x-editor:";
    await manager.controller.refresh();
    assert.deepEqual(manager.calls.list, ["", "x-editor:"]);
    assert.deepEqual(manager.state.items.map(item => item.name), ["x-editor:fontSize"]);
    assert.match(PreferencesPage.template, /x-listview[\s\S]*label="Name"[\s\S]*label="Value"[\s\S]*label="Revision"[\s\S]*label="Created"[\s\S]*label="Modified"/u);
    assert.match(PreferencesPage.template, /x-empty[\s\S]*No preferences/u);
});

test("Preferences Page adds text and JSON preferences through the service", async () => {
    // Add mode checks duplicates, parses JSON explicitly, and supplies optional metadata.
    const add = createPage({mode:"add"});
    await add.controller.load();
    add.state.preferenceName = "x-editor:options";
    add.state.label = "Editor Options";
    add.state.description = "Local editor settings";
    add.state.valueType = "json";
    add.state.editorValue = "{\"tabSize\":4}";
    await add.controller.save();
    assert.deepEqual(add.calls.list, ["x-editor:options"]);
    assert.deepEqual(add.calls.set, [["x-editor:options", {tabSize:4}, {description:"Local editor settings", label:"Editor Options"}]]);
    assert.deepEqual(add.calls.close, [{saved:true}]);

    const invalid = createPage({mode:"add"});
    await invalid.controller.load();
    invalid.state.preferenceName = "invalid";
    invalid.state.valueType = "json";
    invalid.state.editorValue = "{";
    await invalid.controller.save();
    assert.match(invalid.state.error, /valid JSON/u);
    assert.deepEqual(invalid.calls.set, []);
});

test("Preferences Page edits JSON values while keeping preference names immutable", async () => {
    // Editable JSON records round-trip through the text editor and retain their Page context name.
    const jsonRecord = {...record, value:{fontSize:14}};
    const edit = createPage({mode:"edit", preferenceName:record.name, records:[jsonRecord]});
    await edit.controller.load();
    assert.equal(edit.state.valueType, "json");
    assert.equal(edit.state.readonlyValue, false);
    assert.match(edit.state.editorValue, /"fontSize": 14/u);
    edit.state.editorValue = "{\"fontSize\":16}";
    edit.state.description = "Updated";
    await edit.controller.save();
    assert.deepEqual(edit.calls.set, [[record.name, {fontSize:16}, {description:"Updated", label:record.label}]]);
    assert.deepEqual(edit.calls.close, [{saved:true}]);
    assert.match(PreferencesPage.template, /state\.mode == 'edit'[\s\S]*label="Name" readonly/u);
});

test("Preferences Page preserves browser-native values during metadata-only edits", async () => {
    // Unsupported editor types remain read-only and are passed back unchanged rather than stringified.
    const nativeValue = new Map([["workspace", {handle:"opaque"}]]);
    const nativeRecord = {...record, value:nativeValue};
    const edit = createPage({mode:"edit", preferenceName:record.name, records:[nativeRecord]});
    await edit.controller.load();
    assert.equal(edit.state.readonlyValue, true);
    assert.equal(edit.state.valueType, "readonly");
    assert.equal(edit.state.valueSummary, "Map (1 entries)");
    edit.state.label = "Workspace map";
    await edit.controller.save();
    assert.strictEqual(edit.calls.set[0][1], nativeValue);
    assert.deepEqual(edit.calls.set[0][2], {description:record.description, label:"Workspace map"});
    assert.match(PreferencesPage.template, /metadata edits preserve the original value/u);
});

test("Preferences Page opens editors and confirms deletion before refreshing", async () => {
    // Manager actions follow the established dialog Page and confirm-service conventions.
    const manager = createPage({records:[record], dialogResult:{saved:true}});
    await manager.controller.load();
    await manager.controller.edit({event:{currentTarget:{dataset:{name:record.name}}}});
    assert.deepEqual(manager.calls.open, [{
        href:"page:x:/pages/preferences.js",
        title:"Edit preference",
        context:{mode:"edit", preferenceName:record.name}
    }]);
    assert.deepEqual(manager.calls.list, ["", ""]);

    await manager.controller.remove({event:{currentTarget:{dataset:{name:record.name}}}});
    assert.deepEqual(manager.calls.confirm, [{title:"Delete preference", message:`Delete preference '${record.name}'?`}]);
    assert.deepEqual(manager.calls.delete, [record.name]);
    assert.deepEqual(manager.calls.list, ["", "", ""]);
});

test("Preferences Page leaves a preference intact when deletion is cancelled", async () => {
    // A non-affirmative confirmation result must not call the storage service.
    const manager = createPage({records:[record], confirmResult:"no"});
    await manager.controller.load();
    await manager.controller.remove({event:{currentTarget:{dataset:{name:record.name}}}});
    assert.deepEqual(manager.calls.delete, []);
    assert.equal(manager.state.busy, false);
});
