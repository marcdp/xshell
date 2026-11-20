import assert from "node:assert/strict";
import test from "node:test";

import DiagnosticsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/index.js";
import BusPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/bus.js";
import ModulesPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/modules.js";
import ServicesPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/services.js";
import InspectorPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/detail/service-inspector.js";
import LoaderPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/loader.js";
import ComponentsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/components.js";
import PagesPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/pages.js";
import ContractsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/contracts.js";
import ContractDetailPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/detail/contract-detail.js";
import NavigationPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/navigation.js";
import ListView from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-listview.js";
import Page from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/page.js";
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

test("Diagnostics console derives its tabs from the effective navigation menu items", async () => {
    const state = structuredClone(DiagnosticsPage.state);
    const tasks = { label: "Tasks", href: "/_assets/xshell-diagnostics/pages/tasks.js" };
    const area = { menus: { navigation: { name: "navigation", label: "Navigation", description: "", icon: null,
        items: [{ children: [tasks, { label: "Detail" }] }] } } };
    const areas = { getArea: () => area };
    await DiagnosticsPage.controller({ state, areas, preferences: { get: async () => 0 } }).load();
    assert.deepEqual(state.menuitems, [tasks]);
});

test("Modules diagnostics filters on the canonical configured assets path", () => {
    const state = { id: "", version: "", label: "", assetPath: "/_assets/orders", configUrl: "", modules: [] };
    const modules = { registry: [{
        id: "orders", label: "Orders", version: "", assets: { path: "/_assets/orders", url: "https://example.test/orders/" }, configUrl: "/orders/manifest.jsonc", files: []
    }] };
    const controller = ModulesPage.controller({ state, modules });

    controller.refresh();
    assert.equal(state.modules.length, 1);
    assert.equal(state.modules[0].assets.path, "/_assets/orders");
    state.assetPath = "/_assets/other";
    controller.refresh();
    assert.deepEqual(state.modules, []);
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

test("Services diagnostics re-reads the public registry when a service is created", () => {
    const state = Object.assign(new EventTarget(), { id: "", moduleId: "", contractId: "", description: "", items: [] });
    const bus = new EventTarget();
    let reads = 0;
    let serviceState = "registered";
    const services = {
        get registry() {
            reads++;
            return [{ id: "example", state: serviceState, initializationState: "not-initialized" }];
        }
    };
    let controller;
    controller = ServicesPage.controller({ state, bus, services, events: createEvents(() => controller) });
    controller.load();
    assert.equal(state.items[0].status, "registered");
    assert.equal(state.items[0].initializationStatus, "not-initialized");

    serviceState = "created";
    bus.dispatchEvent(new Event("xshell:service:created"));
    assert.equal(reads, 2);
    assert.equal(state.items[0].status, "created");
});

test("Double-clicking a service opens and closes a stacked Inspector with the exact service ID", async t => {
    const href = "page:xshell-diagnostics:/pages/detail/service-inspector.js";
    const inspectorPath = "/_assets/xshell-diagnostics/pages/detail/service-inspector.js";
    const page = { src: "/_assets/xshell-diagnostics/pages/services.js" };
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
        areas: { resolvePath: () => null },
        resolver: { resolve: reference => reference === href ? { path: inspectorPath } : null },
        config: { app: { basePath: "", baseUrl: "https://example.test/" }, xshell: {} }
    }, { mode: "path" }, { container });
    const root = navigation.parseUrl("/demo");
    navigation._stack = [root];
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
    await navigation._stackToDomTask;
    assert.deepEqual(navigation.stack, [root]);
    assert.deepEqual(pages, [rootHost]);
    assert.equal(state.id, "navigation");
});

test("Services diagnostics file links retain native activation without activating the row", t => {
    for (const binding of ["item.contractUrl", "item.url"]) {
        const anchor = Array.from(ServicesPage.template.matchAll(/<x-anchor\b[^>]+>/g), match => match[0])
            .find(markup => markup.includes(`x-attr:href="${binding}"`));
        assert.match(anchor, /target="_blank"/);
        assert.match(anchor, /x-on:dblclick="keepLinkActivation"/);
        assert.match(anchor, /x-on:keydown.enter="keepLinkActivation"/);
    }
    const controller = ServicesPage.controller({});
    for (const type of ["dblclick", "keydown"]) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        const stop = t.mock.method(event, "stopPropagation");
        controller.keepLinkActivation({ event });
        assert.equal(stop.mock.callCount(), 1);
        assert.equal(event.defaultPrevented, false);
    }
});

const contractDetailHref = "page:xshell-diagnostics:/pages/detail/contract-detail.js";

test("Contract Detail composes cards, chips, and semantic field lists", () => {
    const { template, style } = ContractDetailPage;
    assert.match(template, /<x-card>\s*<h2 slot="header">.*<\/x-icon> Overview<\/h2>\s*<dl>/);
    assert.match(template, /<x-card x-for="entry in section\.entries">\s*<h3 slot="header"><code x-text="entry\.name">/);
    assert.match(template, /<h2 x-text="section\.title">/);
    assert.match(template, /<ul>\s*<li x-for="field in group\.fields">/);
    for (const descriptor of ["entry", "field"]) {
        assert.ok(template.includes(`<x-chip x-if="${descriptor}.typeLabel" x-attr:label="${descriptor}.typeLabel">`));
        assert.ok(template.includes(`<x-chip x-for="badge in ${descriptor}.badges" x-attr:label="badge">`));
        assert.ok(template.includes(`<x-details x-if="${descriptor}.hasSchema" label="JSON Schema">`));
        assert.ok(template.includes(`<x-object x-prop:value="${descriptor}.schema" expanded>`));
    }
    assert.doesNotMatch(style, /\b(?:border|border-radius|box-shadow|background(?:-color)?|overflow-y)\s*:/);
    assert.doesNotMatch(style, /\boverflow\s*:\s*(?:auto|scroll)\b/);
});

test("Contract Detail keeps source and initial state in read-only displays", () => {
    const { template } = ContractDetailPage;
    assert.match(template, /<x-card x-for="example in state\.detail\.examples">\s*<h3 slot="header" x-text="example\.title">/);
    assert.match(template, /<div x-if="example\.template">\s*<h4>Template<\/h4>\s*<x-code[^>]+x-prop:value="example\.template"/);
    assert.match(template, /<div x-if="example\.code">\s*<h4>Code .*?<\/h4>\s*<x-code[^>]+x-prop:language="example\.language"[^>]+x-prop:value="example\.code"/);
    assert.match(template, /<x-details x-if="example\.hasState" label="Initial state">\s*<x-object x-prop:value="example\.state" expanded>/);
    assert.match(template, /<x-notice x-if="state\.error"[^>]+x-prop:message="state\.error"/);
    assert.match(template, /x-if="state\.detail\.empty">No public contract members or examples are documented for this resource\./);
});

for (const [listing, kind, item, id] of [
    [ComponentsPage, "component", "component", "x-button"],
    [PagesPage, "page", "page", "/_assets/x/0.9.0.dev/pages/workspace.js"],
    [ContractsPage, "contract", "contractItem", "navigation"]
]) {
    test(`The ${kind} listing activates the row contract by keyboard and double-click while preserving its file link`, async t => {
        const page = { src: "/_assets/xshell-diagnostics/pages/" + kind + "s.js" };
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
        assert.match(anchor, /x-on:dblclick="keepLinkActivation"/);
        assert.match(anchor, /x-on:keydown.enter="keepLinkActivation"/);
        for (const type of ["dblclick", "keydown"]) {
            const event = new Event(type, { bubbles: true, cancelable: true });
            const stop = t.mock.method(event, "stopPropagation");
            controller.keepLinkActivation({ event });
            assert.equal(stop.mock.callCount(), 1);
            assert.equal(event.defaultPrevented, false);
        }
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
        areas: { resolvePath: () => null },
        resolver: { resolve: resource => resource === contractDetailHref ? { path: contractPath } : null },
        config: { app: { basePath: "", baseUrl: document.baseURI }, xshell: {} }
    }, { mode: "path" }, { container });
    navigation._stack = [navigation.parseUrl("/demo")];
    await ContractsPage.controller({ navigation, page: rootHost }).inspectContract({ event: { detail: { value: id } } });
    assert.equal(hosts[1].layout, "stack");
    assert.deepEqual(hosts[1].stackClasses, ["size-wide"]);

    // Discard the live stack and reconstruct its child Page from the browser URL.
    const reloaded = navigation._browserUrlToStack(pushState.mock.calls[0].arguments[2]);
    assert.deepEqual(reloaded[1].classes, ["size-wide"]);
    const page = new Page({ src: navigation._buildUrlFinal(reloaded[1]), bus: { emit() {} } });
    const state = structuredClone(ContractDetailPage.state);
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
            bus.dispatchEvent(new Event("xshell:service:created"));
            return instance;
        }
    };
    const contracts = { getContractById: id => id === "navigation" ? NavigationContract : { label: "Areas" } };
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
    const state = { id: "", label: "", description: "", moduleId: "", contractItems: [] };
    const contracts = { registry: [{ id: "toast", label: "Toast", description: "Messages", moduleId: "x", url: "/toast.json" }] };
    ContractsPage.controller({ state, contracts }).refresh();
    assert.deepEqual(state.contractItems, contracts.registry);
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

test("Navigation diagnostics lists menu definitions and composed routes and refreshes its search filters", (t) => {
    const state = Object.assign(new EventTarget(), structuredClone(NavigationPage.state));
    const menu = { name: "navigation", label: "Shop", description: "Find products.", icon: "x-shop",
        items: [{ label: "Catalog", children: [{ label: "Featured", href: "/pages/featured.js" }] }] };
    const definitions = [
        { id: "shop", prefix: "/shop", menus: { navigation: menu }, routes: [
            { path: "/products/{id}/{variant}", href: "/pages/detail.js", module: "products" },
            { path: "/products/featured", href: "/pages/featured.js", module: "marketing" },
            { path: "/", href: "/pages/shop.js", module: "products" }
        ] },
        { id: "root", prefix: "", menus: {}, routes: [{ path: "/", href: "/pages/root.js", module: "shell" }] }
    ];
    const bus = new EventTarget();
    globalThis.Node = { ELEMENT_NODE: 1, DOCUMENT_FRAGMENT_NODE: 11 };
    globalThis.document = { body: { nodeType: Node.ELEMENT_NODE, childNodes: [] } };
    t.after(() => {
        delete globalThis.Node;
        delete globalThis.document;
    });
    const controller = NavigationPage.controller({
        state, bus, areas: { getAreas: () => definitions }, events: createEvents(() => controller)
    });
    controller.load();

    assert.deepEqual(state.menus, [{ ...menu, id: "shop/navigation" }]);
    assert.deepEqual(state.routes, [
        { areaId: "shop", path: "/shop/products/{id}/{variant}", href: "/pages/detail.js", module: "products", parameters: "id, variant" },
        { areaId: "shop", path: "/shop/products/featured", href: "/pages/featured.js", module: "marketing", parameters: "" },
        { areaId: "shop", path: "/shop/", href: "/pages/shop.js", module: "products", parameters: "" },
        { areaId: "root", path: "/", href: "/pages/root.js", module: "shell", parameters: "" }
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
