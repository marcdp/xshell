import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const sourceRoot = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);
const migrationFiles = [
    "x/pages/areas.js",
    "x/pages/search.js",
    "x-demo/pages/01-components/03-data.js",
    "x-demo/pages/01-components/08-listviews.js",
    "xshell-diagnostics/pages/bus.js",
    "xshell-diagnostics/pages/components.js",
    "xshell-diagnostics/pages/contracts.js",
    "xshell-diagnostics/pages/icons.js",
    "xshell-diagnostics/pages/loader.js",
    "xshell-diagnostics/pages/modules.js",
    "xshell-diagnostics/pages/navigation.js",
    "xshell-diagnostics/pages/pages.js",
    "xshell-diagnostics/pages/resolver.js",
    "xshell-diagnostics/pages/schemas.js",
    "xshell-diagnostics/pages/service-worker.js",
    "xshell-diagnostics/pages/services.js"
];

function readSource(path) {
    return readFileSync(new URL(path, sourceRoot), "utf8");
}

function listViews(source) {
    return [...source.matchAll(/<x-listview2(?=[\s>])[\s\S]*?<\/x-listview2>/g)].map(match => match[0]);
}

test("migrated application pages contain no legacy listview tags", () => {
    for (const path of migrationFiles) {
        const source = readSource(path);
        assert.doesNotMatch(source, /<\/?x-listview(?:-item)?(?=[\s>])/, path);
    }
});

test("every migrated listview has direct head and body containers", () => {
    for (const path of migrationFiles) {
        for (const listView of listViews(readSource(path))) {
            const openingTag = listView.match(/^<x-listview2\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/);
            assert.ok(openingTag, path);
            assert.match(listView.slice(openingTag[0].length), /^\s*<x-listview2-head[\s>]/, path);
            assert.match(listView, /<\/x-listview2-head>\s*<x-listview2-body[\s>]/, path);
            assert.match(listView, /<\/x-listview2-body>\s*<\/x-listview2>$/, path);

            const withoutBody = listView.replace(/<x-listview2-body[\s>][\s\S]*<\/x-listview2-body>/, "");
            assert.doesNotMatch(withoutBody, /<x-listview2-item[\s>]/, path);
        }
    }
});

test("details migrations preserve expected column counts and interactive headers", () => {
    const expectedColumns = new Map([
        ["xshell-diagnostics/pages/bus.js", [4]],
        ["xshell-diagnostics/pages/components.js", [6]],
        ["xshell-diagnostics/pages/contracts.js", [7]],
        ["xshell-diagnostics/pages/icons.js", [5]],
        ["xshell-diagnostics/pages/loader.js", [6]],
        ["xshell-diagnostics/pages/modules.js", [7]],
        ["xshell-diagnostics/pages/navigation.js", [6, 2]],
        ["xshell-diagnostics/pages/pages.js", [6]],
        ["xshell-diagnostics/pages/resolver.js", [5]],
        ["xshell-diagnostics/pages/schemas.js", [4]],
        ["xshell-diagnostics/pages/service-worker.js", [5]],
        ["xshell-diagnostics/pages/services.js", [7]]
    ]);

    for (const [path, counts] of expectedColumns) {
        const actual = listViews(readSource(path)).map(listView =>
            (listView.match(/<x-listview2-column(?=[\s>])/g) || []).length
        );
        assert.deepEqual(actual, counts, path);
    }

    assert.match(readSource("xshell-diagnostics/pages/bus.js"), /<x-listview2-column[^>]*>[\s\S]*<x-datafield[^>]*x-model="state\.query_type"/);
    assert.match(readSource("xshell-diagnostics/pages/bus.js"), /<x-listview2-column[^>]*>[\s\S]*<x-button[^>]*command="clear"/);
    assert.match(readSource("xshell-diagnostics/pages/loader.js"), /<x-listview2-column[^>]*>[\s\S]*<x-button[^>]*command="clear"/);
});

test("migration preserves dynamic items, navigation, selection, auto-scroll, and treeview", () => {
    const areas = readSource("x/pages/areas.js");
    assert.match(areas, /x-for="area in state\.areas"/);
    assert.match(areas, /x-prop:selected="state\.selected == area\.id"/);
    assert.match(areas, /x-attr:href="area\.home"/);
    assert.match(areas, /open="top"/);

    const search = readSource("x/pages/search.js");
    assert.match(search, /x-if="state\.results\.length > 0"/);
    assert.match(search, /x-for="result in state\.results"/);
    assert.match(search, /x-attr:target="result\.target"/);

    assert.match(readSource("xshell-diagnostics/pages/bus.js"), /<x-listview2[^>]*ref="listview"[^>]*auto-scroll="true"/);
    assert.match(readSource("xshell-diagnostics/pages/loader.js"), /<x-listview2[^>]*auto-scroll/);

    const navigation = readSource("xshell-diagnostics/pages/navigation.js");
    assert.match(navigation, /<x-treeview>/);
    assert.match(navigation, /<x-treeview-item x-recursive=/);
});

test("demo covers all views, switchable presentation, default-slot cells, and a working header filter", () => {
    const demo = readSource("x-demo/pages/01-components/08-listviews.js");
    for (const view of ["list", "details", "tiles", "icons"]) {
        assert.match(demo, new RegExp(`view="${view}"`));
    }
    assert.match(demo, /views="list,details,tiles,icons"/);
    assert.match(demo, /<x-listview2-column[^>]*>[\s\S]*x-model="state\.status"/);
    assert.match(demo, /x-show="!state\.status/);
    assert.doesNotMatch(demo, /<x-listview2-item[\s\S]*?slot="column"/);
});
