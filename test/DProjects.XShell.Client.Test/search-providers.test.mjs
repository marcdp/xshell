import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";

import AreasSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-areas.js";
import CommandsSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-commands.js";
import ModulesSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-modules.js";
import QueriesSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-queries.js";
import ShortcutsSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-shortcuts.js";
import FilesystemsSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/search-filesystems.js";
import StoresSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/providers/search-stores.js";
import SampleStore from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/samples/store.json" with {type: "json"};
import Search from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/search.js";

test("module manifests resolve Search providers through the standard providers directory", () => {
    for (const [moduleName, expected] of [
        ["x", ["search-areas.js", "search-modules.js", "search-commands.js", "search-queries.js", "search-shortcuts.js"]],
        ["x-filesystem", ["search-filesystems.js"]],
        ["x-store", ["search-stores.js"]]
    ]) {
        const moduleRoot = new URL(`../../src/DProjects.XShell/Resources/DProjects.XShell/${moduleName}/`, import.meta.url);
        const manifest = readFileSync(new URL("manifest.jsonc", moduleRoot), "utf8");
        const implementations = [...manifest.matchAll(/"implementation"\s*:\s*"\/providers\/(search-[^"]+\.js)"/g)].map(match => match[1]);
        assert.deepEqual(implementations, expected);
        for (const implementation of implementations) assert.equal(existsSync(new URL(`providers/${implementation}`, moduleRoot)), true, implementation);
        assert.equal(existsSync(new URL("search/", moduleRoot)), false);
    }
});

test("Store expressions discover collections from the configured sources without reading documents", async t => {
    // Exercise the authored prefix, explicit selection, and collection navigation through Search.
    const manifestPath = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/manifest.jsonc", import.meta.url);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\s*\/\/.*$/gm, ""));
    const {providers} = manifest.xshell.services.search.options;
    const list = t.mock.fn();
    const stores = {open: t.mock.fn(async () => ({schema: SampleStore.schema, list}))};
    const loader = {load: t.mock.fn(async () => StoresSearchProvider)};
    const search = new Search({loader, services: {resolve(name) { return name === "stores" ? stores : undefined; }}}, {providers});

    assert.deepEqual(search.listProviders().map(provider => provider.prefixes), [["store:"]]);
    assert.deepEqual(await search.query("customers"), {results: [], errors: []});
    assert.equal(loader.load.mock.callCount(), 0);
    const {results, errors} = await search.query("store: CUSTOMER RECORDS");
    assert.deepEqual(errors, []);
    assert.deepEqual(results.map(item => [item.providerId, item.type, item.label, item.description, item.href, item.open]), [
        ["stores", "collection", "Customers", "Customer records", "page:x-store:/pages/store.js?src=mem%3A&collection=customers", "stack"]
    ]);
    assert.deepEqual(loader.load.mock.calls.map(call => call.arguments), [["esm:/providers/search-stores.js"]]);
    assert.deepEqual(stores.open.mock.calls.map(call => call.arguments), [["mem:"]]);
    assert.deepEqual((await search.query("store:")).results.map(item => item.label), ["Customers", "Products"]);
    assert.equal(list.mock.callCount(), 0);
});

test("Stores provider encodes collection coordinates and aborts before opening the next source", async t => {
    const schema = {label: "Store", collections: {"pending & active": {label: "Pending Orders"}}};
    const open = t.mock.fn(async () => ({schema}));
    const provider = new StoresSearchProvider({stores: {open}}, {sources: ["mem:daily + weekly"]});
    const [result] = await provider.query("pending", {});
    assert.equal(result.href, "page:x-store:/pages/store.js?src=mem%3Adaily%20%2B%20weekly&collection=pending%20%26%20active");

    const abort = new AbortController();
    const openAndAbort = t.mock.fn(async () => {
        abort.abort();
        return {schema};
    });
    const canceled = new StoresSearchProvider({stores: {open: openAndAbort}}, {sources: ["mem:one", "mem:two"]});
    await assert.rejects(canceled.query("pending", {signal: abort.signal}), {name: "AbortError"});
    assert.deepEqual(openAndAbort.mock.calls.map(call => call.arguments), [["mem:one"]]);
});

test("bundled prefixes select their configured providers and discover Commands and Queries without executing them", async t => {
    // Use the authored provider IDs, modes, and aliases end to end.
    const manifestPath = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x/manifest.jsonc", import.meta.url);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\s*\/\/.*$/gm, ""));
    const {providers} = manifest.xshell.services.search.options;
    const list = ({query}) => query ? [{id: "customers"}] : [{id: "products"}, {id: "customers"}];
    const commands = {list: t.mock.fn(list), run: t.mock.fn()};
    const queries = {list: t.mock.fn(list), run: t.mock.fn()};
    const dependencies = {
        commands, queries,
        areas: {
            getCurrentArea: () => null,
            getAreas: () => [{id: "shop"}]
        },
        menus: {
            getMenu: () => ({scope: "area", items: [
                {label: "Products", path: "/products", href: "page:shop:/pages/products.js", module: "shop"},
                {label: "Customers", path: "/customers", href: "page:shop:/pages/customers.js", module: "shop"}
            ]})
        },
        config: {modules: {}},
        modules: {registry: [{id: "products"}, {id: "customers"}]}
    };
    const implementations = {
        "esm:/providers/search-areas.js": AreasSearchProvider,
        "esm:/providers/search-commands.js": CommandsSearchProvider,
        "esm:/providers/search-modules.js": ModulesSearchProvider,
        "esm:/providers/search-queries.js": QueriesSearchProvider
    };
    const load = t.mock.fn(async key => implementations[key]);
    const search = new Search({
        loader: {load},
        services: {resolve(name) { return dependencies[name]; }}
    }, {providers});

    for (const [expression, providerId, type, href] of [
        [">customers", "commands", "command", "page:x:/pages/invoke.js?type=command&id=customers"],
        ["command: customers", "commands", "command", "page:x:/pages/invoke.js?type=command&id=customers"],
        ["query: customers", "queries", "query", "page:x:/pages/invoke.js?type=query&id=customers&method=query"],
        ["page: customers", "areas", "page", "/customers"],
        ["module: customers", "modules", "module", "page:x:/pages/preferences/modules.js"]
    ]) {
        const {results, errors} = await search.query(expression);
        assert.deepEqual(errors, []);
        assert.deepEqual(results.map(item => [item.providerId, item.type, item.href]), [[providerId, type, href]]);
    }
    assert.deepEqual(providers.commands.prefixes, ["command:", "commands:", ">"]);
    for (const expression of ["command:", "commands:", ">", "query:", "module:", "page:"]) {
        const {results, errors} = await search.query(expression);
        assert.deepEqual(errors, []);
        assert.deepEqual(results.map(item => item.label.toLowerCase()), ["products", "customers"]);
    }
    assert.deepEqual(commands.list.mock.calls.map(call => call.arguments[0].query), ["customers", "customers", "", "", ""]);
    assert.deepEqual(queries.list.mock.calls.map(call => call.arguments[0].query), ["customers", ""]);
    assert.deepEqual(load.mock.calls.map(call => call.arguments[0]), [
        "esm:/providers/search-commands.js", "esm:/providers/search-queries.js", "esm:/providers/search-areas.js", "esm:/providers/search-modules.js"
    ]);
    assert.equal(commands.run.mock.callCount(), 0);
    assert.equal(queries.run.mock.callCount(), 0);
});

test("Areas provider distinguishes known Pages from shortcuts while preserving destinations and order", async () => {
    const definitions = {
        main: {scope: "area", items: [
            {label: "Reports", path: "/main/reports", href: "/main/_assets/reports/build/pages/reports.js?year=2026#summary", module: "reports", open: "dock"},
            {label: "Reports Help", href: "/main/_assets/reports/build/pages/help.md"},
            {label: "Reports Export", href: "/main/_assets/reports/build/utils/export.js"},
            {label: "Reports Status", href: "https://example.test/pages/reports.js"},
            {label: "Reports Route", path: "/main/reports-route"}
        ]},
        admin: {scope: "area", items: [{label: "Reports Admin", href: "page:reports:/pages/admin.js?tab=year"}]}
    };
    const areas = {
        getCurrentArea: () => ({id: "main"}),
        getAreas: () => [{id: "admin", label: "Admin", prefix: "/admin"}, {id: "main", label: "Main", prefix: "/main"}]
    };
    const menus = {
        getMenu: (name, id) => definitions[id]
    };
    const provider = new AreasSearchProvider({areas, menus, config: {modules: {reports: {icon: "reports", files: [
        {path: "/_assets/reports/build/pages/reports.html", resource: {type: "page"}},
        {path: "/_assets/reports/build/pages/help.md", resource: {type: "page"}},
        {path: "/_assets/reports/build/utils/export.js"}
    ]}}}});
    const results = await provider.query("reports", {limit: 1});
    assert.deepEqual(results.map(item => [item.type, item.href, item.open, item.category]), [
        ["page", "/main/reports", "dock", "Main"],
        ["page", "/main/_assets/reports/build/pages/help.md", "top", "Main"],
        ["shortcut", "/main/_assets/reports/build/utils/export.js", "top", "Main"],
        ["shortcut", "https://example.test/pages/reports.js", "top", "Main"],
        ["shortcut", "/main/reports-route", "top", "Main"],
        ["page", "page:reports:/pages/admin.js?tab=year", "top", "Admin"]
    ]);
    assert.equal(results[0].id, "main:/main/reports");
});

test("Shortcuts provider preserves supported modes and excludes self-embedded menu items", async () => {
    const menus = {getMenus: () => [{name: "global", scope: "global", label: "Global", icon: "global", items: [
        {label: "Search", href: "/search", open: "embed", outlet: "self", children: []},
        {label: "Settings", description: "Workspace settings", href: "/settings", open: "dialog", children: []},
        {label: "Group", children: [{label: "Logs", href: "/logs", open: "dock", children: []}]}
    ]}]};
    const provider = new ShortcutsSearchProvider({menus});
    assert.deepEqual((await provider.query("search", {limit: 10})), []);
    assert.deepEqual((await provider.query("settings", {limit: 10})).map(item => [item.type, item.href, item.open]), [["shortcut", "/settings", "dialog"]]);
    assert.deepEqual((await provider.query("logs", {limit: 10})).map(item => [item.href, item.open]), [["/logs", "dock"]]);
});

test("menu providers exclude non-displayable items while preserving valid siblings and descendants", async () => {
    const items = [
        {label: "", description: "Find invalid", href: "/empty-label", children: []},
        {label: "   ", description: "Find invalid", href: "/whitespace-label", children: []},
        {label: "Missing destination", description: "Find invalid", children: []},
        {label: "Empty destination", description: "Find invalid", href: "   ", children: []},
        {label: "-", description: "Find invalid", href: "/separator", children: []},
        {label: "Embedded", description: "Find invalid", href: "/embedded", open: "embed", children: []},
        {label: "Targetless group", description: "Find group", children: [{label: "Valid child", description: "Find valid", href: "/child", children: []}]},
        {label: "Valid sibling", description: "Find valid", href: "/sibling", children: []}
    ];
    const areas = {
        getCurrentArea: () => ({id: "main"}),
        getAreas: () => [{id: "main", label: "Main"}]
    };
    const menus = {
        getMenu: () => ({scope: "area", items}),
        getMenus: () => [{name: "global", scope: "global", label: "Global", items}]
    };
    const areaResults = await new AreasSearchProvider({areas, menus, config: {modules: {}}}).query("find", {limit: 1});
    const shortcutResults = await new ShortcutsSearchProvider({menus}).query("find", {limit: 1});
    assert.deepEqual(areaResults.map(item => [item.label, item.href]), [["Valid child", "/child"], ["Valid sibling", "/sibling"]]);
    assert.deepEqual(shortcutResults.map(item => [item.label, item.href]), [["Valid child", "/child"], ["Valid sibling", "/sibling"]]);

    const search = new Search({
        loader: {async load() { return ShortcutsSearchProvider; }},
        services: {resolve(name) { return name === "menus" ? menus : undefined; }}
    }, {providers: {shortcuts: {label: "Shortcuts", implementation: "/providers/search-shortcuts.js"}}});
    const response = await search.query("find", {limit: 10});
    assert.deepEqual(response.results.map(item => item.href), ["/child", "/sibling"]);
    assert.deepEqual(response.errors, []);
});

test("Search ranks every candidate from a bundled provider before applying its limit", async () => {
    const areas = {
        getCurrentArea: () => ({id: "main"}),
        getAreas: () => [{id: "main", label: "Main"}]
    };
    const menus = {
        getMenu: () => ({scope: "area", items: [
            {label: "Export customer documents", href: "/export", children: []},
            {label: "Import documents", href: "/import", children: []},
            {label: "Documents", href: "/documents", children: []}
        ]})
    };
    class Provider extends AreasSearchProvider {
        constructor() { super({areas, menus, config: {modules: {}}}); }
    }
    const search = new Search({
        loader: {async load() { return Provider; }},
        services: {resolve() { return undefined; }}
    }, {providers: {areas: {label: "Areas", implementation: "/providers/search-areas.js"}}});

    const response = await search.query("documents", {limit: 2});
    assert.deepEqual(response.results.map(item => item.label), ["Documents", "Export customer documents"]);
    assert.equal(response.results.length, 2);
});

test("Shortcuts provider creates stable hierarchical identities for sibling-scoped IDs", async () => {
    const menus = {getMenus: () => [
        {name: "primary", scope: "global", items: [
            {id: "filesystems", label: "Filesystems", children: [{id: "settings", label: "Settings", href: "/filesystems/settings", children: []}]},
            {id: "collections", label: "Collections", children: [{id: "settings", label: "Settings", href: "/collections/settings", children: []}]},
            {label: "Tools", module: "tools", children: [{id: "settings", label: "Settings", href: "/tools/settings", children: []}]},
            {label: "Tools", module: "tools", children: [{id: "settings", label: "Settings", href: "/other-tools/settings", children: []}]}
        ]},
        {name: "secondary", scope: "global", items: [{id: "settings", label: "Settings", href: "/secondary/settings", children: []}]}
    ]};
    const provider = new ShortcutsSearchProvider({menus});
    const first = await provider.query("settings", {limit: 1});
    const second = await provider.query("settings", {limit: 1});
    assert.equal(first.length, 5);
    assert.equal(new Set(first.map(item => item.id)).size, 5);
    assert.deepEqual(second.map(item => item.id), first.map(item => item.id));

    const search = new Search({
        loader: {async load() { return ShortcutsSearchProvider; }},
        services: {resolve(name) { return name === "menus" ? menus : undefined; }}
    }, {providers: {shortcuts: {label: "Shortcuts", implementation: "/providers/search-shortcuts.js"}}});
    const response = await search.query("settings", {limit: 10});
    assert.deepEqual(response.results.map(item => item.href), first.map(item => item.href));
    assert.deepEqual(response.errors, []);
});

test("Modules provider searches all registry metadata without loading resources", async () => {
    const registry = [
        {id: "reports", label: "Reports", description: "Business analytics", tags: ["finance"], icon: null},
        {id: "ledger", label: "Ledger", description: "Financial records", tags: ["finance"], icon: "ledger"}
    ];
    const provider = new ModulesSearchProvider({modules: {registry}});
    const results = await provider.query("finance", {limit: 1});
    assert.deepEqual(results[0], {
        id: "reports", type: "module", label: "Reports", description: "Business analytics", icon: "x-module", category: "Modules", tags: ["finance"],
        href: "page:x:/pages/preferences/modules.js", open: "stack"
    });
    assert.equal(results.length, 2);
});

test("Commands provider discovers without executing and opens the invocation Page", async () => {
    let listOptions;
    let executed = false;
    const commands = {
        list(options) {
            listOptions = options;
            return [
                {id: "filesystem.entry.zip", label: "Download as ZIP", description: "Archive entries", icon: "x-zip", category: "Files", tags: ["archive"]},
                {id: "filesystem.entry.unzip", label: "Extract ZIP", description: "Unarchive entries", icon: "x-unzip", category: "Files", tags: ["archive"]}
            ];
        },
        run() { executed = true; }
    };
    const provider = new CommandsSearchProvider({commands});
    const results = await provider.query("zip", {limit: 1});
    assert.deepEqual(listOptions, {query: "zip"});
    assert.equal(executed, false);
    assert.equal(results[0].href, "page:x:/pages/invoke.js?type=command&id=filesystem.entry.zip");
    assert.equal(results[0].open, "stack");
    assert.equal(results.length, 2);
});

test("Queries provider returns discovery metadata and opens the exact Query ID in the invocation Page", async t => {
    // Include a nested ID and inventory metadata that should survive the projection.
    const id = "customers/active.count";
    const tags = Object.freeze(["customers"]);
    const queries = {
        list: t.mock.fn(() => [
            {id, label: "Count active customers", description: "Counts matching customers", icon: "x-people", category: "catalog", tags},
            {id: "customers.detail"}
        ]),
        run: t.mock.fn()
    };
    const provider = new QueriesSearchProvider({queries});
    const [count, detail] = await provider.query("customers", {limit: 1});

    assert.deepEqual(queries.list.mock.calls[0].arguments, [{query: "customers"}]);
    assert.equal(queries.run.mock.callCount(), 0);
    assert.deepEqual(count, {
        id, type: "query", label: "Count active customers", description: "Counts matching customers", icon: "x-people", category: "catalog", tags,
        href: "page:x:/pages/invoke.js?type=query&id=customers%2Factive.count&method=query", open: "stack"
    });
    assert.notStrictEqual(count.tags, tags);
    assert.deepEqual([detail.label, detail.icon, detail.category, detail.tags], ["customers.detail", "x-search", "Queries", []]);
    await assert.rejects(provider.query("customers", {signal: AbortSignal.abort()}), {name: "AbortError"});
    assert.equal(queries.list.mock.callCount(), 1);
});

test("Filesystems provider preserves named registration identity without opening instances", async () => {
    let opened = false;
    const filesystems = {
        async listDefinitions() { return [
            {name: "personal documents", label: "Documents", description: "Personal projects"},
            {name: "shared documents", label: "Shared documents", description: "Team projects"}
        ]; },
        async open() { opened = true; }
    };
    const provider = new FilesystemsSearchProvider({filesystems});
    const results = await provider.query("documents", {limit: 1});
    assert.deepEqual(await provider.query("", {}), results);
    assert.equal(opened, false);
    assert.equal(results[0].type, "filesystem");
    assert.equal(results[0].href, "page:x-filesystem:/pages/explorer.js?src=named%3Apersonal%20documents&path=%2F");
    assert.equal(results.length, 2);
});
