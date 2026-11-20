import assert from "node:assert/strict";
import test from "node:test";

import SearchPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/search.js";

test("Page search matches nested menu descriptions case-insensitively and keeps target metadata", () => {
    const shared = { label: "Orders", description: "Manage customer invoices", href: "/orders", target: "_blank", module: "orders" };
    const areas = {
        getCurrentArea: () => ({ id: "main" }),
        getAreas: () => [{ id: "main" }, { id: "admin" }],
        getMenu(name, areaId) {
            return areaId === "main"
                ? { items: [{ label: "Commerce", children: [shared] }] }
                : { items: [{ ...shared, label: "Duplicate" }, { label: "Audit", description: "INVOICE history", href: "/audit", module: "admin" }] };
        }
    };
    const state = { keyword: "invoice", results: [] };

    SearchPage.controller({ state, areas, config: { modules: { orders: { icon: "x-orders" }, admin: { icon: "x-admin" } } } }).search();

    assert.deepEqual(state.results.map(({ label, href, target, category, icon }) => ({ label, href, target, category, icon })), [
        { label: "Orders", href: "/orders", target: "_blank", category: "main", icon: "x-orders" },
        { label: "Audit", href: "/audit", target: undefined, category: "admin", icon: "x-admin" }
    ]);
});
