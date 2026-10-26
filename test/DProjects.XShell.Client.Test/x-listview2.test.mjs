import assert from "node:assert/strict";
import test from "node:test";

import listViewDefinition, { contract } from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-listview2.js";
import columnDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-listview2-column.js";
import itemDefinition, { contract as itemContract } from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-listview2-item.js";

class TestCustomEvent {
    constructor(type, options = {}) {
        this.type = type;
        Object.assign(this, options);
    }
}

class TestMutationObserver {
    static instances = [];

    constructor(callback) {
        this.callback = callback;
        TestMutationObserver.instances.push(this);
    }

    observe(target, options) {
        this.target = target;
        this.options = options;
    }

    disconnect() {
        this.disconnected = true;
    }
}

globalThis.CustomEvent ??= TestCustomEvent;
globalThis.MutationObserver = TestMutationObserver;

function createAttributeHost(localName, attributes = {}) {
    const values = new Map(Object.entries(attributes).map(([name, value]) => [name, String(value)]));
    return {
        localName,
        getAttribute(name) { return values.has(name) ? values.get(name) : null; },
        setAttribute(name, value) { values.set(name, String(value)); },
        removeAttribute(name) { values.delete(name); },
        toggleAttribute(name, force) {
            if (force) values.set(name, "");
            else values.delete(name);
        },
        hasAttribute(name) { return values.has(name); }
    };
}

function createItem(label, attributes = {}) {
    const item = createAttributeHost("x-listview2-item", attributes);
    item.label = label;
    item.category = attributes.category || "";
    item.href = attributes.href || "";
    item.selected = Boolean(attributes.selected);
    item.events = [];
    item.dispatchEvent = event => { item.events.push(event); return true; };
    item.scrollIntoView = options => { item.scrolled = options; };
    item.activate = () => { item.activated = true; };
    item.shadowRoot = {
        querySelector() { return null; }
    };
    return item;
}

function createColumn(width) {
    return createAttributeHost("x-listview2-column", width === undefined ? {} : {width});
}

function createListView(options = {}) {
    const items = options.items || [];
    const columns = options.columns || [];
    const head = createAttributeHost("x-listview2-head");
    const body = createAttributeHost("x-listview2-body");
    const listeners = new Map();
    const styles = new Map();
    const collection = {focus() { this.focused = true; }};
    const host = {
        style: {
            setProperty(name, value) { styles.set(name, value); },
            removeProperty(name) { styles.delete(name); }
        },
        shadowRoot: {
            querySelector(selector) { return selector === '[ref="items"]' ? collection : null; }
        },
        addEventListener(name, listener) { listeners.set(name, listener); },
        removeEventListener(name, listener) {
            if (listeners.get(name) === listener) listeners.delete(name);
        },
        querySelector(selector) {
            if (selector === ":scope > x-listview2-head") return head;
            if (selector === ":scope > x-listview2-body") return body;
            return null;
        },
        querySelectorAll(selector) {
            if (selector === ":scope > x-listview2-head > x-listview2-column") return columns;
            if (selector === ":scope > x-listview2-body > x-listview2-item") return items;
            return [];
        },
        checkVisibility() { return true; }
    };
    const state = {
        view: options.view ?? contract.properties.view.default,
        views: options.views ?? contract.properties.views.default,
        multiple: options.multiple ?? contract.properties.multiple.default,
        autoScroll: options.autoScroll ?? contract.properties.autoScroll.default,
        availableViews: []
    };
    const events = {on() {}};
    const controller = listViewDefinition.controller({state, events, host});
    return {body, collection, columns, controller, head, host, items, listeners, state, styles};
}

function pointerEvent(path) {
    return {
        target: path[0],
        composedPath() { return path; },
        preventDefault() { this.defaultPrevented = true; }
    };
}

test("x-listview2 defaults to list and preserves each supported explicit view", () => {
    assert.equal(contract.properties.view.default, "list");
    for (const view of ["list", "details", "icons", "tiles"]) {
        const {controller, state} = createListView({view});
        controller.refreshViews();
        assert.equal(state.view, view);
    }
});

test("x-listview2 normalizes, validates, and deduplicates selectable views", () => {
    const {controller, state} = createListView({view:"tiles", views:" LIST, details, list, nope, icons "});
    controller.refreshViews();
    assert.deepEqual(state.availableViews, ["list", "details", "icons"]);
    assert.equal(state.view, "list");
});

test("x-listview2 renders the selector only for two or more normalized views", () => {
    assert.match(listViewDefinition.template, /state\.availableViews\.length > 1/);
    assert.match(listViewDefinition.template, /<x-dropdown/);
    assert.match(listViewDefinition.template, /<x-menuitem/);
});

test("changing views preserves item selection and propagates presentation state", () => {
    const selected = createItem("Selected", {selected:true});
    const other = createItem("Other");
    const {body, controller, head, state} = createListView({items:[selected, other], view:"list", views:"list,details"});
    controller.refreshViews();
    state.view = "details";
    controller.refreshView();
    assert.equal(selected.selected, true);
    assert.equal(head.getAttribute("data-view"), "details");
    assert.equal(body.getAttribute("data-view"), "details");
    assert.equal(selected.getAttribute("data-view"), "details");
});

test("details grid tracks use declarative widths and the default track", () => {
    const {controller, styles} = createListView({columns:[
        createColumn("minmax(12em, 2fr)"),
        createColumn(),
        createColumn("8em")
    ]});
    controller.refresh();
    assert.equal(styles.get("--x-listview2-grid-template-columns"), "minmax(12em, 2fr) minmax(0, 1fr) 8em");
});

test("column headers accept arbitrary default-slot content with a label fallback", () => {
    assert.match(columnDefinition.template, /<slot>[\s\S]*state\.label[\s\S]*<\/slot>/);
    assert.match(columnDefinition.style, /::slotted\(\*\)/);
    assert.match(columnDefinition.style, /\.content > span \{flex:1/);
});

test("single selection replaces the previous item and emits useful detail", () => {
    const first = createItem("First", {selected:true});
    const second = createItem("Second");
    const {controller} = createListView({items:[first, second]});
    controller.selectItem(second);
    assert.equal(first.selected, false);
    assert.equal(second.selected, true);
    assert.equal(second.events.at(-1).type, "select");
    assert.equal(second.events.at(-1).detail.index, 1);
    assert.deepEqual(second.events.at(-1).detail.selectedItems, [second]);
});

test("multiple selection toggles items independently", () => {
    const first = createItem("First");
    const second = createItem("Second");
    const {controller} = createListView({items:[first, second], multiple:true});
    controller.selectItem(first, {toggle:true});
    controller.selectItem(second, {toggle:true});
    assert.equal(first.selected, true);
    assert.equal(second.selected, true);
    controller.selectItem(first, {toggle:true});
    assert.equal(first.selected, false);
    assert.equal(second.selected, true);
});

test("keyboard navigation supports arrows, Home, End, Space, and Enter activation", () => {
    const items = [createItem("First"), createItem("Second"), createItem("Third", {href:"page.js"})];
    const {controller} = createListView({items});
    controller.activeItem = items[0];

    const down = pointerEvent([]);
    down.key = "ArrowDown";
    controller.keydown({event:down});
    assert.equal(items[1].selected, true);

    const end = pointerEvent([]);
    end.key = "End";
    controller.keydown({event:end});
    assert.equal(items[2].selected, true);

    const enter = pointerEvent([]);
    enter.key = "Enter";
    controller.keydown({event:enter});
    assert.equal(items[2].activated, true);
    assert.equal(items[2].events.some(event => event.type === "activate"), true);
    assert.equal(enter.defaultPrevented, true);
});

test("nested interactive controls do not change selection", () => {
    const item = createItem("Item");
    const button = {localName:"button", getRootNode() { return {}; }};
    const {controller, host} = createListView({items:[item]});
    controller.click({event:pointerEvent([button, item, host])});
    assert.equal(item.selected, false);
    assert.equal(item.events.length, 0);
});

test("details items expose the default slot for additional cells without duplicating templates", () => {
    assert.equal(itemContract.slots[""].description.length > 0, true);
    assert.equal((itemDefinition.template.match(/<slot><\/slot>/g) || []).length, 1);
    assert.equal((itemDefinition.template.match(/class="row"/g) || []).length, 1);
    assert.match(itemDefinition.style, /grid-template-columns: var\(--x-listview2-grid-template-columns\)/);
});

test("dynamic insertions and removals refresh indexes and grouping without overwriting category", async () => {
    const first = createItem("First", {category:"Documents"});
    const items = [first];
    const {controller} = createListView({items, view:"details"});
    await controller.load();
    const observer = TestMutationObserver.instances.at(-1);

    const second = createItem("Second", {category:"Documents"});
    items.push(second);
    observer.callback([{type:"childList"}]);
    await Promise.resolve();
    assert.equal(first.index, 0);
    assert.equal(second.index, 1);
    assert.equal(first.category, "Documents");
    assert.equal(second.category, "Documents");
    assert.equal(first.hasAttribute("data-category-visible"), true);
    assert.equal(second.hasAttribute("data-category-visible"), false);

    items.shift();
    observer.callback([{type:"childList"}]);
    await Promise.resolve();
    assert.equal(second.index, 0);
    await controller.unload();
});

test("hidden items neither consume category headings nor become auto-scroll targets", async () => {
    const hidden = createItem("Hidden", {category:"Documents", hidden:""});
    const visible = createItem("Visible", {category:"Documents"});
    const items = [hidden, visible];
    const {controller} = createListView({items, view:"details", autoScroll:true});
    await controller.load();

    assert.equal(hidden.hasAttribute("data-category-visible"), false);
    assert.equal(visible.hasAttribute("data-category-visible"), true);

    const anotherHidden = createItem("Also hidden", {hidden:""});
    items.push(anotherHidden);
    TestMutationObserver.instances.at(-1).callback([{type:"childList"}]);
    await new Promise(resolve => setTimeout(resolve, 35));
    assert.equal(anotherHidden.scrolled, undefined);
    await controller.unload();
});

test("load and unload attach and clean up observers and DOM listeners", async () => {
    const {controller, host, listeners} = createListView();
    await controller.load();
    const observer = TestMutationObserver.instances.at(-1);
    assert.equal(observer.target, host);
    assert.equal(observer.options.subtree, true);
    assert.deepEqual([...listeners.keys()].sort(), ["click", "dblclick", "keydown"]);
    await controller.unload();
    assert.equal(observer.disconnected, true);
    assert.equal(listeners.size, 0);
});

test("auto-scroll runs only when the item collection grows", async () => {
    const first = createItem("First");
    const items = [first];
    const {controller} = createListView({items, autoScroll:true});
    await controller.load();
    controller.refreshView();
    assert.equal(first.scrolled, undefined);

    const second = createItem("Second");
    items.push(second);
    TestMutationObserver.instances.at(-1).callback([{type:"childList"}]);
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 35));
    assert.deepEqual(second.scrolled, {block:"end", behavior:"smooth"});
    await controller.unload();
});
