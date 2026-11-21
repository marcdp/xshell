import assert from "node:assert/strict";
import test from "node:test";

import filesystemDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/components/x-filesystem.js";
import Filesystems from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/services/filesystems.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";

const commands = [
    { id: "command:filesystem.entry.encrypt.aes", label: "Encrypt", icon: "x-lock", type: "file", extensions: ["txt"], actions: [] },
    { id: "command:filesystem.entry.zip", label: "Download as ZIP", icon: "x-zip", type: "entry", actions: [] }
];
const editors = {
    text: { page: "page:x-filesystem:/pages/editor-text.js", label: "Open", icon: "x-preview", extensions: ["txt", "txt.aes", "md"] },
    image: { page: "page:x-filesystem:/pages/editor-image.js", label: "Open", icon: "x-preview", extensions: ["png", "png.aes"] },
    iframe: { page: "page:x-filesystem:/pages/editor-iframe.js", label: "Open", icon: "x-preview", extensions: ["pdf"] }
};

function createController() {
    // Create a focused controller harness with real editor selection and captured navigation.
    const state = structuredClone(filesystemDefinition.state);
    state.src = "mem:";
    const navigationCalls = [];
    const contextMenuCalls = [];
    const filesystems = new Filesystems({ loader: { load() {} } }, { commands, editors });
    const host = {
        shadowRoot: {
            querySelector(selector) {
                if (selector === "x-contextmenu") return { open(options) { contextMenuCalls.push(options); } };
                return null;
            }
        }
    };
    const controller = filesystemDefinition.controller({
        state,
        events: { on() {} },
        loader: { async load(resource) { return { resource }; } },
        navigation: { navigate(options) { navigationCalls.push(options); } },
        getPage() { return { id: "filesystem-page" }; },
        host,
        dialog: {},
        tasks: {},
        resolver: {},
        filesystems
    });
    return { state, controller, navigationCalls, contextMenuCalls };
}

test("Filesystems options validate separate commands and keyed editors", () => {
    // Accept the new shape while rejecting arrays, incomplete descriptors, and dotted extension spelling.
    const validator = new JsonValidator();
    assert.equal(validator.validate({ commands, editors }, Filesystems.optionsSchema).valid, true);
    assert.equal(validator.validate({ commands, editors: [] }, Filesystems.optionsSchema).valid, false);
    assert.equal(validator.validate({ editors: { text: { label: "Open", extensions: ["txt"] } } }, Filesystems.optionsSchema).valid, false);
    assert.equal(validator.validate({ editors: { text: { page: "/editor.js", label: "Open", extensions: [".txt"] } } }, Filesystems.optionsSchema).valid, false);
});

test("Filesystems exposes defensive command and editor snapshots", () => {
    // Verify editor definitions remain independent from explicit filesystem Commands.
    const filesystems = new Filesystems({ loader: { load() {} } }, { commands, editors });
    const commandSnapshot = filesystems.commands;
    const editorSnapshot = filesystems.editors;
    commandSnapshot.push({ id: "page:editor", label: "Open", type: "file", extensions: ["txt"], actions: ["open"] });
    editorSnapshot.text.page = "/changed.js";
    editorSnapshot.extra = editorSnapshot.text;

    assert.deepEqual(filesystems.commands, commands);
    assert.deepEqual(filesystems.editors, editors);
    assert.equal(filesystems.commands.some(command => command.id.startsWith("page:")), false);
});

test("getEditor selects simple and compound extensions deterministically", () => {
    // Prefer the longest extension and stable editor ID without accepting arbitrary suffixes.
    const configuredEditors = structuredClone(editors);
    configuredEditors.fallback = { page: "/fallback.js", label: "Open", extensions: ["aes", "txt"] };
    configuredEditors.alternate = { page: "/alternate.js", label: "Open", extensions: ["pdf"] };
    const filesystems = new Filesystems({ loader: { load() {} } }, { editors: configuredEditors });

    assert.equal(filesystems.getEditor("/notes/readme.txt").page, "/fallback.js");
    assert.equal(filesystems.getEditor("/notes/secret.TXT.AES").page, editors.text.page);
    assert.equal(filesystems.getEditor("/images/photo.png.aes").page, editors.image.page);
    assert.equal(filesystems.getEditor("/documents/report.pdf").page, "/alternate.js");
    assert.equal(filesystems.getEditor("/documents/report.notpdf"), null);
    assert.equal(filesystems.getEditor("/documents/pdf"), null);

    const selected = filesystems.getEditor("/notes/secret.txt.aes");
    selected.page = "/changed.js";
    assert.equal(filesystems.getEditor("/notes/secret.txt.aes").page, editors.text.page);
});

test("filesystem opening uses editors for files and navigation for directories", () => {
    // Preserve stack Page parameters for files and directory history for folders.
    const { state, controller, navigationCalls } = createController();
    controller.open([{ type: "file", path: "/notes/readme.txt" }]);
    assert.deepEqual(navigationCalls, [{
        href: editors.text.page,
        page: { id: "filesystem-page" },
        params: { src: "mem:", path: "/notes/readme.txt" },
        open: "stack"
    }]);

    controller.open([{ type: "directory", path: "/notes" }]);
    assert.equal(state.pathList, "/notes");
    assert.deepEqual(state.history, ["/", "/notes"]);
    assert.equal(navigationCalls.length, 1);
});

test("context-menu Open is independent from explicit Commands and is not duplicated", () => {
    // Populate one editor action plus matching explicit Commands, then exercise both execution paths.
    const { state, controller, navigationCalls, contextMenuCalls } = createController();
    const entry = { type: "file", path: "/notes/readme.txt" };
    controller.onContextMenuEntry({ event: { detail: { entry, entries: [entry], x: 10, y: 20 } } });

    assert.equal(state.editor.page, editors.text.page);
    assert.deepEqual(state.commands.map(command => command.id), commands.map(command => command.id));
    assert.deepEqual(contextMenuCalls, [{ x: 10, y: 20 }]);
    assert.equal((filesystemDefinition.template.match(/command="open"/g) ?? []).length, 1);

    controller.onCommand({ event: { detail: { command: "open" }, target: {} } });
    assert.equal(navigationCalls.length, 1);
    assert.equal(navigationCalls[0].href, editors.text.page);

    controller.onCommand({ event: { detail: { command: "customCommand" }, target: { dataset: { command: commands[0].id } } } });
    assert.equal(navigationCalls.length, 2);
    assert.equal(navigationCalls[1].href, "page:x:/pages/invoke.js");
    assert.equal(navigationCalls[1].params.id, "filesystem.entry.encrypt.aes");
});
