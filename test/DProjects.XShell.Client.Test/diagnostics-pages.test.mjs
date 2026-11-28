import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fillResolverRules, mergeManifests, normalizeManifest } from "./helpers/manifest-composition.mjs";

import DiagnosticsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/index.js";
import BusPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/runtime/bus.js";
import ModulesPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/application/modules.js";
import ServicesPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/apis/services.js";
import InspectorPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/detail/service-inspector.js";
import LoaderPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/resources/loader.js";
import ComponentsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/ui/components.js";
import PagesPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/ui/pages.js";
import SchemasPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/resources/schemas.js";
import CommandsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/apis/commands.js";
import ContractsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/apis/contracts.js";
import ContractDetailPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/detail/contract-detail.js";
import NavigationPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/ui/navigation.js";
import Anchor from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-anchor.js";
import ListView from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-listview.js";
import Page from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/page.js";
import Logger from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/logger.js";
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Menus from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/menus.js";
import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/resolver.js";
import Navigation from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/navigation.js";
import createStateEngine from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/state-engines/proxy.js";
import NavigationContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/navigation.json" with { type: "json" };

function createEvents(getController) {
    return {
        on(target, type, listener) {
            target.addEventListener(type, typeof listener === "string" ? () => getController()[listener]() : listener);
        }
    };
}

function diagnosticsConsole(items, stored = {}) {
    // Exercise the Page controller with a different effective menu and an in-memory Preferences service.
    const state = structuredClone(DiagnosticsPage.state);
    const menus = { getMenu(name, area) {
        assert.deepEqual([name, area], ["navigation", "xshell-diagnostics"]);
        return { items };
    } };
    const preferences = { async get(key) { return stored[key]; }, async set(key, value) { stored[key] = structuredClone(value); } };
    const controller = DiagnosticsPage.controller({ state, menus, preferences });
    return { state, controller };
}

const navigationPreference = "xshell-diagnostics.navigation";
const legacyPreference = "xshell-diagnostics.selectedIndex";
const sampleMenu = [{ id: "console", href: "/console.js", children: [
    { id: "operations", label: "Operations", children: [
        { id: "runtime", href: "/runtime.js" }, { id: "tasks", href: "/tasks.js" }, { id: "detail" }
    ] },
    { id: "overview", label: "Overview", children: [
        { id: "app", href: "/app.js" }, { id: "modules", href: "/modules.js" }
    ] },
    { id: "empty", children: [{ id: "detail" }] }
] }];

test("optional x-logs contributions compose with Diagnostics Runtime and keep their own resource paths", async () => {
    const root = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);
    const module = name => {
        const entry = { name, assetsPath: "/_assets/" + name, manifestUrl: "https://example.test/" + name + "/manifest.json" };
        const authored = JSON.parse(readFileSync(new URL(name + "/manifest.jsonc", root), "utf8").replace(/^\s*\/\/[^\r\n]*/gm, ""));
        return { ...entry, manifest: normalizeManifest(authored, entry) };
    };
    const diagnostics = module("xshell-diagnostics"), logs = module("x-logs");
    const framework = { name: "xshell", manifest: { xshell: { resolver: { esm: { xshell: { src: "/xshell.js" } } } } } };
    const existing = ["runtime", "errors", "bus", "tasks"];

    // Compose and initialize Menus and Areas for each combination of optional modules.
    for (const contributions of [[], [logs], [diagnostics], [logs, diagnostics], [diagnostics, logs]]) {
        const dependencies = Object.fromEntries(contributions.map(({ name }) => [name, "module:" + name + ":latest"]));
        const app = { name: "app", assetsPath: "/_assets/app", manifest: { modules: { app: {} } }, dependencies };
        const config = structuredClone(mergeManifests([framework, ...contributions, app], app));
        config.app = { baseUrl: "https://example.test/" };
        config.xshell.assets = { basePath: "/_assets" };
        if (contributions.includes(logs)) {
            fillResolverRules(config);
            const resolver = new Resolver({ config });
            const viewer = resolver.resolve("component:x-logview");
            assert.equal(viewer.path, "/_assets/x-logs/components/x-logview.js");
            assert.equal(viewer.definition.moduleId, "x-logs");
            assert.equal(viewer.definition.modulePath, "/_assets/x-logs/");
            for (const id of ["logs", "live-logs"]) {
                const page = resolver.resolve("page:x-logs:/pages/" + id + ".js");
                assert.equal(page.path, "/_assets/x-logs/pages/" + id + ".js");
            }
        }
        const bus = Object.assign(new EventTarget(), { emit() {} });
        const areas = new Areas({ config, bus }, { default: null, ...config.xshell.services?.areas?.options });
        const options = config.xshell.services?.menus?.options ?? { definitions: {} };
        const validation = new JsonValidator().validate(options, Menus.optionsSchema);
        assert.equal(validation.valid, true, JSON.stringify(validation.errors));
        const menus = new Menus({ config, bus, areas }, options);
        menus.init();
        areas.init({ menus });
        const menu = menus.getMenu("navigation", "xshell-diagnostics");
        if (!contributions.includes(diagnostics)) {
            assert.equal(menu, null);
            continue;
        }
        assert.deepEqual(menu.items.filter(item => item.id === "console").map(item => item.id), ["console"]);
        const consoleItem = menu.items.find(item => item.id === "console");
        assert.deepEqual(consoleItem.children.map(group => group.id), ["application", "runtime", "resources", "ui", "apis", "browser"]);
        const runtime = consoleItem.children.find(item => item.id === "runtime");
        const withLogs = contributions.includes(logs);
        assert.deepEqual(runtime.children.map(item => item.id), withLogs ? [...existing, "logs", "live-logs"] : existing);
        if (!withLogs) continue;
        for (const id of ["logs", "live-logs"]) {
            const item = runtime.children.find(item => item.id === id);
            assert.equal(item.module, "x-logs");
            assert.equal(item.href, "/xshell-diagnostics/_assets/x-logs/pages/" + id + ".js");
            assert.equal(menus.resolvePath("/xshell-diagnostics/" + id), item);
        }

        const stored = { [navigationPreference]: { groupId: "runtime", pageIds: { runtime: "live-logs" } } };
        const { state, controller } = diagnosticsConsole(menu.items, stored);
        await controller.load();
        assert.deepEqual(state.visited, { "/xshell-diagnostics/_assets/x-logs/pages/live-logs.js": true });
        await controller.selectPage({ event: { currentTarget: { dataset: { groupId: "runtime" } }, detail: { selectedIndex: 4 } } });
        assert.equal(stored[navigationPreference].pageIds.runtime, "logs");
        assert.deepEqual(Object.keys(state.visited), ["/xshell-diagnostics/_assets/x-logs/pages/live-logs.js", "/xshell-diagnostics/_assets/x-logs/pages/logs.js"]);
    }
});

test("Diagnostics uses the configured groups, remembers each selection and creates only visited Pages", async () => {
    const stored = {};
    const { state, controller } = diagnosticsConsole(sampleMenu, stored);
    await controller.load();
    assert.deepEqual(state.groups.map(group => [group.id, group.items.map(item => item.id)]),
        [["operations", ["runtime", "tasks"]], ["overview", ["app", "modules"]]]);
    assert.equal(state.selectedGroupId, "operations");
    assert.deepEqual(state.visited, { "/runtime.js": true });
    assert.deepEqual(stored, {});

    const selectPage = (groupId, selectedIndex) =>
        controller.selectPage({ event: { currentTarget: { dataset: { groupId } }, detail: { selectedIndex } } });
    await selectPage("operations", 1);
    assert.deepEqual(stored[navigationPreference].pageIds, { operations: "tasks" });
    await controller.selectGroup({ groupId: "overview" });
    await selectPage("overview", 1);
    await controller.selectGroup({ groupId: "operations" });
    assert.equal(state.groups[0].selectedIndex, 1);
    assert.deepEqual(state.visited, { "/runtime.js": true, "/tasks.js": true, "/app.js": true, "/modules.js": true });
    assert.deepEqual(stored[navigationPreference], { groupId: "operations", pageIds: { operations: "tasks", overview: "modules" } });

    const reopened = diagnosticsConsole(sampleMenu, stored);
    await reopened.controller.load();
    assert.deepEqual(reopened.state.visited, { "/tasks.js": true });
    await reopened.controller.selectGroup({ groupId: "overview" });
    assert.equal(reopened.state.groups[1].selectedIndex, 1);
    assert.deepEqual(reopened.state.visited, { "/tasks.js": true, "/modules.js": true });
});

test("Diagnostics migrates the former flat ordering and falls back from obsolete or malformed preferences", async () => {
    const stored = { [legacyPreference]: 10 };
    const migrated = diagnosticsConsole(sampleMenu, stored);
    await migrated.controller.load();
    assert.equal(migrated.state.selectedGroupId, "overview");
    assert.deepEqual(migrated.state.visited, { "/modules.js": true });
    assert.equal(stored[navigationPreference].pageIds.overview, "modules");

    for (const invalid of [null, [], { groupId: "obsolete", pageIds: { operations: "removed", overview: "modules" } }]) {
        const { state, controller } = diagnosticsConsole(sampleMenu, { ...stored, [navigationPreference]: invalid });
        await controller.load();
        assert.equal(state.selectedGroupId, "operations");
        assert.deepEqual(state.visited, { "/runtime.js": true });
        await controller.selectGroup({ groupId: "obsolete" });
        assert.equal(state.selectedGroupId, "operations");
    }

    const empty = diagnosticsConsole([]);
    await empty.controller.load();
    assert.deepEqual(empty.state.groups, []);
});

test("Modules diagnostics displays and filters the framework alongside the module registry", () => {
    const assetsPath = "/_assets/xshell/0.9.0.release";
    const framework = Object.freeze({
        label: "XShell", description: "Core application framework and runtime.", tags: Object.freeze(["framework", "runtime", "infrastructure"]),
        icon: "x-xshell", version: "0.9.0", builtAt: "2026-11-20T10:00:00Z",
        assets: Object.freeze({ basePath: "/_assets", path: assetsPath, url: "https://repo.example/xshell/0.9.0.release/xshell.zip" }),
        configUrl: "https://repo.example/xshell/0.9.0.release/manifest.json",
        files: Object.freeze(["pages/index.js", "components/x-page.js", "services/modules.js", "contracts/modules.json", "xshell.js"]
            .map((path, index) => Object.freeze({ path: assetsPath + "/" + path, size: 10 * index, hash: `file-${index}` })))
    });
    const archive = { id: "z-archive", version: "1.0.0", assets: { path: "/_assets/z-archive" }, configUrl: "/archive/manifest.json", files: [] };
    const orders = {
        id: "orders", label: "Orders", description: "Manage orders.", tags: ["commerce"], icon: "x-shop", version: "2.0.0",
        assets: { path: "/_assets/orders", url: "https://repo.example/orders/" }, configUrl: "/orders/manifest.json",
        files: [{ path: "/_assets/orders/pages/index.js", size: 12 }]
    };
    const modules = Object.freeze({ registry: Object.freeze([Object.freeze(archive), Object.freeze(orders)]) });
    const config = Object.freeze({ xshell: framework });
    const state = Object.assign(new EventTarget(), ModulesPage.state);
    const controller = ModulesPage.controller({ state, modules, config, events: createEvents(() => controller) });

    // Verify the projected row data and the configuration document link.
    controller.load();
    assert.deepEqual(state.modules.map(module => module.id), ["orders", "xshell", "z-archive"]);
    assert.deepEqual(state.modules[1], {
        id: "xshell", label: framework.label, description: framework.description, tags: framework.tags, icon: framework.icon,
        version: framework.version, builtAt: framework.builtAt, assets: { path: assetsPath, url: framework.assets.url },
        configUrl: framework.configUrl, configUrlName: "manifest.json", status: "loaded",
        files: { all: 5, pages: 1, components: 1, services: 1, contracts: 1, others: 1 }, size: 100
    });
    assert.deepEqual(state.modules[0], {
        id: orders.id, label: orders.label, description: orders.description, tags: orders.tags, icon: orders.icon,
        version: orders.version, builtAt: "", assets: orders.assets, configUrl: orders.configUrl, configUrlName: "manifest.json", status: "loaded",
        files: { all: 1, pages: 1, components: 0, services: 0, contracts: 0, others: 0 }, size: 12
    });
    assert.match(ModulesPage.template, /x-attr:href="module\.configUrl" target="_blank"/);

    // Each existing filter can include the framework, exclude it, and restore the full inventory.
    for (const [key, query] of Object.entries({
        id: "xshell", version: "0.9", label: "XShell", description: "framework and runtime", tags: "STRUCT", assetPath: assetsPath,
        configUrl: "https://repo.example/xshell/0.9.0.release/manifest.json"
    })) {
        for (const [value, expected] of [[query, ["xshell"]], ["unmatched", []], ["", ["orders", "xshell", "z-archive"]]]) {
            state[key] = value;
            state.dispatchEvent(new Event("change:" + key));
            assert.deepEqual(state.modules.map(module => module.id), expected, key);
        }
    }
    assert.deepEqual(modules.registry.map(module => module.id), ["z-archive", "orders"]);
    assert.equal(Object.hasOwn(framework, "id"), false);
});

test("Modules diagnostics preserves module filters and handles legacy framework metadata", () => {
    const state = { id: "", version: "", label: "", tags: "MER", assetPath: "/_assets/orders", configUrl: "", modules: [] };
    const modules = { registry: [{
        id: "orders", label: "Orders", version: "", tags: ["commerce", "orders"], assets: { path: "/_assets/orders", url: "https://example.test/orders/" },
        configUrl: "/orders/manifest.jsonc", files: []
    }] };
    const config = { xshell: {
        version: "0.9.0", assets: { path: "/_assets/xshell", url: "https://example.test/xshell/" },
        configUrl: "https://example.test/xshell/manifest.json", files: []
    } };
    const controller = ModulesPage.controller({ state, modules, config });

    controller.refresh();
    assert.equal(state.modules.length, 1);
    assert.equal(state.modules[0].assets.path, "/_assets/orders");
    assert.deepEqual(state.modules[0].tags, ["commerce", "orders"]);
    state.assetPath = "/_assets/other";
    controller.refresh();
    assert.deepEqual(state.modules, []);

    state.assetPath = "";
    state.tags = "";
    state.label = "XShell";
    controller.refresh();
    assert.deepEqual(state.modules, [{
        id: "xshell", label: "XShell", description: "", tags: [], icon: "x-module", version: "0.9.0", builtAt: "",
        assets: config.xshell.assets, configUrl: config.xshell.configUrl, configUrlName: "manifest.json", status: "loaded",
        files: { all: 0, pages: 0, components: 0, services: 0, contracts: 0, others: 0 }, size: 0
    }]);
});

test("Page and Component diagnostics use generated metadata before resources load", t => {
    const config = {
        app: { baseUrl: "https://example.test/app/" },
        modules: { orders: {
            assets: { path: "/_assets/orders" }, icon: "module-icon", files: [
                { path: "/_assets/orders/pages/index.js", size: 10,
                    resource: { type: "page", title: "Order Home", description: "Manage Orders", icon: "page-icon", tags: ["navigation", "orders"] } },
                { path: "/_assets/orders/components/x-order.js", size: 20,
                    resource: { type: "component", label: "Order Card", description: "Shows Orders", icon: "component-icon", tags: ["commerce", "cards"] } }
            ]
        } }
    };
    const loader = { registry: [] };
    globalThis.customElements = { get: t.mock.fn(() => undefined) };
    t.after(() => { delete globalThis.customElements; });

    const pageState = { ...structuredClone(PagesPage.state), label: "order home", description: "manage orders", tags: "VIG" };
    PagesPage.controller({ state: pageState, config, loader }).refresh();
    assert.deepEqual(pageState.pages.map(({ id, label, description, icon, status, time }) =>
        ({ id, label, description, icon, status, time })), [{
        id: "/_assets/orders/pages/index.js", label: "Order Home", description: "Manage Orders", icon: "page-icon", status: "", time: 0
    }]);
    assert.deepEqual(pageState.pages[0].tags, ["navigation", "orders"]);

    const componentState = { ...structuredClone(ComponentsPage.state), id: "X-ORDER", description: "shows orders", tags: "MER" };
    ComponentsPage.controller({ state: componentState, config, loader }).refresh();
    assert.deepEqual(componentState.components.map(({ id, label, description, icon, status, time }) =>
        ({ id, label, description, icon, status, time })), [{
        id: "x-order", label: "Order Card", description: "Shows Orders", icon: "component-icon", status: "", time: 0
    }]);
    assert.deepEqual(componentState.components[0].tags, ["commerce", "cards"]);
    assert.equal(customElements.get.mock.callCount(), 1);
});

test("Schema diagnostics keeps resolver IDs separate from generated schema IDs and ignores ordinary JSON", () => {
    const state = { ...structuredClone(SchemasPage.state), label: "ORDER", description: "payload" };
    const config = {
        app: { baseUrl: "https://example.test/app/" },
        xshell: { assets: { path: "/_assets/xshell" }, files: [] },
        modules: { orders: { assets: { path: "/_assets/orders" }, files: [
            { path: "/_assets/orders/schemas/order.schema.json", size: 30,
                resource: { type: "schema", id: "https://schemas.example/order", title: "Order Schema", description: "Order payload" } },
            { path: "/_assets/orders/schemas/not-a-schema.json", size: 40 }
        ] } }
    };

    SchemasPage.controller({ state, config }).refresh();

    assert.equal(state.schemas.length, 1);
    assert.deepEqual({ id: state.schemas[0].id, schemaId: state.schemas[0].schemaId, label: state.schemas[0].label },
        { id: "order", schemaId: "https://schemas.example/order", label: "Order Schema" });
});

test("Commands diagnostics reads and filters service descriptors without configuration access", () => {
    const state = {...structuredClone(CommandsPage.state), moduleId: "FILE", description: "encrypts", tags: "CUR"};
    const commands = {list: () => [
        {id: "filesystem.encrypt", label: "Encrypt", moduleId: "filesystem", category: "security", tags: ["files", "security"], description: "Encrypts a file", icon: "x-lock", path: "/commands/encrypt.js", size: 10},
        {id: "runtime.inspect", label: "Inspect", moduleId: "xshell", category: "runtime", tags: [], description: "Shows runtime", icon: "", path: "/commands/inspect.js", size: 20}
    ]};

    CommandsPage.controller({state, commands}).refresh();

    assert.deepEqual(state.items.map(item => item.id), ["filesystem.encrypt"]);
    assert.match(CommandsPage.template, /x-for="item in state\.items"/);
    assert.match(CommandsPage.template, /x-attr:href="item\.path"/);
    assert.match(CommandsPage.template, /<x-listview-body>/);
});

test("Commands diagnostics opens invoke.js in stack mode on keyboard and double-click activation", async t => {
    const id = "filesystem.entry.encrypt.aes";
    const page = {src: "/_assets/xshell-diagnostics/pages/apis/commands.js"};
    const commands = {getInfo: value => value === id ? {id} : null};
    const navigation = {navigate: t.mock.fn()};
    const controller = CommandsPage.controller({commands, navigation, page});
    const row = Object.assign(new EventTarget(), {value: id, selected: true, closest() { return this; }});
    const listView = ListView.controller({host: {querySelectorAll: () => [row]}});
    row.addEventListener("activate", event => controller.invokeCommand({event}));

    assert.match(CommandsPage.template, /x-on:activate="invokeCommand"/);
    assert.match(CommandsPage.template, /x-prop:value="item\.id"/);
    await listView.dblClick({event: {target: row}});
    await listView.keydown({event: Object.assign(new Event("keydown", {cancelable: true}), {key: "Enter"})});

    const expected = [{href: "page:x:/pages/invoke.js", page, open: "stack", params: {type: "command", id, method: "execute"}}];
    assert.deepEqual(navigation.navigate.mock.calls.map(call => call.arguments), [expected, expected]);
    assert.equal(controller.invokeCommand({event: {detail: {value: "missing"}}}), undefined);
});

test("Bus diagnostics retains only the newest 1000 events", () => {
    const state = Object.assign(new EventTarget(), { registry: [], query_type: "", query_ts: "", query_detail: "" });
    const bus = new EventTarget();
    const page = { invalidate() {} };
    let controller;
    controller = BusPage.controller({ state, bus, page, events: createEvents(() => controller) });
    controller.load();

    for (let id = 0; id < 1002; id++) {
        bus.dispatchEvent(Object.assign(new Event("*"), { ts: id, detail: { id } }));
    }
    assert.equal(state.registry.length, 1000);
    assert.equal(state.registry[0].detail.id, 2);
    assert.equal(state.registry[999].detail.id, 1001);
});

test("Services diagnostics re-reads the public registry on Refresh", () => {
    const state = Object.assign(new EventTarget(), { id: "", moduleId: "", contractId: "", tags: "ROUT", description: "", items: [] });
    let reads = 0;
    let serviceState = "registered";
    const services = {
        get registry() {
            reads++;
            return [{ id: "example", state: serviceState, initializationState: "not-initialized", tags: ["navigation", "routing"] }];
        }
    };
    let controller;
    controller = ServicesPage.controller({ state, services, events: createEvents(() => controller) });
    controller.load();
    assert.equal(state.items[0].status, "registered");
    assert.equal(state.items[0].initializationStatus, "not-initialized");
    assert.deepEqual(state.items[0].tags, ["navigation", "routing"]);

    serviceState = "created";
    assert.match(ServicesPage.template, /<x-button[^>]*label="Refresh"[^>]*command="refresh"/);
    controller.refresh();
    assert.equal(reads, 2);
    assert.equal(state.items[0].status, "created");
});

test("Double-clicking a service opens and closes a stacked Inspector with the exact service ID", async t => {
    const href = "page:xshell-diagnostics:/pages/detail/service-inspector.js";
    const inspectorPath = "/_assets/xshell-diagnostics/pages/detail/service-inspector.js";
    const page = { src: "/_assets/xshell-diagnostics/pages/apis/services.js" };
    const state = { ...ServicesPage.state, id: "navigation" };
    const serviceId = "navigation /?#&+%=ñ";
    const services = { has: id => id === serviceId };
    // Provide the Page hosts used by Navigation's stack reconciliation.
    const rootHost = { src: "/demo", getAttribute: () => null };
    const pages = [rootHost];
    const container = { querySelectorAll: () => pages, appendChild: host => pages.push(host) };
    globalThis.document = {
        createElement() {
            return Object.assign(new EventTarget(), {
                setAttribute(name, value) { this[name] = value; },
                getAttribute(name) { return this[name] ?? null; },
                async removePage() { pages.splice(pages.indexOf(this), 1); }
            });
        }
    };
    globalThis.history = { pushState() {} };
    t.after(() => {
        delete globalThis.document;
        delete globalThis.history;
    });

    const navigation = new Navigation({
        logger: new Logger({}),
        areas: { }, menus: { resolvePath: () => null, resolveHref: () => null },
        resolver: { resolve: reference => reference === href ? { path: inspectorPath } : null },
        config: { app: { basePath: "", baseUrl: "https://example.test/" }, xshell: {} }
    }, { mode: "path" }, { container });
    const root = navigation.parseUrl("/demo");
    await navigation.navigate({ href: root.href, open: "top", page: { host: null } });
    const navigate = t.mock.method(navigation, "navigate");
    const controller = ServicesPage.controller({ state, page, services, navigation });
    const activate = value => controller.inspectService({ event: new CustomEvent("activate", { detail: { value } }) });

    assert.match(ServicesPage.template, /x-on:activate="inspectService"/);
    assert.match(ServicesPage.template, /x-prop:value="item.serviceId"/);
    for (const invalid of [undefined, null, 42, "", " ", "missing"]) await activate(invalid);
    assert.equal(navigate.mock.callCount(), 0);

    // Use the list view's double-click handler to produce the row activation.
    const row = Object.assign(new EventTarget(), { value: serviceId, closest() { return this; } });
    row.addEventListener("activate", event => controller.inspectService({ event }));
    await ListView.controller({}).dblClick({ event: { target: row } });
    assert.equal(navigate.mock.callCount(), 1);
    await navigate.mock.calls[0].result;
    assert.deepEqual(navigate.mock.calls[0].arguments, [{ href, page, open: "stack", params: { service: serviceId } }]);
    const inspector = pages[1];
    assert.equal(inspector.layout, "stack");
    assert.equal(inspector.src, inspectorPath + "?service=" + encodeURIComponent(serviceId));
    assert.deepEqual(navigation.stack[1].params, { service: serviceId });
    assert.equal(pages[0], rootHost);

    inspector.dispatchEvent(new Event("close"));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(navigation.stack, [root]);
    assert.deepEqual(pages, [rootHost]);
    assert.equal(state.id, "navigation");
});

test("Services diagnostics file links retain native activation", t => {
    for (const binding of ["item.contractUrl", "item.url"]) {
        const anchor = Array.from(ServicesPage.template.matchAll(/<x-anchor\b[^>]+>/g), match => match[0])
            .find(markup => markup.includes(`x-attr:href="${binding}"`));
        assert.match(anchor, /target="_blank"/);
    }
    const navigate = t.mock.fn();
    const event = Object.assign(new Event("click", { cancelable: true }), { button: 0 });
    Anchor.controller({ state: { href: "/service.js", target: "_blank" }, navigation: { navigate } }).click({ event });
    assert.equal(navigate.mock.callCount(), 0);
    assert.equal(event.defaultPrevented, false);
});

const contractDetailHref = "page:xshell-diagnostics:/pages/detail/contract-detail.js";

test("Contract Detail composes accordion tabs, chips, and semantic field lists", () => {
    const { template } = ContractDetailPage;
    assert.match(template, /<x-tabs class="sidebar" x-if="state\.detail">/);
    assert.match(template, /<x-tab x-for="section in state\.detail\.sections" x-key="title" x-attr:label="section\.title">/);
    assert.match(template, /<x-tab x-if="state\.detail\.examples\.length" label="Examples">/);
    assert.match(template, /<x-accordion-panel x-for="entry in section\.entries" x-key="name"/);
    assert.match(template, /<ul>\s*<li x-for="field in group\.fields" x-key="name">/);
    for (const descriptor of ["entry", "field"]) {
        assert.ok(template.includes(`<x-chip x-if="${descriptor}.typeLabel" x-attr:label="${descriptor}.typeLabel">`));
        assert.ok(template.includes(`<x-chip x-for="badge in ${descriptor}.badges" x-attr:label="badge">`));
        assert.ok(template.includes(`<x-details x-if="${descriptor}.hasSchema" label="JSON Schema">`));
        assert.ok(template.includes(`<x-object x-prop:value="${descriptor}.schema" expanded>`));
    }
});

test("Contract Detail keeps authored examples read-only and delegates HTML playback to x-code", () => {
    const { template } = ContractDetailPage;
    assert.match(template, /<x-accordion-panel x-for="example in state\.detail\.examples" x-key="exampleId"/);
    assert.match(template, /<x-code language="html" x-prop:value="example\.template"/);
    assert.match(template, /<div x-if="example\.code">\s*<h4>Code .*?<\/h4>\s*<x-code[^>]+x-prop:language="example\.language"[^>]+x-prop:value="example\.code"/);
    assert.match(template, /<x-details x-if="example\.hasState" label="Initial state">\s*<x-object x-prop:value="example\.state" expanded>/);
    assert.match(template, /<x-notice x-if="state\.error"[^>]+x-prop:message="state\.error"/);
});

for (const [listing, kind, item, id] of [
    [ComponentsPage, "component", "component", "x-button"],
    [PagesPage, "page", "page", "/_assets/x/0.9.0.dev/pages/workspace.js"],
    [ContractsPage, "contract", "contractItem", "navigation"]
]) {
    test(`The ${kind} listing activates the row contract by keyboard and double-click while preserving its file link`, async t => {
        const group = kind === "contract" ? "apis" : "ui";
        const page = { src: `/_assets/xshell-diagnostics/pages/${group}/${kind}s.js` };
        const navigation = { navigate: t.mock.fn() };
        const controller = listing.controller({ page, navigation });
        const row = Object.assign(new EventTarget(), { value: id, selected: true, closest() { return this; } });
        const host = { querySelectorAll: () => [row] };
        const listView = ListView.controller({ host });
        row.addEventListener("activate", event => controller.inspectContract({ event }));
        assert.match(listing.template, /x-on:activate="inspectContract"/);
        assert.ok(listing.template.includes(`x-prop:value="${item}.id"`));

        await listView.dblClick({ event: { target: row } });
        await listView.keydown({ event: Object.assign(new Event("keydown", { cancelable: true }), { key: "Enter" }) });
        const expected = [{ href: contractDetailHref, page, open: "stack", classes: ["size-wide"], params: { kind, id } }];
        assert.deepEqual(navigation.navigate.mock.calls.map(call => call.arguments), [expected, expected]);

        const anchor = Array.from(listing.template.matchAll(/<x-anchor\b[^>]+>/g), match => match[0])
            .find(markup => markup.includes(`x-attr:href="${item}.url"`));
        assert.match(anchor, /target="_blank"/);
    });
}

test("Navigation reconstructs a stacked contract reference and exact query ID from its saved URL", async t => {
    const id = "shared /?#&+%=ñ";
    const contractPath = "/_assets/xshell-diagnostics/pages/detail/contract-detail.js";
    const rootHost = { src: "/demo", getAttribute: () => null };
    const hosts = [rootHost];
    const container = { querySelectorAll: () => hosts, appendChild: host => hosts.push(host) };
    globalThis.document = {
        baseURI: "https://example.test/",
        createElement: () => Object.assign(new EventTarget(), {
            setAttribute(name, value) { this[name] = value; },
            getAttribute(name) { return this[name] ?? null; }
        })
    };
    const pushState = t.mock.fn();
    globalThis.history = { pushState };
    t.after(() => {
        delete globalThis.document;
        delete globalThis.history;
    });
    const navigation = new Navigation({
        logger: new Logger({}),
        areas: { }, menus: { resolvePath: () => null, resolveHref: () => null },
        resolver: { resolve: resource => resource === contractDetailHref ? { path: contractPath } : null },
        config: { app: { basePath: "", baseUrl: document.baseURI }, xshell: {} }
    }, { mode: "path" }, { container });
    await navigation.navigate({ href: "/demo", open: "top", page: { host: null } });
    await ContractsPage.controller({ navigation, page: rootHost }).inspectContract({ event: { detail: { value: id } } });
    assert.equal(hosts[1].layout, "stack");
    assert.deepEqual(hosts[1].stackClasses, ["size-wide"]);

    // Discard the live stack and reconstruct its child Page from the browser URL.
    const serialized = navigation.parseUrl(pushState.mock.calls.at(-1).arguments[2]);
    assert.deepEqual(serialized.nav.stack[0].classes, ["size-wide"]);
    const page = new Page({ src: hosts[1].src, bus: { emit() {} } });
    const state = { ...structuredClone(ContractDetailPage.state), ...page.query };
    const contracts = {
        getContractById: t.mock.fn(() => ({ label: "Shared API" })),
        getContractItemById: () => ({ moduleId: "example" })
    };
    await ContractDetailPage.controller({ state, page, contracts }).load();
    assert.deepEqual(page.query, { kind: "contract", id });
    assert.deepEqual(contracts.getContractById.mock.calls[0].arguments, [id]);
    assert.equal(page.label, "Shared API");
});

function createInspector(t, query = "", { resolutionError, instance = { mode: "path" }, navigation } = {}) {
    if (!globalThis.document) {
        globalThis.document = { baseURI: "https://example.test/" };
        t.after(() => { delete globalThis.document; });
    }
    const bus = new EventTarget();
    const page = new Page({ src: "https://example.test/pages/detail/service-inspector.js" + query, bus });
    const state = createStateEngine(InspectorPage.state).create({ stateChange() {}, invalidate() {} });
    const registry = [
        { id: "navigation", contractId: "navigation", state: "registered" },
        { id: "bare", state: "created" },
        { id: "areas", contractId: "areas", state: "registered" },
        { id: "other /?#&+%=ñ", state: "registered" }
    ];
    const resolved = [];
    const services = {
        getServiceInfo: id => registry.find(item => item.id === id),
        resolve(id) {
            resolved.push(id);
            if (resolutionError) throw resolutionError;
            if (!instance) return instance;
            services.getServiceInfo(id).state = "created";
            return instance;
        }
    };
    const contracts = { getContractById: id => id === "navigation" ? { ...NavigationContract, tags: ["navigation", "routing"] } : { label: "Areas", tags: ["layout"] } };
    const resolver = { resolve: () => ({ path: "/_assets/x/pages/invoke.js" }) };
    const controller = InspectorPage.controller({ state, services, contracts, resolver, bus, page, navigation });
    controller.load();
    return { state, controller, bus, resolved, page };
}

test("Inspector automatically resolves the service named in the URL and displays its contract", t => {
    const { state, controller, resolved } = createInspector(t, "?service=navigation");

    assert.equal(state.serviceId, "navigation");
    assert.equal(state.status, "created");
    assert.equal(state.contractId, "navigation");
    assert.equal(state.error, "");
    assert.deepEqual(state.properties.map(item => item.name), Object.keys(NavigationContract.properties));
    assert.deepEqual(state.methods.map(item => item.name), Object.keys(NavigationContract.methods));
    assert.deepEqual(state.serviceEvents.map(item => item.name), Object.keys(NavigationContract.events));
    assert.deepEqual(state.tags, ["navigation", "routing"]);
    assert.doesNotMatch(InspectorPage.template, /type="select"|label="Resolve"/);
    assert.match(InspectorPage.template, /<x-page x-if="method.opened"/);
    assert.ok(state.methods.every(method => !method.opened));
    assert.ok(state.properties.every(property => !property.read));
    assert.equal(state.monitoring, false);
    assert.equal(state.resolved, true);
    assert.deepEqual(resolved, ["navigation"]);

    controller.readProperty({ event: { currentTarget: { dataset: { name: "mode" } } } });
    assert.equal(state.properties.find(property => property.name === "mode").value, "path");

    const panel = { expanded: true, dataset: { name: "navigate" } };
    controller.openMethod({ event: { currentTarget: panel } });
    assert.equal(state.methods.find(item => item.name === "navigate").opened, true);
    panel.expanded = false;
    controller.openMethod({ event: { currentTarget: panel } });
    assert.equal(state.methods.find(item => item.name === "navigate").opened, true);

    assert.deepEqual(resolved, ["navigation"]);
});

test("Inspector requires a service query parameter and has no default target", t => {
    for (const query of ["", "?type=service&id=navigation", "?service=", "?service=%20"]) {
        const { state, resolved } = createInspector(t, query);
        assert.equal(state.serviceId, "");
        assert.equal(state.error, "Missing 'service' query parameter.");
        assert.deepEqual(resolved, []);
    }
});

test("Inspector reports unknown services without trying to resolve them", t => {
    const { state, resolved } = createInspector(t, "?service=missing");
    assert.equal(state.serviceId, "missing");
    assert.equal(state.contractId, "");
    assert.equal(state.error, "Service 'missing' not found.");
    assert.deepEqual(resolved, []);
});

test("Inspector resolves services without contracts, including URL-encoded IDs", t => {
    const id = "other /?#&+%=ñ";
    const { state, resolved } = createInspector(t, "?service=" + encodeURIComponent(id));
    assert.equal(state.serviceId, id);
    assert.equal(state.resolved, true);
    assert.equal(state.error, "This service has no registered contract.");
    assert.equal(state.contractId, "");
    assert.deepEqual(resolved, [id]);
});

test("Inspector reports resolution failures and preserves available contract metadata", t => {
    for (const [options, error] of [
        [{ resolutionError: new Error("Constructor failed.") }, "Constructor failed."],
        [{ instance: null }, "Service has no live instance."]
    ]) {
        const { state, resolved } = createInspector(t, "?service=navigation", options);
        assert.equal(state.error, error);
        assert.equal(state.contractId, "navigation");
        assert.equal(state.status, "registered");
        assert.equal(state.resolved, false);
        assert.deepEqual(resolved, ["navigation"]);
    }
});

test("View Contract opens the inspected Service's read-only reference even when construction fails", async t => {
    const navigation = { navigate: t.mock.fn() };
    const options = { navigation, resolutionError: new Error("Constructor failed.") };
    const { state, controller, page, resolved } = createInspector(t, "?service=areas", options);
    assert.match(InspectorPage.template, /x-if="state.contractId" label="View Contract"[^>]+x-on:click="viewContract"/);
    assert.equal(state.resolved, false);
    await controller.viewContract();
    assert.deepEqual(navigation.navigate.mock.calls[0].arguments, [{
        href: contractDetailHref, page, open: "stack", classes: ["size-wide"], params: { kind: "service", id: "areas" }
    }]);
    assert.deepEqual(resolved, ["areas"]);

    const bare = createInspector(t, "?service=bare", { navigation });
    await bare.controller.viewContract();
    assert.equal(navigation.navigate.mock.callCount(), 1);
});

test("Inspector removes service-monitoring listeners on unmount and unload", t => {
    const eventName = "xshell:navigation:start";
    for (const command of ["unmount", "unload"]) {
        const { state, controller, bus } = createInspector(t, "?service=navigation");
        controller.startMonitoring();
        bus.dispatchEvent(new CustomEvent(eventName, { detail: { src: "/example" } }));
        assert.deepEqual(state.history.map(item => item.detail), [{ src: "/example" }]);
        controller[command]();
        const history = state.history;
        assert.equal(state.monitoring, false);
        bus.dispatchEvent(new Event(eventName));
        assert.equal(state.history, history);
    }
});

test("Contracts diagnostics reads projected contract metadata", () => {
    const state = { id: "", label: "", description: "", moduleId: "", tags: "NOT", contractItems: [] };
    const contracts = { registry: [
        { id: "toast", label: "Toast", description: "Messages", moduleId: "x", tags: ["notifications", "ui"], url: "/toast.json" },
        { id: "storage", label: "Storage", description: "Files", moduleId: "x", tags: ["files"], url: "/storage.json" }
    ] };
    ContractsPage.controller({ state, contracts }).refresh();
    assert.deepEqual(state.contractItems, [contracts.registry[0]]);
});

test("Tag columns use ordinary wrapping chips and retain an empty row cell", () => {
    for (const page of [CommandsPage, ComponentsPage, PagesPage, ContractsPage, ModulesPage, ServicesPage]) {
        assert.match(page.template, /x-model="state\.tags" placeholder="Tags"/);
        assert.match(page.template, /<div class="tags">\s*<x-chip x-for="tag in [^"]+\.tags" x-attr:label="tag"><\/x-chip>/);
        assert.doesNotMatch(page.template, /<x-chip[^>]+removable/);
        assert.match(page.style, /flex-wrap:\s*wrap/);
    }
});

test("Loader diagnostics re-reads snapshots after events and preserves clear", () => {
    const state = Object.assign(new EventTarget(), { items: [], query_resource: "", query_module: "", query_url: "", query_status: "" });
    const bus = new EventTarget();
    const entries = [{ resource: "page:first", url: "/first", status: "loaded", time: 1, moduleId: "x" }];
    let reads = 0;
    const loader = { get registry() { reads++; return Object.freeze(entries.map(item => Object.freeze({ ...item }))); } };
    let controller;
    controller = LoaderPage.controller({ state, bus, loader, page: { invalidate() {} }, events: createEvents(() => controller) });
    controller.load();
    assert.equal(state.items.length, 1);
    controller.clear();
    assert.deepEqual(state.items, []);
    entries.push({ resource: "page:second", url: "/second", status: "pending", time: null, moduleId: "x" });
    bus.dispatchEvent(new Event("xshell:loader:resource:fetch"));
    assert.equal(state.items[0].status, "pending");
    entries[1].status = "loaded";
    bus.dispatchEvent(new Event("xshell:loader:resource:loaded"));
    assert.equal(state.items[0].status, "loaded");
    assert.ok(reads >= 4);
});

test("Navigation diagnostics includes the Routes tab and uses route inspection for all tester outcomes", () => {
    const template = NavigationPage.template;
    assert.deepEqual(Array.from(template.matchAll(/<x-tab label="([^"]+)"/g), match => match[1]), ["Areas", "Menus", "Live pages", "Routes"]);
    const routesTab = template.match(/<x-tab label="Routes">([\s\S]*?)<\/x-tab>/)[1];
    assert.match(routesTab, /x-model="state.test_route"/);
    assert.match(routesTab, /<x-button label="Resolve" command="resolveRoute"/);
    assert.match(routesTab, /<x-object.*x-prop:value="state.test_result"/);
    assert.match(routesTab, /<x-notice type="info" x-if="state.test_info"/);
    assert.match(routesTab, /<x-notice type="error" x-if="state.test_error"/);

    const state = { ...NavigationPage.state, test_route: "/shop/products/123?sort=name#details" };
    const result = { href: "/shop/_assets/shop/pages/product.js?id=123&sort=name#details" };
    const paths = [];
    const navigation = {
        resolveRoute(path) {
            paths.push(path);
            if (path === "/shop/products/123?sort=name#details") return result;
            if (path === "/shop/missing") return null;
            throw new Error("Invalid path");
        },
        navigate() { assert.fail("Route tester must not navigate"); }
    };
    const controller = NavigationPage.controller({ state, navigation });

    controller.resolveRoute();
    assert.equal(state.test_result, result);
    assert.equal(state.test_info, "");
    assert.equal(state.test_error, "");
    state.test_route = "/shop/missing";
    controller.resolveRoute();
    assert.equal(state.test_result, null);
    assert.match(state.test_info, /No configured route matched/);
    assert.equal(state.test_error, "");
    state.test_route = "invalid";
    controller.resolveRoute();
    assert.equal(state.test_result, null);
    assert.equal(state.test_info, "");
    assert.equal(state.test_error, "Invalid path");
    assert.deepEqual(paths, ["/shop/products/123?sort=name#details", "/shop/missing", "invalid"]);
});

test("Navigation diagnostics lists configured routes and refreshes its search filters", (t) => {
    const state = Object.assign(new EventTarget(), structuredClone(NavigationPage.state));
    const menu = { name: "navigation", scope: "area", label: "Shop", description: "Find products.", icon: "x-shop",
        items: [{ label: "Catalog", children: [{ label: "Featured", href: "/pages/featured.js" }] }] };
    const definitions = [
        { id: "shop", prefix: "/shop", menus: { navigation: "catalog" }, routes: [
            { path: "/products/{id}/{variant}", href: "/pages/detail.js", module: "products" },
            { path: "/products/featured", href: "/pages/featured.js", module: "marketing" },
            { path: "/", href: "/pages/shop.js", module: "products" }
        ] },
        { id: "root", prefix: "", menus: {}, routes: [{ path: "/", href: "/pages/root.js", module: null }] }
    ];
    const bus = new EventTarget();
    globalThis.Node = { ELEMENT_NODE: 1, DOCUMENT_FRAGMENT_NODE: 11 };
    globalThis.document = { body: { nodeType: Node.ELEMENT_NODE, childNodes: [] } };
    t.after(() => {
        delete globalThis.Node;
        delete globalThis.document;
    });
    const controller = NavigationPage.controller({
        state, bus, areas: { getAreas: () => definitions }, menus: { getMenus: id => id === "shop" ? [menu] : [] }, events: createEvents(() => controller)
    });
    controller.load();

    assert.deepEqual(state.menus, [{ ...menu, id: "shop/navigation" }]);
    assert.deepEqual(state.routes, [
        { areaId: "shop", path: "/shop/products/{id}/{variant}", href: "/pages/detail.js", module: "products", parameters: "id, variant" },
        { areaId: "shop", path: "/shop/products/featured", href: "/pages/featured.js", module: "marketing", parameters: "" },
        { areaId: "shop", path: "/shop/", href: "/pages/shop.js", module: "products", parameters: "" },
        { areaId: "root", path: "/", href: "/pages/root.js", module: null, parameters: "" }
    ]);

    // Apply each filter through the Page's change listeners.
    for (const [key, query, expectedPaths] of [
        ["query_area", "shop", ["/shop/products/{id}/{variant}", "/shop/products/featured", "/shop/"]],
        ["query_path", "/shop/products", ["/shop/products/{id}/{variant}", "/shop/products/featured"]],
        ["query_destination", "featured.js", ["/shop/products/featured"]],
        ["query_module", "products", []]
    ]) {
        state[key] = query;
        state.dispatchEvent(new Event("change:" + key));
        assert.deepEqual(state.routes.map(route => route.path), expectedPaths);
    }
});
