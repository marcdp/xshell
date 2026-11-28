import test from "node:test";
import { chromiumOnly, runInChromium } from "./helpers/chromium.mjs";

async function verifyDiagnostics() {
    const load = path => import("/resources/" + path);
    const [
        { default: Areas }, { default: Menus }, { default: Logger }, { default: Events }, { default: Timer },
        { createXPageClass }, { createPageClassFromJsDefinition }, { createComponentClassFromJsDefinition },
        { default: renderer }, { default: stateEngine }
    ] = await Promise.all([
        "xshell/services/areas.js", "xshell/services/menus.js", "xshell/services/logger.js", "xshell/services/events.js", "xshell/services/timer.js",
        "xshell/x-page.js", "xshell/loaders/page-js.js", "xshell/loaders/component-js.js", "xshell/render-engines/x-client.js",
        "xshell/state-engines/proxy.js"
    ].map(load));
    const errors = [];
    window.addEventListener("error", event => errors.push(event.error?.stack ?? event.message));
    window.addEventListener("unhandledrejection", event => errors.push(event.reason?.stack ?? String(event.reason)));
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const waitFor = async (condition, message) => {
        for (let attempt = 0; attempt < 100; attempt++) {
            const value = condition();
            if (value) return value;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        throw new Error([message, ...errors].join("\n"));
    };
    window.requestAnimationFrame = callback => setTimeout(callback, 0);

    // Mount the console using the real menu, Page host, layouts, Components, and scoped lifecycle helpers.
    const moduleId = "xshell-diagnostics";
    const assets = "/_assets/" + moduleId + "/0.9.0.dev";
    const src = assets + "/pages/index.js";
    const defaults = { page: { renderEngine: "x-client", stateEngine: "proxy" }, component: { renderEngine: "x-client", stateEngine: "proxy" } };
    const config = {
        app: { basePath: "", baseUrl: location.origin + "/" },
        xshell: { assets: { basePath: "/_assets" }, ui: { layouts: { dock: "x-layout-dock", embed: "x-layout-embed" } } },
        modules: { x: { defaults }, [moduleId]: { defaults, assets: { path: assets } } }
    };
    const manifest = JSON.parse((await (await fetch("/resources/" + moduleId + "/manifest.jsonc")).text()).replace(/^\s*\/\/[^\r\n]*/gm, ""));
    const { diagnostics } = manifest.xshell.services.menus.options.definitions;
    const menuRoot = diagnostics.items[0];
    menuRoot.href = src;
    for (const group of menuRoot.children) for (const item of group.children) item.href = assets + item.href;
    for (const item of diagnostics.items[1].children) item.href = assets + item.href;
    const bus = Object.assign(new EventTarget(), { emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); } });
    const areas = new Areas({ config, bus }, { default: moduleId, definitions: {
        [moduleId]: { prefix: moduleId, menus: { navigation: "diagnostics" } }
    } });
    const menus = new Menus({ config, areas, bus }, { definitions: { diagnostics } });
    menus.init();
    areas.init({ menus });
    const prefKey = "xshell-diagnostics.navigation";
    const persisted = new Map([[prefKey, { groupId: "application", pageIds: { application: "config" } }]]);
    const loaded = [];
    const unloaded = [];
    const navigationRequests = [];
    const task = { id: "test-task", title: "Example task", status: "running", createdAt: new Date(), duration: 0 };
    let taskReads = 0;
    const services = {
        areas, menus, config, bus, logger: new Logger({}),
        modules: { resolveModuleId: path => areas.getModuleId(path) },
        navigation: { navigate(request) { navigationRequests.push(request); } },
        tasks: { list() { taskReads++; return [task]; }, get: id => id === task.id ? task : undefined },
        preferences: { async get(key) { return persisted.get(key); }, async set(key, value) { persisted.set(key, structuredClone(value)); } }
    };
    services.services = { beginScope({ context }) {
        const events = new Events({ scopeContext: context });
        const timer = new Timer({ scopeContext: context });
        return { resolve: name => ({ events, timer })[name] ?? services[name], async dispose() { events.dispose(); timer.dispose(); } };
    } };
    const context = (id, resourceName, resourcePath) =>
        ({ resourceName, resourcePath, resourceDefinition: { moduleId: id }, appBasePath: "", services });
    const pageClasses = new Map();
    services.loader = { async load(resource) {
        if (typeof resource !== "string" || resource.startsWith("schema:")) return {};
        if (resource.startsWith("state-engine:")) return stateEngine;
        if (resource.startsWith("render-engine:")) return renderer;
        if (resource.startsWith("layout:")) return customElements.get(resource.slice(7));
        if (!resource.startsWith("page:" + assets + "/")) throw new Error("Unexpected resource " + resource);
        const path = resource.slice(5);
        const file = path.slice(assets.length);
        loaded.push(file);
        if (!pageClasses.has(path)) {
            const definition = file === "/pages/index.js" || file === "/pages/runtime/tasks.js"
                ? (await load(moduleId + file)).default
                : { meta: { title: file }, template: '<label>Filter <input></label>' };
            try {
                pageClasses.set(path, await createPageClassFromJsDefinition(path, context(moduleId, path, path), definition));
            } catch (error) {
                errors.push(error.stack);
                throw error;
            }
        }
        return pageClasses.get(path);
    } };
    bus.addEventListener("xshell:page:unload", event => unloaded.push(event.detail.src));
    customElements.define("x-page", createXPageClass(services));
    for (const [name, folder] of [
        ["x-button", "components"], ["x-toolbar", "components"], ["x-tabs", "components"], ["x-tab", "components"],
        ["x-page-title", "components"], ["x-page-description", "components"], ["x-layout-dock", "layouts"], ["x-layout-embed", "layouts"]
    ]) {
        const path = "/_assets/x/0.9.0.dev/" + folder + "/" + name + ".js";
        const { default: definition } = await load("x/" + folder + "/" + name + ".js");
        await createComponentClassFromJsDefinition(path, context("x", name, path), {
            ...definition, meta: { ...definition.meta, id: name, renderEngine: "x-client" }
        });
    }

    // Exercise actual clicks and keyboard selection, and verify the dock and the embedded Page headers.
    const frame = document.body.appendChild(document.createElement("div"));
    frame.style.cssText = "width:360px;height:360px";
    const open = () => {
        const host = document.createElement("x-page");
        host.setAttribute("src", src);
        host.setAttribute("layout", "dock");
        return frame.appendChild(host);
    };
    const host = open();
    const tabs = id => host.querySelector('x-tabs[data-group-id="' + id + '"]');
    const button = (group, id) => group.querySelector(id)?.shadowRoot.querySelector(".button");
    const groupButton = id => button(host, 'x-button[data-group-id="' + id + '"]');
    const tabButton = (id, index) => tabs(id)?.shadowRoot.querySelectorAll("nav a")[index];
    const visible = group => getComputedStyle(tabs(group)).display !== "none";
    const tabPage = (group, id) => tabs(group)?.querySelector('x-tab[hash="' + id + '"] > x-page');
    const configPage = await waitFor(() => tabPage("application", "config")?.page && tabPage("application", "config"), "Saved Config tab did not load");
    check(loaded.join() === "/pages/index.js,/pages/application/config.js", "An unvisited Page loaded");
    check(visible("application") && !visible("runtime"), "The wrong group is visible");
    check(tabButton("application", 1).classList.contains("selected"), "Saved tab is not selected");
    const header = host.shadowRoot.firstElementChild.shadowRoot.querySelector(".title");
    const actions = host.querySelector('x-toolbar[slot="header-actions"]');
    check(header.querySelector("x-page-title") && host.page.label === "Diagnostics console", "Dock title is missing");
    check(header.querySelector('[icon="x-close"]') && header.querySelector('[icon="x-toggle-panel-bottom"]'), "Dock controls are missing");
    check(actions.getBoundingClientRect().right <= header.getBoundingClientRect().right, "Group buttons overflow the narrow header");
    const filter = configPage.querySelector("input");
    filter.value = "retained filter";

    (await waitFor(() => groupButton("runtime"), "Runtime button did not render")).click();
    await waitFor(() => visible("runtime") && tabPage("runtime", "runtime")?.page, "Runtime default tab did not load");
    check(host.querySelector('[data-group-id="runtime"].pressed'), "Runtime group is not selected");
    tabButton("runtime", 3).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    const tasksPage = await waitFor(() => tabPage("runtime", "tasks")?.page && tabPage("runtime", "tasks"), "Tasks tab did not load");
    const refresh = await waitFor(() => button(tasksPage, 'x-button[command="refresh"]'), "Tasks Refresh action did not render");
    const taskHeader = tasksPage.shadowRoot.firstElementChild.shadowRoot.querySelector(".header");
    check(taskHeader.querySelector("x-page-title") && tasksPage.page.label === "Tasks", "Embedded Page title is missing");
    check(taskHeader.querySelector("x-page-description") && tasksPage.page.description, "Embedded Page description is missing");
    check(tasksPage.querySelector('x-toolbar[slot="header-actions"]').getBoundingClientRect().height > 0, "Tasks actions are not visible");
    const readsBeforeRefresh = taskReads;
    refresh.click();
    check(taskReads === readsBeforeRefresh + 1, "The embedded Refresh action did not reach Tasks");

    tasksPage.querySelector("x-listview").dispatchEvent(new CustomEvent("activate", { detail: { path: task.id } }));
    check(navigationRequests.some(request => request.open === "stack" && request.params.id === task.id
        && request.href === "page:xshell-diagnostics:/pages/detail/tasks-detail.js"), "Tasks detail navigation changed");
    groupButton("application").click();
    await waitFor(() => visible("application"), "Application did not reopen");
    check(tabPage("application", "config") === configPage && configPage.querySelector("input") === filter
        && filter.value === "retained filter", "Previously visited Page state was lost");
    groupButton("runtime").click();
    await waitFor(() => visible("runtime") && tabButton("runtime", 3).classList.contains("selected"), "Runtime did not restore Tasks");
    check(tabPage("runtime", "tasks") === tasksPage && loaded.length === 4, "A tab was loaded again");
    check(persisted.get(prefKey).groupId === "runtime" && persisted.get(prefKey).pageIds.runtime === "tasks", "Stable selection was not persisted");
    const readsBeforeEvent = taskReads;
    bus.emit("xshell:tasks:updated", {});
    check(taskReads === readsBeforeEvent + 1, "The Tasks monitor subscribed more than once");

    // Close and reopen the dock, checking cleanup and the restored selection.
    host.addEventListener("close", () => host.remove(), { once: true });
    button(header, '[icon="x-close"]').click();
    await waitFor(() => unloaded.length === 3, "Visited Pages were not unloaded on close");
    const readsAfterClose = taskReads;
    bus.emit("xshell:tasks:updated", {});
    check(taskReads === readsAfterClose, "A closed Tasks Page still monitored the bus");
    const reopened = open();
    await waitFor(() => reopened.querySelector('x-tab[hash="tasks"] > x-page')?.page, "Reopened dock did not restore Tasks");
    check(loaded.slice(4).join() === "/pages/index.js,/pages/runtime/tasks.js", "Reopening loaded other Pages");
    await reopened.removePage();
}

test("Diagnostics dock renders two-level navigation, retains visited Pages and disposes them on close", chromiumOnly,
    () => runInChromium(verifyDiagnostics, [""]));
