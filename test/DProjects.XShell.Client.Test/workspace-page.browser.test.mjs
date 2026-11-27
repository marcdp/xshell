import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

async function verifyWorkspace() {
    const [
        { default: workspace }, { default: menuitem }, { default: anchor }, { default: embedLayout }, { default: Areas }, { default: Menus },
        { default: Navigation }, { createXPageClass }, { createPageClassFromJsDefinition }, { createComponentClassFromJsDefinition },
        { default: renderEngine }, { default: stateEngine }
    ] = await Promise.all([
        "x/pages/workspace.js", "x/components/x-menuitem.js", "x/components/x-anchor.js", "x/layouts/x-layout-embed.js",
        "xshell/services/areas.js", "xshell/services/menus.js", "xshell/services/navigation.js", "xshell/x-page.js",
        "xshell/loaders/page-js.js", "xshell/loaders/component-js.js", "xshell/render-engines/x-client.js", "xshell/state-engines/proxy.js"
    ].map(path => import("/resources/" + path)));

    // Use actual Page, Component, renderer, and Navigation behavior with a small in-memory resource loader.
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const waitFor = async (condition, message) => {
        for (let attempt = 0; attempt < 50; attempt++) {
            if (condition()) return;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        throw new Error(message);
    };
    window.requestAnimationFrame = callback => setTimeout(callback, 0);
    const { mode, generation, item, entry = "direct" } = Object.fromEntries(new URLSearchParams(location.search));
    const basePath = "/app";
    const workspaceSrc = "/_assets/x/current/pages/workspace.js";
    const firstSrc = "/_assets/x/current/pages/appearance.js";
    const filesSrc = `/_assets/x-filesystem/${generation}/pages/filesystems.js`;
    const detailSrc = `/_assets/x-filesystem/${generation}/pages/detail.js`;
    const defaults = { renderEngine: "x-client", stateEngine: "proxy" };
    const config = {
        app: { basePath, baseUrl: location.origin + basePath + "/", label: "Test application" },
        xshell: { assets: { basePath: "/_assets" }, ui: { layouts: { main: "test-main", stack: "test-stack", embed: "x-layout-embed" } } },
        modules: { x: { defaults: { page: defaults, component: defaults } }, "x-filesystem": {} }
    };
    const definitions = { preferences: { scope: "global", label: "Preferences", items: [
        { id: "appearance", label: "Appearance", href: firstSrc },
        { id: "filesystems", label: "Storage", children: [{ id: "filesystems", label: "Filesystems", href: filesSrc }] }
    ] } };
    const bus = new EventTarget();
    bus.emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
    const areas = new Areas({ config, bus }, { default: null, definitions: {} });
    const modules = { resolveModuleId: src => areas.getModuleId(src), getModuleById: id => ({ id, config: config.modules[id] }) };
    const menus = new Menus({ config, bus, areas }, { definitions });
    menus.init();
    areas.init({ modules, menus });
    const resolver = { resolve: href => href === "page:x:/pages/workspace.js" ? { path: workspaceSrc } : null };
    const navigation = new Navigation({ areas, bus, config, menus, resolver }, { mode });
    const pages = new Map();
    const loader = { async load(resource) {
        if (typeof resource !== "string" || resource.startsWith("schema:")) return {};
        if (resource.startsWith("layout:")) return customElements.get(resource.slice(7));
        if (resource.startsWith("state-engine:")) return stateEngine;
        if (resource.startsWith("render-engine:")) return renderEngine;
        const path = resource.slice(5).split("?")[0];
        if (!pages.has(path)) throw new Error("Unexpected Page resource " + path);
        return pages.get(path);
    } };
    const services = { areas, menus, bus, config, loader, modules, navigation, events: {
        on(target, type, callback) { target.addEventListener(type, callback); }
    } };
    services.services = { beginScope: () => ({ resolve: name => services[name], async dispose() {} }) };
    const context = (resourceName, resourcePath) => ({
        resourceName, resourcePath, resourceDefinition: { moduleId: "x" }, appBasePath: basePath, services
    });
    customElements.define("x-page", createXPageClass(services));
    for (const name of ["test-main", "test-stack"]) customElements.define(name, class extends HTMLElement {});
    for (const [name, definition] of [["x-anchor", anchor], ["x-menuitem", menuitem], ["x-layout-embed", embedLayout]]) {
        const path = "/_assets/x/current/components/" + name + ".js";
        await createComponentClassFromJsDefinition(path, context(name, path), {
            ...definition, meta: { ...definition.meta, id: name, renderEngine: "x-client" }
        });
    }
    const lifecycle = [];
    pages.set(workspaceSrc, await createPageClassFromJsDefinition(workspaceSrc, context(workspaceSrc, workspaceSrc), workspace));
    for (const src of ["/home.js", firstSrc, filesSrc, detailSrc]) {
        pages.set(src, await createPageClassFromJsDefinition(src, context(src, src), {
            meta: { title: src.split("/").at(-1) },
            template: "<p>Embedded content</p>",
            controller: () => ({
                mount() { lifecycle.push(["mount", src]); },
                unmount() { lifecycle.push(["unmount", src]); },
                unload() { lifecycle.push(["unload", src]); }
            })
        }));
    }

    // Enter directly from a browser URL or through the public Stack parameter API.
    const params = { "menu-name": "preferences", "show-title": "false", other: "preserved" };
    if (item !== undefined) params.item = item;
    const expectedItem = item === "filesystems" ? item : "appearance";
    const expectedSrc = expectedItem === "filesystems" ? filesSrc : firstSrc;
    if (entry === "direct") {
        params.src = "/legacy-untrusted.js";
        const url = workspaceSrc + "?" + new URLSearchParams(params);
        history.replaceState(null, "", mode === "hash" ? basePath + "/#!" + url : basePath + url);
        await navigation.init();
    } else {
        await navigation.navigate({ href: "/home.js", open: "top" });
        await waitFor(() => navigation.getXPage()?.page, "Home did not mount");
        await navigation.navigate({
            href: "page:x:/pages/workspace.js", params, page: navigation.getXPage().page, open: "stack", classes: ["size-compact"]
        });
    }
    const historyLength = history.length;
    const host = navigation.getXPages().at(-1);
    const outlet = () => host.querySelector('x-page[outlet="content"]');
    const selection = () => [...host.querySelectorAll("x-menuitem[selected]")].map(element => element.dataset.item);
    const verifyQuery = id => {
        const reflected = navigation.stack.at(-1).params;
        check(reflected.item === id, "Unexpected reflected item " + JSON.stringify(reflected));
        check(reflected.other === "preserved" && reflected["show-title"] === "false", "Unrelated query values changed");
        check(!Object.hasOwn(reflected, "src"), "Legacy source remained in Workspace query");
        check(!location.href.includes("legacy-untrusted") && !decodeURIComponent(location.href).includes(filesSrc), "Embedded path leaked into the URL");
        if (entry === "direct") {
            const search = mode === "hash" ? location.hash.split("?")[1] : location.search;
            check(new URLSearchParams(search).get("item") === id, "Browser URL did not reflect the selected ID");
        }
        check(location.pathname.startsWith(basePath + "/"), "App base path changed");
    };
    await waitFor(() => outlet()?.page?.src === expectedSrc && selection().join() === expectedItem, "Initial Workspace selection did not render");
    verifyQuery(expectedItem);
    const embedded = outlet();
    const heading = () => embedded.shadowRoot.querySelector("x-layout-embed")?.shadowRoot.querySelector(".header");
    await waitFor(heading, "Embedded heading did not render");
    check(getComputedStyle(heading()).display === "none", "show-title=false did not hide the heading");
    check(entry !== "stack" || host.layout === "stack" && host.shadowRoot.firstElementChild.stackClasses.includes("size-compact"),
        "Stack presentation was lost");

    // Click the actual nested menu component anchor and keep its outlet during internal navigation.
    const clickItem = async (id, keyboard = false) => {
        const menu = host.querySelector(`[data-item="${id}"]`);
        const link = () => menu.shadowRoot.querySelector("x-anchor")?.shadowRoot.querySelector("a");
        await waitFor(link, "Menu anchor did not render");
        if (keyboard) link().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
        else link().click();
    };
    if (expectedItem === "filesystems") {
        await clickItem("appearance", true);
        await waitFor(() => embedded.page?.src === firstSrc, "Keyboard activation did not switch sections");
    }
    await clickItem("filesystems");
    await waitFor(() => embedded.page?.src === filesSrc && selection().join() === "filesystems", "Nested activation did not switch sections");
    verifyQuery("filesystems");
    check(outlet() === embedded && history.length === historyLength, "Selection replaced the outlet or added browser history");
    check(lifecycle.some(([phase, src]) => phase === "unload" && src === firstSrc), "Replaced Page did not unload");
    await navigation.navigate({ href: detailSrc, page: embedded.page });
    await waitFor(() => embedded.page?.src === detailSrc, "Internal navigation did not reuse the outlet");
    check(outlet() === embedded && selection().join() === "filesystems", "Internal navigation changed Workspace selection");
    verifyQuery("filesystems");
    check(lifecycle.some(([phase, src]) => phase === "unmount" && src === filesSrc), "Embedded Page did not unmount");
    check(lifecycle.some(([phase, src]) => phase === "unload" && src === filesSrc), "Embedded Page did not unload");
}

async function verifyFilesystems() {
    const [
        { default: popup }, { default: explorer }, { default: filesystem }, { default: list }, { default: row },
        { default: menuitem }, { default: anchor }, { default: Navigation }, { default: Services },
        { default: Events }, { default: JsonValidator }, { default: Filesystems },
        { createXPageClass }, { createPageClassFromJsDefinition }, { createComponentClassFromJsDefinition },
        { default: renderEngine }, { default: stateEngine }, { default: Areas }, { default: Menus }, { default: mainLayout }, { default: pageMenu },
        { default: appMenu }, { default: Resolver }
    ] = await Promise.all([
        "x-filesystem/pages/global/filesystems.js", "x-filesystem/pages/explorer.js",
        "x-filesystem/components/x-filesystem.js", "x-filesystem/components/x-filesystem-list.js",
        "x/components/x-listview-item.js", "x/components/x-menuitem.js", "x/components/x-anchor.js",
        "xshell/services/navigation.js", "xshell/services.js", "xshell/services/events.js",
        "xshell/services/json-validator.js", "x-filesystem/services/filesystems.js", "xshell/x-page.js",
        "xshell/loaders/page-js.js", "xshell/loaders/component-js.js", "xshell/render-engines/x-client.js", "xshell/state-engines/proxy.js",
        "xshell/services/areas.js", "xshell/services/menus.js", "x/layouts/x-layout-main.js", "x/components/x-page-menu.js",
        "x/components/x-app-menu.js", "xshell/services/resolver.js"
    ].map(path => import("/resources/" + path)));

    // Mount the real popup, Explorer, and Filesystem components with two in-memory registrations.
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    const direct = params.has("direct");
    const verifyShortcuts = params.has("shortcuts");
    const browserBase = mode === "hash" ? "/app/#!" : "/app";
    const explorerPath = "/_assets/x-filesystem/pages/explorer.js";
    const globalPath = "/global" + explorerPath;
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const waitFor = async (callback, message) => {
        for (let attempt = 0; attempt < 80; attempt++) {
            const result = callback();
            if (result) return result;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        throw new Error(message);
    };
    window.requestAnimationFrame = callback => setTimeout(callback, 0);
    const defaults = { renderEngine: "x-client", stateEngine: "proxy" };
    // Use the actual manifest shortcuts and inventory-derived Area homes.
    const readEntry = async (id, areaId, extension) => {
        const response = await fetch(`/resources/${id}/manifest.jsonc`);
        const source = (await response.text()).replace(/^\s*\/\/[^\r\n]*/gm, "").replace(/,(?=\s*[}\]])/g, "");
        const manifest = JSON.parse(source);
        const definition = manifest.modules[id];
        const assetsPath = `/_assets/${id}/${definition.version}.dev`;
        const home = assetsPath + "/pages/index." + extension;
        const area = manifest.xshell.services.areas.options.definitions[areaId];
        const definitions = manifest.xshell.services.menus.options.definitions;
        const name = area.menus.navigation;
        const navigation = { sources: definitions[name].sources.map(({ source }) => ({ source: assetsPath + source })) };
        const items = definitions.global.items.map(item => item.href ? { ...item, href: assetsPath + item.href } : item);
        return { id, areaId, area, home, name, navigation, items, module: { label: definition.label, assets: { path: assetsPath }, files: [{ path: home }] } };
    };
    const cookbook = await readEntry("x-demo", "cookbook", "js");
    const docs = await readEntry("xshell-docs", "xshell-docs", "md");
    const entries = [cookbook, docs];
    const config = {
        app: { basePath: "/app", baseUrl: location.origin + "/app/", label: "Test" },
        modules: {
            x: { defaults: { page: defaults, component: defaults } },
            ...Object.fromEntries(entries.map(entry => [entry.id, entry.module]))
        },
        xshell: {
            assets: { basePath: "/_assets" },
            ui: { layouts: { main: "x-layout-main", embed: "test-layout" } },
            resolver: { page: {
                "x-filesystem:/pages/explorer.js": { src: explorerPath, loader: "page-js" },
                [explorerPath]: { src: explorerPath, loader: "page-js" }
            } }
        }
    };
    const definitions = {
        global: { scope: "global", items: entries.flatMap(entry => entry.items) },
        ...Object.fromEntries(entries.map(entry => [entry.name, entry.navigation]))
    };
    const searchSrc = "/_assets/x/pages/search.js";
    const intersections = new Map();
    if (verifyShortcuts) {
        // Deliver the intersection after verifying visibility since virtual time may skip compositor updates.
        window.IntersectionObserver = class {
            constructor(callback) { this.callback = callback; }
            observe(element) { intersections.set(element, this.callback); }
            disconnect() {}
        };
        document.body.style.setProperty("--x-contextmenu-width", "20em");
        document.body.style.setProperty("--x-layout-main-drawer-width", "19em");
        // Use the bundled Search item with the same resource normalization performed by bootstrap.
        const source = await (await fetch("/resources/x/manifest.jsonc")).text();
        const manifest = JSON.parse(source.replace(/^\s*\/\/[^\r\n]*/gm, ""));
        const search = manifest.xshell.services.menus.options.definitions.global.items.find(item => item.id === "search");
        definitions.global.items.push(
            {...search, shortcut: [search.shortcut, "Meta+K"], children: search.children.map(item => ({...item, href: "/_assets/x" + item.href}))},
            {label: "Expand sidebar", command: "expand", shortcut: "Ctrl+Shift+E"},
            {label: "Open separately", href: "/help", target: "_blank", shortcut: "Ctrl+Shift+L"}
        );
        cookbook.navigation.items = [{
            label: "Area tools", shortcut: "Ctrl+Shift+G", children: [{label: "Help", href: "/help"}]
        }];
    }
    const bus = new EventTarget();
    bus.emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
    const areas = new Areas({ config, bus }, {
        default: "root", definitions: {
            root: { prefix: "", modules: ["x"] }, ...Object.fromEntries(entries.map(entry => [entry.areaId, entry.area]))
        }
    });
    const modules = { resolveModuleId: href => areas.getModuleId(href) || "x", getModuleById: id => ({ id, config: config.modules[id], controller: {} }) };
    const menus = new Menus({ config, bus, areas }, { definitions });
    menus.init();
    areas.init({ modules, menus });
    const resolver = new Resolver({ config });
    const navigation = new Navigation({ areas, bus, config, menus, resolver }, { mode });
    const pages = new Map();
    const loader = { async load(resource) {
        if (resource === "state-engine:proxy") return stateEngine;
        if (resource === "render-engine:x-client") return renderEngine;
        if (resource.startsWith?.("page:")) return pages.get(resource.slice(5).split(/[?#]/)[0]);
        if (resource.startsWith?.("layout:")) return customElements.get(resource.slice(7));
        return {};
    } };
    const root = new Services({ bus, config, loader, resolver, contracts: {} });
    const shortcutComponents = [];
    if (verifyShortcuts) {
        const {default: MenuShortcuts} = await import("/resources/xshell/services/menu-shortcuts.js");
        root.register("menuShortcuts", new MenuShortcuts({menus, bus, document, navigation}));
        root.register("search", {listProviders: () => []});
        root.register("temp", {});
        // Disable datafield autofocus in this test so only the submenu's focus request can succeed.
        root.register("timer", {setTimeout() {}});
        for (const name of ["x-button", "x-contextmenu", "x-datafield"]) {
            const {default: definition} = await import("/resources/x/components/" + name + ".js");
            shortcutComponents.push([name, definition]);
        }
    }
    const values = new Map();
    const filesystems = new Filesystems({ bus, config, jsonValidator: new JsonValidator(), preferences: {
        async get(key, fallback) { return values.get(key) ?? fallback; },
        async set(key, value) { values.set(key, value); },
        async list() { return [...values.values()].map(value => ({ value })); }
    } }, { providers: { mem: { implementation: location.origin + "/resources/x-filesystem/providers/filesystem-mem.js" } } });
    const preferences = new Map([["x-layout-main.menuCollapsed", !verifyShortcuts]]);
    for (const [name, value] of Object.entries({ bus, config, loader, resolver, modules, areas, menus, navigation, filesystems, preferences, services: root, i18n: {} })) {
        root.register(name, value);
    }
    root.register("dialog", {});
    root.register("tasks", { list: () => [] });
    root.register("events", null, { lifetime: "transient", implementationItem: { class: Events } });
    const services = new Proxy({}, { get: (_, name) => root.resolve(name) });
    const context = { resourceDefinition: { moduleId: "x" }, appBasePath: "/app", services };
    customElements.define("test-layout", class extends HTMLElement {
        connectedCallback() { this.attachShadow({ mode: "open" }).innerHTML = "<slot></slot>"; }
    });
    customElements.define("x-page", createXPageClass({ areas, menus, bus, config, loader, modules, navigation }));
    for (const [name, definition] of [
        ["x-menuitem", menuitem], ["x-anchor", anchor], ["x-filesystem", filesystem],
        ["x-filesystem-list", list], ["x-listview-item", row], ["x-layout-main", mainLayout], ["x-page-menu", pageMenu], ["x-app-menu", appMenu],
        ...shortcutComponents
    ]) {
        await createComponentClassFromJsDefinition("/" + name + ".js", context, {
            ...definition, meta: { ...definition.meta, id: name, renderEngine: "x-client" }
        });
    }
    for (const [path, definition] of [
        ...entries.map(entry => [entry.home, { template: "<p>Area home</p>", controller: () => ({}) }]),
        ["/popup.js", popup], [explorerPath, explorer]
    ]) {
        pages.set(path, await createPageClassFromJsDefinition(path, context, definition));
    }
    if (verifyShortcuts) {
        const {default: searchPage} = await import("/resources/x/pages/search.js");
        pages.set(searchSrc, await createPageClassFromJsDefinition(searchSrc, context, searchPage));
    }
    for (const name of ["filesystem1", "filesystem2"]) {
        await filesystems.saveDefinition({ name, label: name, provider: "mem", options: {} });
        await (await filesystems.openNamed(name)).saveFile("/" + name + ".txt", name);
    }
    document.body.appendChild(document.createElement("aside")).innerHTML = '<x-page src="/popup.js"></x-page>';
    const target = name => globalPath + "?src=named%3A" + name + "&path=%2F";
    history.replaceState(null, "", browserBase + (direct ? target("filesystem1") : areas.getArea(cookbook.areaId).home));
    await navigation.init();
    const host = navigation.getXPage();
    if (verifyShortcuts) {
        const shortcuts = await root.initialize("menuShortcuts");
        const appMenu = await waitFor(() => host.shadowRoot.querySelector("x-layout-main")?.shadowRoot
            ?.querySelector("x-app-menu")?.shadowRoot?.querySelector("div.collapsed")?.getRootNode(), "Collapsed sidebar did not mount");
        const item = appMenu.querySelector('x-menuitem[label="Search"]');
        const hint = await waitFor(() => item.shadowRoot?.querySelector("kbd"), "Search shortcut hint did not render");
        const anchor = () => item.shadowRoot.querySelector("x-anchor")?.shadowRoot.querySelector("a");
        const searchHost = () => item.querySelector("x-menuitem")?.shadowRoot?.querySelector("x-page");
        const searchField = () => searchHost()?.querySelector('[ref="search"]');
        const focus = () => searchField()?.shadowRoot?.activeElement?.matches('input[type="search"]');
        const press = (target, key, modifiers = {}) => !target.dispatchEvent(new KeyboardEvent("keydown",
            {key, ctrlKey: true, bubbles: true, composed: true, cancelable: true, ...modifiers}));

        check(hint.textContent === "Ctrl+K" && getComputedStyle(hint).display === "none", "Collapsed sidebar hint is visible");
        check(press(host, "k"), "Ctrl+K did not activate the collapsed Search presenter");
        await waitFor(() => item.shadowRoot.querySelector("x-contextmenu")?.checkVisibility(), "Search submenu did not expand");
        const embeddedSearch = await waitFor(() => searchHost()?.checkVisibility() && searchHost(), "Embedded Search Page is hidden");
        check(intersections.has(embeddedSearch) && embeddedSearch.status === "", "Search did not wait for the lazy intersection");
        intersections.get(embeddedSearch)([{isIntersecting: true}]);
        await waitFor(() => searchHost()?.status === "loaded", "Visible Search Page did not load");
        await waitFor(() => searchField()?.shadowRoot?.querySelector("input"), "Search datafield did not render its input");
        check(embeddedSearch.page.hasCommand("focus"), "The loaded Search Page has no focus method");
        check(embeddedSearch.page.refs.search === searchField(), "Search Page did not resolve its focus ref");
        await waitFor(focus, "Search submenu did not focus its embedded input");
        check(press(searchField().shadowRoot.activeElement, "k", {ctrlKey: false, metaKey: true}), "Meta+K from Search did not toggle the submenu");
        await waitFor(() => !item.shadowRoot.querySelector("x-contextmenu").checkVisibility(), "Search did not close");
        anchor().click();
        await waitFor(focus, "A mouse click did not reopen the same submenu and focus its input");

        const buttonItem = appMenu.querySelector('x-menuitem[label="Expand sidebar"]');
        await waitFor(() => buttonItem.shadowRoot?.querySelector("x-button")?.shadowRoot.querySelector("kbd"), "Command shortcut hint did not render");
        check(press(host, "E", {shiftKey: true}), "The command shortcut did not activate");
        await waitFor(() => !appMenu.querySelector("div.collapsed"), "The existing command handler did not expand the sidebar");
        check(preferences.get("x-app-menu:expanded") && getComputedStyle(hint).display !== "none", "Expanded sidebar shortcut hint is hidden");

        const targetLink = await waitFor(() => appMenu.querySelector('x-menuitem[label="Open separately"]')?.shadowRoot
            ?.querySelector("x-anchor")?.shadowRoot?.querySelector("a"), "Targeted menu link did not render");
        check(targetLink.target === "_blank", "Menu target was missing before activation");
        const targets = [];
        targetLink.addEventListener("click", event => {
            targets.push([targetLink.target, event.defaultPrevented]);
            event.preventDefault();
        });
        check(press(host, "L", {shiftKey: true}), "Targeted link shortcut did not activate");
        targetLink.click();
        check(JSON.stringify(targets) === JSON.stringify([["_blank", false], ["_blank", false]]), "Browser target differed between keyboard and mouse");

        const areaGroup = await waitFor(() => host.shadowRoot.querySelector("x-layout-main")?.shadowRoot
            ?.querySelector("x-page-menu")?.shadowRoot?.querySelector('x-menuitem[label="Area tools"]'), "Area submenu did not mount");
        const areaSubmenu = () => areaGroup.shadowRoot?.querySelector("x-contextmenu")?.checkVisibility();
        check(press(host, "G", {shiftKey: true}), "Area submenu shortcut did not activate");
        await waitFor(areaSubmenu, "Area submenu did not open");
        check(press(host, "G", {shiftKey: true}), "Area submenu shortcut did not toggle closed");
        await waitFor(() => !areaSubmenu(), "Area submenu did not close");

        shortcuts.dispose();
        check(!press(host, "k"), "A disposed shortcut listener accepted the event");
        return;
    }

    // Click the popup's real links and wait for the bound Filesystem list rows to render.
    const click = async name => {
        const link = await waitFor(() => document.querySelector(`aside x-menuitem[label="${name}"]`)?.shadowRoot
            .querySelector("x-anchor")?.shadowRoot.querySelector("a"), "Filesystem link did not render");
        check(link.getAttribute("href") === browserBase + target(name), "Native anchor did not retain the global URL");
        link.click();
    };
    const layout = () => host.shadowRoot.querySelector("x-layout-main")?.shadowRoot;
    const sidebar = () => layout()?.querySelector("x-page-menu");
    const toggle = () => layout()?.querySelector(".breadcrumb x-button");
    async function verifyExplorer(name, retainedArea = direct ? "root" : "cookbook") {
        const component = await waitFor(() => {
            const component = host.querySelector("x-filesystem");
            const list = component?.shadowRoot?.querySelector("x-filesystem-list");
            const rows = [...(list?.shadowRoot?.querySelectorAll("x-listview-item") ?? [])];
            const labels = rows.map(item => item.shadowRoot?.querySelector(".label")?.textContent);
            return labels.join() === name + ".txt" ? component : null;
        }, "Explorer did not render " + name + ".txt");
        check(navigation.getXPage() === host, "Navigation replaced the Page host");
        check(component.src === "named:" + name && component.path === "/", "Explorer did not bind the new query properties");
        check(host.page.src === target(name), "Explorer lost the global source");
        check(location.href.endsWith(browserBase + target(name)), "Browser destination lost the global URL");
        check(!host.page.breadcrumb, "Global Page derived an Area breadcrumb");
        check(areas.getCurrentArea().id === retainedArea, "Global destination changed the active Area");
        check(layout()?.querySelector("x-app-menu") && !sidebar() && !toggle(), "Global layout still displays Area navigation");
        check(!("scope" in navigation.stack[0]) && !("scope" in navigation.stack[0].nav), "Scope was serialized separately");
        return host.page;
    }
    async function verifyArea(entry = cookbook) {
        const area = areas.getArea(entry.areaId);
        const selected = () => sidebar()?.shadowRoot?.querySelector("x-anchor.selected");
        await waitFor(() => host.page?.src === area.prefix + entry.home && areas.getCurrentArea().id === area.id &&
            selected(), "Area menu did not restore for " + area.id);
        check(sidebar().classList.contains("collapsed") && toggle(), "Area layout lost its collapse preference");
        check(selected().href === area.home, "Sidebar selected the wrong Area Page");
    }
    if (!direct) {
        await verifyArea();
        await click("filesystem1");
    }
    const first = await verifyExplorer("filesystem1");
    const scope = first._servicesScope;
    await click("filesystem2");
    const second = await verifyExplorer("filesystem2");
    check(second !== first && first._servicesScope === null, "The first invocation was not unloaded");
    let disposed = false;
    try { scope.has("events"); } catch (error) { disposed = /disposed/.test(error.message); }
    check(disposed, "The first Page's Services scope was not disposed");
    history.back();
    check(await verifyExplorer("filesystem1") !== first, "Back did not reconstruct the earlier invocation");
    if (!direct) {
        history.back();
        await verifyArea();
        history.forward();
        await verifyExplorer("filesystem1");
    }
    history.forward();
    check(await verifyExplorer("filesystem2") !== second, "Forward did not reconstruct the later invocation");

    // Check that native hrefs and ordinary clicks on the real app menu enter the same Area.
    async function openAreaShortcut(label, entry) {
        const areaHome = areas.getArea(entry.areaId).home;
        const link = await waitFor(() => layout().querySelector("x-app-menu")?.shadowRoot?.querySelector(`x-menuitem[label="${label}"]`)
            ?.shadowRoot?.querySelector("x-anchor")?.shadowRoot?.querySelector("a"), "App menu shortcut did not render");
        check(link.getAttribute("href") === browserBase + areaHome, "Native " + label + " link did not enter its Area");
        link.click();
        await verifyArea(entry);
        check(location.href.endsWith(browserBase + areaHome), "Intercepted " + label + " click differed from the native link");
    }
    await openAreaShortcut("Docs", docs);
    await click("filesystem1");
    await verifyExplorer("filesystem1", docs.areaId);
    await openAreaShortcut("Demo", cookbook);
}

const browser = process.env.XSHELL_TEST_BROWSER;
const chromiumOnly = { skip: !browser && "Set XSHELL_TEST_BROWSER to a Chromium executable" };

async function runInChromium(verify, scenarios) {
    // Serve the actual runtime modules to an isolated Chromium profile for each scenario.
    const root = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);
    const html = `<!doctype html><body data-result="pending"><script type="module">
        try {
            await (${verify})();
            document.body.dataset.result = "passed";
        } catch (error) {
            document.body.dataset.result = "failed";
            document.body.prepend(error.stack);
        }
    </script>`;
    const server = createServer(async (request, response) => {
        const path = new URL(request.url, "http://localhost").pathname;
        if (path === "/app/test") {
            response.writeHead(200, { "Content-Type": "text/html" }).end(html);
        } else if (/^\/resources\/[\w./-]+\.(?:js|jsonc)$/.test(path)) {
            try {
                const script = await readFile(new URL("./" + path.slice(11), root));
                response.writeHead(200, { "Content-Type": path.endsWith(".js") ? "text/javascript" : "application/json" }).end(script);
            } catch {
                response.writeHead(404).end();
            }
        } else {
            response.writeHead(404).end();
        }
    });
    const temp = await mkdtemp(join(tmpdir(), "xshell-browser-"));
    try {
        await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
        for (const [index, params] of scenarios.entries()) {
            const url = `http://127.0.0.1:${server.address().port}/app/test?${params}`;
            const { stdout } = await promisify(execFile)(browser, [
                "--headless", "--disable-gpu", "--disable-background-networking", "--no-first-run",
                `--user-data-dir=${join(temp, "profile-" + index)}`, "--virtual-time-budget=1500", "--dump-dom", url
            ], { timeout: 30_000 });
            const status = stdout.match(/<body[^>]*data-result="([^"]+)"/)?.[1];
            const failure = stdout.match(/<body[^>]*>([\s\S]*?)<script/)?.[1];
            assert.equal(status, "passed", params + " " + (failure || "Browser did not complete checks"));
        }
    } finally {
        server.close();
        await rm(temp, { recursive: true, force: true, maxRetries: 3 });
    }
}

test("Workspace reflects IDs and reuses its outlet across selection and embedded navigation", chromiumOnly, () => runInChromium(verifyWorkspace, [
    "mode=path&generation=old", "mode=hash&generation=new&item=unknown", "mode=path&generation=new&item=filesystems&entry=stack",
    "mode=path&generation=old&item=filesystems"
]));

test("Global Filesystem links work on direct access and history and preserve Area layout preferences", chromiumOnly,
    () => runInChromium(verifyFilesystems, ["mode=path", "mode=hash", "mode=path&direct", "mode=hash&direct"]));

test("Ctrl+K opens and toggles the real Search submenu with focus from the collapsed sidebar", chromiumOnly,
    () => runInChromium(verifyFilesystems, ["mode=path&shortcuts"]));
