import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";

import AreasSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-areas.js";
import CommandsSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-commands.js";
import ModulesSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-modules.js";
import ShortcutsSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/providers/search-shortcuts.js";
import FilesystemsSearchProvider from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/search-filesystems.js";

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
    const results = await provider.query("reports", {limit: 10});
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

test("Modules provider searches registry metadata without loading resources", async () => {
    const registry = [{id: "reports", label: "Reports", description: "Business analytics", tags: ["finance"], icon: null}];
    const provider = new ModulesSearchProvider({modules: {registry}});
    const results = await provider.query("finance", {limit: 10});
    assert.deepEqual(results, [{
        id: "reports", label: "Reports", description: "Business analytics", icon: "x-module", category: "Modules", tags: ["finance"],
        href: "page:x:/pages/preferences/modules.js", open: "stack"
    }]);
});

test("Commands provider discovers without executing and opens the invocation Page", async () => {
    let listOptions;
    let executed = false;
    const commands = {
        list(options) {
            listOptions = options;
            return [{id: "filesystem.entry.zip", label: "Download as ZIP", description: "Archive entries", icon: "x-zip", category: "Files", tags: ["archive"]}];
        },
        run() { executed = true; }
    };
    const provider = new CommandsSearchProvider({commands});
    const results = await provider.query("zip", {limit: 10});
    assert.deepEqual(listOptions, {query: "zip"});
    assert.equal(executed, false);
    assert.equal(results[0].href, "page:x:/pages/invoke.js?type=command&id=filesystem.entry.zip");
    assert.equal(results[0].open, "stack");
});

test("Filesystems provider preserves named registration identity without opening instances", async () => {
    let opened = false;
    const filesystems = {
        async listDefinitions() { return [{name: "personal documents", label: "Documents", description: "Personal projects"}]; },
        async open() { opened = true; }
    };
    const provider = new FilesystemsSearchProvider({filesystems});
    const results = await provider.query("documents", {limit: 10});
    assert.equal(opened, false);
    assert.equal(results[0].href, "page:x-filesystem:/pages/explorer.js?src=named%3Apersonal%20documents&path=%2F");
});
