import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import test from "node:test";

import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import Menus from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/menus.js";
import MenuShortcuts from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/menu-shortcuts.js";
import { getEventShortcut, parseShortcut } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/utils/keyboard-shortcut.js";

function createRuntime(t, definitions = {}, options = {}) {
    // Compose real menus and simulate a key bubbling from an application Page to its document.
    const document = Object.assign(new EventTarget(), {body: {}});
    const pageHost = Object.assign(new EventTarget(), {localName: "x-page", page: {src: "/main/home"}, appendChild() {}});
    const bus = Object.assign(new EventTarget(), {emit(type, detail) { this.dispatchEvent(new CustomEvent(type, {detail})); }});
    const config = {xshell: {assets: {basePath: "/_assets"}}, modules: {}};
    const areas = new Areas({config, bus}, {default: null, definitions: {}, ...options});
    const menus = new Menus({areas, bus, config}, {definitions});
    const navigation = {
        getXPages: () => [pageHost], getXPageFromElement: () => pageHost,
        navigate: t.mock.fn(async () => {}), buildUrlAbsolute: t.mock.fn(link => "/app" + link.href)
    };
    const nativeClicks = [];
    document.createElement = () => ({click() { nativeClicks.push([this.href, this.target]); }, remove() {}});
    const shortcuts = new MenuShortcuts({menus, bus, document, navigation});
    t.after(() => shortcuts.dispose());
    const commands = [];
    pageHost.addEventListener("command", event => commands.push(event.detail));
    return {
        menus, bus, document, pageHost, shortcuts, commands, navigation, nativeClicks,
        init() {
            menus.init();
            shortcuts.init();
        },
        press(key, props = {ctrlKey: true}, path = [pageHost, document.body, document]) {
            const {defaultPrevented, ...modifiers} = props;
            const event = Object.assign(new Event("keydown", {cancelable: true}), {key, ...modifiers, composedPath: () => path});
            if (defaultPrevented) event.preventDefault();
            document.dispatchEvent(event);
            return event.defaultPrevented;
        }
    };
}

test("shortcut syntax normalizes modifier order and case and uses the logical event key", () => {
    assert.deepEqual(["Ctrl+K", " shift + CTRL + p ", "Alt+F", "Meta+K", "Ctrl+,", "Ctrl+Plus", "ctrl+space", "Alt+F24"].map(parseShortcut),
        ["Ctrl+K", "Ctrl+Shift+P", "Alt+F", "Meta+K", "Ctrl+,", "Ctrl+Plus", "Ctrl+Space", "Alt+F24"]);
    for (const invalid of [null, 1, "", "K", "Ctrl", "Mod+K", "Control+K", "Ctrl+Meta", "Ctrl++", "Ctrl+K+P",
        "Ctrl+K Ctrl+P", "Ctrl+Ctrl+K", "Ctrl+Unidentified", "Ctrl+Dead", "Ctrl+F25", "Ctrl+Arrow Up"]) {
        assert.equal(parseShortcut(invalid), null, String(invalid));
    }
    assert.equal(getEventShortcut({key: "k", code: "KeyX", ctrlKey: true}), "Ctrl+K");
    assert.equal(getEventShortcut({key: "K", ctrlKey: true, shiftKey: true}), "Ctrl+Shift+K");
    assert.equal(getEventShortcut({key: "k", metaKey: true}), "Meta+K");
    assert.equal(getEventShortcut({key: "Control", ctrlKey: true}), null);
    assert.equal(getEventShortcut({key: "k", ctrlKey: true, altKey: true, getModifierState: key => key === "AltGraph"}), null);
});

test("nested shortcuts activate only in their selected Area or in global scope", t => {
    const global = {scope: "global", items: [{id: "search", label: "Search", command: "search", shortcut: ["Ctrl+K", "Meta+K"]}]};
    const tools = {items: [{id: "group", label: "Tools", children: [
        {id: "report", label: "Report", href: "/report.js", path: "/report", open: "stack", shortcut: "Ctrl+Shift+P"}
    ]}]};
    const help = {items: [{label: "Help", shortcut: "Ctrl+Shift+P", href: "/help.js", open: "dialog"}]};
    const runtime = createRuntime(t, {global, tools, help}, {default: "main", definitions: {
        main: {prefix: "/main", menus: {tools: "tools"}}, other: {prefix: "/other", menus: {tools: "help"}}
    }});
    const {menus, bus, commands, press, navigation, pageHost} = runtime;
    runtime.init();
    const shared = menus.getMenu("global");
    assert.equal(shared, menus.getMenu("global", "other"));
    assert.deepEqual(shared.items[0].shortcut, ["Ctrl+K", "Meta+K"]);
    assert.notStrictEqual(shared.items[0].shortcut, global.items[0].shortcut);
    assert.ok(Object.isFrozen(shared.items[0].shortcut));
    assert.equal(Object.isFrozen(global.items[0].shortcut), false);
    assert.equal(menus.getMenu("tools").items[0].children[0].shortcut, "Ctrl+Shift+P");
    assert.equal(press("k"), true);
    assert.equal(press("K", {ctrlKey: true, shiftKey: true}), false);
    assert.equal(press("k", {metaKey: true}), true);
    assert.deepEqual(commands, [{command: "search", data: {}}, {command: "search", data: {}}]);
    assert.equal(press("p", {altKey: true}), false);
    assert.equal(press("P", {ctrlKey: true, shiftKey: true}), true);
    assert.deepEqual(navigation.navigate.mock.calls[0].arguments[0], {href: "/main/report", page: pageHost.page, open: "stack", outlet: null});
    bus.emit("xshell:navigation:end", {src: "/other/home"});
    assert.equal(press("P", {ctrlKey: true, shiftKey: true}), true);
    assert.equal(navigation.navigate.mock.calls[1].arguments[0].href, "/other/help.js");
    assert.equal(navigation.navigate.mock.calls[1].arguments[0].open, "dialog");
    assert.equal(press("k"), true);
});

test("collisions suppress all active claimants and refresh when live menus change", t => {
    const warn = t.mock.method(console, "warn", () => {});
    const runtime = createRuntime(t, {
        global: {scope: "global", items: [
            {label: "One", shortcut: ["Ctrl+K", "Meta+K"], command: "one"}, {label: "Two", shortcut: "ctrl+k", command: "two"},
            {label: "Actions", shortcut: "Ctrl+L", command: "actions"},
            {label: "Report", shortcut: ["Ctrl+R", "ctrl+r"], command: "report"}
        ]},
        globalOther: {scope: "global", items: [{label: "Other actions", shortcut: "Ctrl+L", command: "other"}]},
        areaOne: {items: [{label: "Live", childrenSource: "live"}]},
        areaTwo: {items: [{label: "Area action", shortcut: "Ctrl+P", command: "area"}]}
    }, {default: "main", definitions: {main: {prefix: "/main", menus: {areaOne: "areaOne", areaTwo: "areaTwo"}}, other: {prefix: "/other"}}});
    let children = [
        {label: "First report", shortcut: "ctrl+r", command: "first"},
        {label: "Local action", shortcut: "Ctrl+P", command: "local"},
        {label: "Partially valid", shortcut: ["Mod+Q", "Alt+Q"], command: "partially-valid"}
    ];
    const source = {resolve: () => children, dependsOn: ["test:update"]};
    runtime.menus.registerSource("live", source);
    runtime.init();
    for (const key of ["k", "l", "r", "p", "q"]) assert.equal(runtime.press(key), false, key);
    assert.equal(runtime.press("k", {metaKey: true}), true);
    assert.equal(runtime.press("q", {altKey: true}), true);
    assert.deepEqual(warn.mock.calls.map(call => call.arguments[0].match(/^(Invalid menu shortcut "Mod\+Q"|Conflicting menu shortcut '[^']+')/)[0]).sort(),
        ["Conflicting menu shortcut 'Ctrl+K'", "Conflicting menu shortcut 'Ctrl+L'", "Conflicting menu shortcut 'Ctrl+P'",
            "Conflicting menu shortcut 'Ctrl+R'", 'Invalid menu shortcut "Mod+Q"']);
    runtime.bus.emit("xshell:menus:change", {});
    assert.equal(warn.mock.callCount(), 5);
    runtime.bus.emit("xshell:navigation:end", {src: "/other/home"});
    assert.equal(runtime.press("r"), true);
    assert.equal(runtime.press("p"), false);
    runtime.bus.emit("xshell:navigation:end", {src: "/main/home"});
    assert.equal(runtime.press("r"), false);

    children = [{label: "Refreshed", shortcut: ["Ctrl+J", "Meta+J"], command: "refreshed"}];
    assert.equal(source.refresh(), true);
    assert.deepEqual(runtime.menus.getMenu("areaOne").items[0].children[0].shortcut, ["Ctrl+J", "Meta+J"]);
    for (const key of ["r", "p", "j"]) assert.equal(runtime.press(key), true);
    assert.equal(runtime.press("j", {metaKey: true}), true);
    children = [{label: "Refreshed", shortcut: "Ctrl+P", command: "refreshed"}];
    runtime.bus.emit("test:update", {});
    assert.equal(runtime.press("j"), false);
    assert.equal(runtime.press("j", {metaKey: true}), false);
    assert.equal(runtime.press("p"), false);
});

test("keydown preserves editing, composition, repetition, disabled actions, and non-application input", t => {
    const items = [
        {label: "Allowed in input", command: "typing", shortcut: "Ctrl+K"},
        {label: "Copy", command: "copy", shortcut: "Ctrl+C"},
        {label: "Alt", command: "alt", shortcut: "Alt+F"},
        {label: "Arrow", command: "arrow", shortcut: "Ctrl+ArrowLeft"},
        {label: "Disabled", command: "disabled", shortcut: "Ctrl+D", disabled: true},
        {label: "Unavailable submenu", shortcut: "Ctrl+B", children: [{label: "Child", command: "child"}]}
    ];
    const runtime = createRuntime(t, {global: {scope: "global", items}});
    const {document, pageHost, press, commands} = runtime;
    runtime.init();
    for (const editor of [{localName: "input"}, {localName: "textarea"}, {isContentEditable: true}]) {
        const path = [editor, {}, pageHost, document.body, document];
        assert.equal(press("k", {}, path), false);
        assert.equal(press("k", {ctrlKey: true}, path), true);
        assert.equal(press("c", {ctrlKey: true}, path), false);
        assert.equal(press("ArrowLeft", {ctrlKey: true}, path), false);
        assert.equal(press("f", {altKey: true}, path), false);
    }
    assert.equal(press("k", {ctrlKey: true, repeat: true}), false);
    assert.equal(press("k", {ctrlKey: true, isComposing: true}), false);
    assert.equal(press("k", {ctrlKey: true, defaultPrevented: true}), true);
    assert.equal(press("k", {ctrlKey: true}, [{localName: "input"}, document.body, document]), false);
    assert.equal(press("k", {ctrlKey: true}, [{localName: "input"}, {localName: "x-page"}, {}]), false);
    assert.equal(press("d"), false);
    assert.equal(press("b"), false);
    assert.equal(press("k", {ctrlKey: true}, [document.body, document]), true);
    assert.deepEqual(commands.map(event => event.command), Array(4).fill("typing"));
});

test("presenters take precedence, browser targets are retained, and disposal releases listeners", t => {
    const items = [
        {label: "Presented", command: "visible", shortcut: "Ctrl+K"},
        {label: "Tab", href: "/report", target: "_blank", shortcut: "Ctrl+T"}
    ];
    const runtime = createRuntime(t, {global: {scope: "global", items}});
    const {menus, bus, document, shortcuts, press, commands, nativeClicks} = runtime;
    runtime.init();
    shortcuts.init();
    assert.equal(getEventListeners(document, "keydown").length, 1);
    assert.equal(getEventListeners(bus, "xshell:menus:change").length, 1);
    const activate = t.mock.fn(() => true);
    const host = {isConnected: true, ownerDocument: document};
    const remove = shortcuts.registerPresenter(menus.getMenu("global").items[0], host, activate);
    assert.equal(press("k"), true);
    assert.equal(activate.mock.callCount(), 1);
    assert.deepEqual(commands, []);
    remove();
    assert.equal(press("k"), true);
    assert.deepEqual(commands, [{command: "visible", data: {}}]);
    assert.equal(press("t"), true);
    assert.deepEqual(nativeClicks, [["/app/report", "_blank"]]);
    shortcuts.dispose();
    assert.equal(getEventListeners(document, "keydown").length, 0);
    assert.equal(getEventListeners(bus, "xshell:menus:change").length, 0);
    assert.equal(getEventListeners(bus, "xshell:area:change").length, 0);
    assert.equal(press("k"), false);
});
