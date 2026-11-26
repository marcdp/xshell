import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";

import AreasSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-areas.js";
import CommandsSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-commands.js";
import ModulesSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-modules.js";
import ShortcutsSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-shortcuts.js";
import FilesystemsSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/search-filesystems.js";
import Search from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/search.js";

test("module manifests resolve Search providers through the standard providers directory", () => {
    for (const [moduleName, expected] of [
        ["x", ["search-areas.js", "search-modules.js", "search-commands.js", "search-shortcuts.js"]],
        ["x-filesystem", ["search-filesystems.js"]]
    ]) {
        const moduleRoot = new URL(`../../src/DProjects.XShell/Resources/DProjects.XShell/${moduleName}/`, import.meta.url);
        const manifest = readFileSync(new URL("manifest.jsonc", moduleRoot), "utf8");
        const implementations = [...manifest.matchAll(/"implementation"\s*:\s*"\/providers\/(search-[^"]+\.js)"/g)].map(match => match[1]);
        assert.deepEqual(implementations, expected);
        for (const implementation of implementations) assert.equal(existsSync(new URL(`providers/${implementation}`, moduleRoot)), true, implementation);
        assert.equal(existsSync(new URL("search/", moduleRoot)), false);
    }
});

test("Areas provider searches current Area first and preserves friendly destinations and presentation", async () => {
    const definitions = {
        main: {scope: "area", items: [{label: "Reports", description: "Annual reports", path: "/main/reports", href: "/main/_assets/reports.js", module: "reports", open: "dock", children: []}]},
        admin: {scope: "area", items: [{label: "Reports Admin", href: "/admin/reports", module: "reports", children: []}]}
    };
    const areas = {
        getCurrentArea: () => ({id: "main"}),
        getAreas: () => [{id: "admin", label: "Admin"}, {id: "main", label: "Main", icon: "main"}],
        getMenu: (name, id) => definitions[id]
    };
    const provider = new AreasSearchProvider({areas, config: {modules: {reports: {icon: "reports"}}}});
    const results = await provider.query("reports", {limit: 1});
    assert.deepEqual(results.map(item => [item.id, item.href, item.open, item.category]), [
        ["main:/main/reports", "/main/reports", "dock", "Main"],
        ["admin:/admin/reports", "/admin/reports", "top", "Admin"]
    ]);
});

test("Shortcuts provider preserves supported modes and excludes self-embedded menu items", async () => {
    const areas = {getMenus: () => [{name: "global", scope: "global", label: "Global", icon: "global", items: [
        {label: "Search", href: "/search", open: "embed", outlet: "self", children: []},
        {label: "Settings", description: "Workspace settings", href: "/settings", open: "dialog", children: []},
        {label: "Group", children: [{label: "Logs", href: "/logs", open: "dock", children: []}]}
    ]}]};
    const provider = new ShortcutsSearchProvider({areas});
    assert.deepEqual((await provider.query("search", {limit: 10})), []);
    assert.deepEqual((await provider.query("settings", {limit: 10})).map(item => [item.href, item.open]), [["/settings", "dialog"]]);
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
        getAreas: () => [{id: "main", label: "Main"}],
        getMenu: () => ({scope: "area", items}),
        getMenus: () => [{name: "global", scope: "global", label: "Global", items}]
    };
    const areaResults = await new AreasSearchProvider({areas, config: {modules: {}}}).query("find", {limit: 1});
    const shortcutResults = await new ShortcutsSearchProvider({areas}).query("find", {limit: 1});
    assert.deepEqual(areaResults.map(item => [item.label, item.href]), [["Valid child", "/child"], ["Valid sibling", "/sibling"]]);
    assert.deepEqual(shortcutResults.map(item => [item.label, item.href]), [["Valid child", "/child"], ["Valid sibling", "/sibling"]]);

    const search = new Search({
        loader: {async load() { return ShortcutsSearchProvider; }},
        services: {resolve(name) { return name === "areas" ? areas : undefined; }}
    }, {providers: {shortcuts: {label: "Shortcuts", implementation: "/providers/search-shortcuts.js"}}});
    const response = await search.query("find", {limit: 10});
    assert.deepEqual(response.results.map(item => item.href), ["/child", "/sibling"]);
    assert.deepEqual(response.errors, []);
});

test("Search ranks every candidate from a bundled provider before applying its limit", async () => {
    const areas = {
        getCurrentArea: () => ({id: "main"}),
        getAreas: () => [{id: "main", label: "Main"}],
        getMenu: () => ({scope: "area", items: [
            {label: "Export customer documents", href: "/export", children: []},
            {label: "Import documents", href: "/import", children: []},
            {label: "Documents", href: "/documents", children: []}
        ]})
    };
    class Provider extends AreasSearchProvider {
        constructor() { super({areas, config: {modules: {}}}); }
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
    const areas = {getMenus: () => [
        {name: "primary", scope: "global", items: [
            {id: "filesystems", label: "Filesystems", children: [{id: "settings", label: "Settings", href: "/filesystems/settings", children: []}]},
            {id: "collections", label: "Collections", children: [{id: "settings", label: "Settings", href: "/collections/settings", children: []}]},
            {label: "Tools", module: "tools", children: [{id: "settings", label: "Settings", href: "/tools/settings", children: []}]},
            {label: "Tools", module: "tools", children: [{id: "settings", label: "Settings", href: "/other-tools/settings", children: []}]}
        ]},
        {name: "secondary", scope: "global", items: [{id: "settings", label: "Settings", href: "/secondary/settings", children: []}]}
    ]};
    const provider = new ShortcutsSearchProvider({areas});
    const first = await provider.query("settings", {limit: 1});
    const second = await provider.query("settings", {limit: 1});
    assert.equal(first.length, 5);
    assert.equal(new Set(first.map(item => item.id)).size, 5);
    assert.deepEqual(second.map(item => item.id), first.map(item => item.id));

    const search = new Search({
        loader: {async load() { return ShortcutsSearchProvider; }},
        services: {resolve(name) { return name === "areas" ? areas : undefined; }}
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
        id: "reports", label: "Reports", description: "Business analytics", icon: "x-module", category: "Modules", tags: ["finance"],
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
    assert.equal(opened, false);
    assert.equal(results[0].href, "page:x-filesystem:/pages/explorer.js?src=named%3Apersonal%20documents&path=%2F");
    assert.equal(results.length, 2);
});
