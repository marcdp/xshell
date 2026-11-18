import assert from "node:assert/strict";
import test from "node:test";

import BusPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/bus.js";
import ModulesPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/modules.js";
import ServicesPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/services.js";
import LoaderPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/loader.js";
import ContractsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/contracts.js";
import NavigationPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/navigation.js";

function createEvents(getController) {
    return {
        on(target, type, listener) {
            target.addEventListener(type, typeof listener === "string" ? () => getController()[listener]() : listener);
        }
    };
}

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
    assert.deepEqual(Array.from(template.matchAll(/<x-tab label="([^"]+)"/g), match => match[1]), ["Areas", "Menus", "Routes", "Pages"]);
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

test("Navigation diagnostics lists composed routes in order and refreshes its search filters", (t) => {
    const state = Object.assign(new EventTarget(), structuredClone(NavigationPage.state));
    const definitions = [
        { id: "shop", prefix: "/shop", menus: {}, routes: [
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
