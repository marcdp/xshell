import assert from "node:assert/strict";
import test from "node:test";

import filesystemDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/components/x-filesystem.js";

function createController(pathList = "/") {
    const state = { ...structuredClone(filesystemDefinition.state), pathList };
    let srcChanged;
    const loaded = [];
    const controller = filesystemDefinition.controller({
        state,
        events: { on(target, name, handler) { if (name === "change:src") srcChanged = handler; } },
        loader: { async load(resource) { loaded.push(resource); return { resource }; } },
        navigation: { navigate() {} },
        getPage() { return {}; }
    });
    return { state, controller, loaded, getSrcChanged: () => srcChanged };
}

test("filesystem navigation tracks back and forward history", async () => {
    const { state, controller } = createController("/workspace");
    await controller.load();

    assert.deepEqual(state.history, ["/workspace"]);
    assert.equal(state.historyIndex, 0);

    controller.treeSelect({ event: { detail: { path: "/workspace/documents" } } });
    controller.listActivate({ event: { detail: { path: "/workspace/documents/reports", entry: { type: "directory" } } } });
    controller.up();
    assert.deepEqual(state.history, ["/workspace", "/workspace/documents", "/workspace/documents/reports", "/workspace/documents"]);

    controller.back();
    controller.back();
    assert.equal(state.pathList, "/workspace/documents");
    assert.equal(state.historyIndex, 1);

    controller.forward();
    assert.equal(state.pathList, "/workspace/documents/reports");
    assert.equal(state.historyIndex, 2);

    controller.navigateTo("/workspace/downloads");
    controller.navigateTo("/workspace/downloads");
    controller.navigateTo("");
    assert.deepEqual(state.history, ["/workspace", "/workspace/documents", "/workspace/documents/reports", "/workspace/downloads"]);
    assert.equal(state.historyIndex, 3);
});

test("file activation preserves directory history and source changes reset it", async () => {
    const navigationCalls = [];
    const state = structuredClone(filesystemDefinition.state);
    let srcChanged;
    const controller = filesystemDefinition.controller({
        state,
        events: { on(target, name, handler) { if (name === "change:src") srcChanged = handler; } },
        loader: { async load(resource) { return { resource }; } },
        navigation: { navigate(options) { navigationCalls.push(options); } },
        getPage() { return { id: "page" }; }
    });
    await controller.load();
    controller.navigateTo("/documents");

    controller.listActivate({ event: { detail: { path: "/documents/file.txt", entry: { type: "file" } } } });
    assert.deepEqual(state.history, ["/", "/documents"]);
    assert.equal(state.pathList, "/documents");
    assert.equal(navigationCalls.length, 1);

    state.src = "mem:other";
    await srcChanged();
    assert.deepEqual(state.history, ["/documents"]);
    assert.equal(state.historyIndex, 0);
    assert.deepEqual(state.filesystem, { resource: "filesystem:mem:other" });
});

test("filesystem toolbar disables unavailable history actions", () => {
    assert.match(filesystemDefinition.template, /x-on:click="back" x-attr:disabled="state\.historyIndex <= 0"/);
    assert.match(filesystemDefinition.template, /x-on:click="forward" x-attr:disabled="state\.historyIndex >= state\.history\.length - 1"/);
});
