import assert from "node:assert/strict";
import test from "node:test";

import menuDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-menu.js";
import menuItemDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-menuitem.js";
import pageMenuDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-page-menu.js";
import appMenuDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-app-menu.js";

const menuItemContract = menuItemDefinition.contract;

function createMenuItem({children = true, classes = [], horizontal = false, state: stateOverrides = {}} = {}) {
    const listeners = new Map();
    const documentListeners = new Map();
    const state = {expandOn: "auto", href: "", command: "", disabled: false, expanded: false, ...stateOverrides};
    const classList = {contains: name => classes.includes(name)};
    const owner = {};
    const host = {
        localName: "x-menuitem",
        classList,
        parentNode: owner,
        firstElementChild: children ? {} : null,
        shadowRoot: {querySelector: () => ({focus() { host.focused = true; }})},
        getBoundingClientRect: () => ({left: 10, width: 100}),
        addEventListener(name, listener, capture = false) { listeners.set(`${name}:${capture}`, listener); },
        removeEventListener(name, listener, capture = false) {
            if (listeners.get(`${name}:${capture}`) === listener) listeners.delete(`${name}:${capture}`);
        },
        dispatchEvent(event) { host.dispatched = event; return true; }
    };
    owner.parentNode = {host: {classList: {contains: name => horizontal && name === "horizontal"}}};
    const document = {
        addEventListener(name, listener, capture = false) { documentListeners.set(`${name}:${capture}`, listener); },
        removeEventListener(name, listener, capture = false) {
            if (documentListeners.get(`${name}:${capture}`) === listener) documentListeners.delete(`${name}:${capture}`);
        }
    };
    const controller = menuItemDefinition.controller({state, host});
    return {controller, document, documentListeners, host, listeners, owner, state};
}

function withMenuGlobals(document, action) {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    const previousCustomEvent = globalThis.CustomEvent;
    globalThis.document = document;
    globalThis.window = {innerWidth: 1000};
    globalThis.CustomEvent ??= class CustomEvent {
        constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
    };
    try { return action(); }
    finally {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousCustomEvent === undefined) delete globalThis.CustomEvent;
        else globalThis.CustomEvent = previousCustomEvent;
    }
}

function clickEvent(path, options = {}) {
    return {
        pointerType: options.pointerType,
        sourceCapabilities: options.sourceCapabilities,
        composedPath: () => path,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; }
    };
}

test("x-page-menu reads the effective navigation items and handles a missing menu", () => {
    const state = {};
    const items = [{ label: "Home", href: "/pages/index.js" }];
    let menu = { name: "navigation", label: "Navigation", description: "", icon: null, items };
    const controller = pageMenuDefinition.controller({ state, areas: { getMenu: () => menu } });
    controller.refresh();
    assert.equal(state.menu, items);
    menu = null;
    controller.refresh();
    assert.deepEqual(state.menu, []);
});

test("x-page-menu uses descriptions as tooltip fallbacks without overriding explicit tooltips", () => {
    assert.match(pageMenuDefinition.template, /x-attr:tooltip="menuitem\.tooltip \|\| menuitem\.description"/);
});

test("x-menu passes Page presentation properties and uses the canonical href for self-embedding", () => {
    assert.match(menuDefinition.template, /x-attr:tooltip="menuitem\.tooltip"/);
    assert.match(menuDefinition.template, /menuitem\.open == 'embed' && menuitem\.outlet == 'self' \? menuitem\.href : menuitem\.path \|\| menuitem\.href/);
    assert.match(menuDefinition.template, /x-attr:open="menuitem\.open"/);
    assert.match(menuDefinition.template, /x-attr:outlet="menuitem\.outlet"/);
    assert.doesNotMatch(menuDefinition.template, /embedded/);
});

test("x-menuitem exposes tooltip, open, and outlet as public attributes", () => {
    assert.deepEqual(menuItemContract.properties.tooltip, {
        type: "string",
        default: "",
        attribute: true,
        state: true,
        description: "Optional tooltip text shown on the navigation anchor."
    });
    assert.deepEqual(menuItemContract.properties.open, {
        type: "string",
        default: "auto",
        attribute: true,
        state: true,
        enum: ["auto", "top", "stack", "dialog", "dock", "embed"],
        description: "Determines how the target Page is presented."
    });
    assert.equal(menuItemContract.properties.outlet.default, "");
    assert.equal(Object.hasOwn(menuItemContract.properties, "embedded"), false);
    assert.equal(Object.keys(menuItemContract.properties).filter(name => name === "open").length, 1);
});

test("x-menuitem exposes configurable expansion and x-app-menu assigns root and nested modes", () => {
    assert.deepEqual(menuItemContract.properties.expandOn, {
        type: "string",
        default: "auto",
        attribute: true,
        state: true,
        enum: ["auto", "click", "hover"],
        description: "Determines how child menu items are expanded."
    });
    assert.match(appMenuDefinition.template, /x-attr:expand-on="indent == 0 \? 'click' : 'hover'"/);
});

test("x-menuitem resolves automatic, click, and hover expansion independently", () => {
    const ordinary = createMenuItem();
    assert.equal(ordinary.controller.expansionMode(), "hover");
    const inline = createMenuItem({classes: ["inline"]});
    assert.equal(inline.controller.expansionMode(), "click");
    const horizontal = createMenuItem({horizontal: true});
    assert.equal(horizontal.controller.expansionMode(), "click");
    const explicitClick = createMenuItem({state: {expandOn: "click"}});
    assert.equal(explicitClick.controller.expansionMode(), "click");
    const explicitHoverInline = createMenuItem({classes: ["inline"], state: {expandOn: "hover"}});
    assert.equal(explicitHoverInline.controller.expansionMode(), "hover");
});

test("x-menuitem expands only enabled parents and dismisses dropdowns outside or with Escape", () => {
    const item = createMenuItem({state: {expandOn: "click"}});
    withMenuGlobals(item.document, () => {
        item.controller.mount();
        item.controller.expand();
        assert.equal(item.state.expanded, true);
        assert.equal(item.documentListeners.has("pointerdown:true"), true);
        item.documentListeners.get("pointerdown:true")({composedPath: () => [item.host]});
        assert.equal(item.state.expanded, true);
        item.documentListeners.get("pointerdown:true")({composedPath: () => []});
        assert.equal(item.state.expanded, false);
        item.controller.expand();
        const escape = clickEvent([item.host]);
        escape.key = "Escape";
        item.listeners.get("keydown:false")(escape);
        assert.equal(item.state.expanded, false);
        assert.equal(item.host.focused, true);
        item.controller.unmount();
        assert.equal(item.listeners.size, 0);
        assert.equal(item.documentListeners.size, 0);
    });

    for (const blocked of [createMenuItem({children: false}), createMenuItem({state: {disabled: true}})]) {
        withMenuGlobals(blocked.document, () => blocked.controller.expand());
        assert.equal(blocked.state.expanded, false);
    }
});

test("x-menuitem click, hover, touch, sibling, and nested interactions use shared expansion paths", () => {
    const item = createMenuItem({state: {expandOn: "click"}});
    withMenuGlobals(item.document, () => {
        item.controller.mount();
        const click = clickEvent([item.host]);
        item.listeners.get("click:true")(click);
        assert.equal(item.state.expanded, true);
        assert.equal(click.defaultPrevented, true);
        item.listeners.get("click:true")(clickEvent([item.host]));
        assert.equal(item.state.expanded, false);

        item.controller.expand();
        const nested = {localName: "x-menuitem"};
        item.listeners.get("click:true")(clickEvent([nested, item.host]));
        assert.equal(item.state.expanded, false);

        item.controller.expand();
        item.controller.siblingExpanded({detail: {item: {parentNode: item.owner}}});
        assert.equal(item.state.expanded, false);
        item.controller.unmount();
    });

    const hover = createMenuItem({state: {expandOn: "hover"}});
    withMenuGlobals(hover.document, () => {
        hover.controller.mount();
        hover.listeners.get("mouseenter:false")();
        assert.equal(hover.state.expanded, true);
        hover.listeners.get("mouseleave:false")();
        assert.equal(hover.state.expanded, false);
        const touch = clickEvent([hover.host], {pointerType: "touch"});
        hover.listeners.get("click:true")(touch);
        assert.equal(hover.state.expanded, true);
        assert.equal(touch.defaultPrevented, true);
        hover.controller.unmount();
    });
});

test("x-menuitem preserves destination and command activation while providing an explicit submenu trigger", () => {
    const destination = createMenuItem({state: {expandOn: "click", href: "page:x:/pages/tasks.js"}});
    withMenuGlobals(destination.document, () => {
        destination.controller.mount();
        const activation = clickEvent([destination.host]);
        destination.listeners.get("click:true")(activation);
        assert.equal(activation.defaultPrevented, undefined);
        assert.equal(destination.state.expanded, true);
        destination.listeners.get("click:true")(clickEvent([destination.host]));
        assert.equal(destination.state.expanded, false);
        const indicator = clickEvent([destination.host]);
        destination.controller.expandTrigger({event: indicator});
        assert.equal(destination.state.expanded, true);
        assert.equal(indicator.defaultPrevented, true);
        destination.controller.unmount();
    });

    const commandParent = createMenuItem({state: {expandOn: "click", command: "refresh"}});
    withMenuGlobals(commandParent.document, () => {
        commandParent.controller.mount();
        commandParent.controller.expand();
        commandParent.controller.commandActivated({target: {}, composedPath: () => [commandParent.host]});
        assert.equal(commandParent.state.expanded, false);
        commandParent.controller.unmount();
    });
});


test("x-menuitem renders tooltip on a normal anchor and self-embeds a lazy Page without an additional anchor", () => {
    assert.match(
        menuItemDefinition.template,
        /<div x-elseif="state\.open == 'embed' && state\.outlet == 'self'">\s*<x-page\s+x-attr:src="state\.href"\s+layout="embed"\s+loading="lazy"><\/x-page>\s*<\/div>/
    );
    assert.match(menuItemDefinition.template, /<x-anchor x-else/);
    assert.doesNotMatch(menuItemDefinition.template, /state\.embedded/);

    assert.match(
        menuItemDefinition.template,
        /<x-anchor x-else[^>]*x-attr:tooltip="state\.tooltip"/
    );
});
