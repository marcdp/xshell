import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const sourceRoot = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);
const structureFiles = [
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
    return [...source.matchAll(/<x-listview(?=[\s>])[\s\S]*?<\/x-listview>/g)].map(match => match[0]);
}

test("application pages contain canonical listview structures", () => {
    for (const path of structureFiles) {
        assert.ok(listViews(readSource(path)).length > 0, path);
    }
});

test("every listview has direct head and body containers", () => {
    for (const path of structureFiles) {
        for (const listView of listViews(readSource(path))) {
            const openingTag = listView.match(/^<x-listview\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/);
            assert.ok(openingTag, path);
            assert.match(listView.slice(openingTag[0].length), /^\s*<x-listview-head[\s>]/, path);
            assert.match(listView, /<\/x-listview-head>\s*<x-listview-body[\s>]/, path);
            assert.match(listView, /<\/x-listview-body>\s*<\/x-listview>$/, path);

            const withoutBody = listView.replace(/<x-listview-body[\s>][\s\S]*<\/x-listview-body>/, "");
            assert.doesNotMatch(withoutBody, /<x-listview-item[\s>]/, path);
        }
    }
});

test("details listviews preserve expected column counts and interactive headers", () => {
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
            (listView.match(/<x-listview-column(?=[\s>])/g) || []).length
        );
        assert.deepEqual(actual, counts, path);
    }

    assert.match(readSource("xshell-diagnostics/pages/bus.js"), /<x-listview-column[^>]*>[\s\S]*<x-datafield[^>]*x-model="state\.query_type"/);
    assert.match(readSource("xshell-diagnostics/pages/bus.js"), /<x-listview-column[^>]*>[\s\S]*<x-button[^>]*command="clear"/);
    assert.match(readSource("xshell-diagnostics/pages/loader.js"), /<x-listview-column[^>]*>[\s\S]*<x-button[^>]*command="clear"/);
});

test("listview pages preserve dynamic items, navigation, selection, auto-scroll, and treeview", () => {
    const areas = readSource("x/pages/areas.js");
    assert.match(areas, /x-for="area in state\.areas"/);
    assert.match(areas, /x-prop:selected="state\.selected == area\.id"/);
    assert.match(areas, /x-attr:href="area\.home"/);
    assert.match(areas, /open="top"/);

    const search = readSource("x/pages/search.js");
    assert.match(search, /x-if="state\.results\.length > 0"/);
    assert.match(search, /x-for="result in state\.results"/);
    assert.match(search, /x-attr:target="result\.target"/);

    assert.match(readSource("xshell-diagnostics/pages/bus.js"), /<x-listview[^>]*ref="listview"[^>]*auto-scroll="true"/);
    assert.match(readSource("xshell-diagnostics/pages/loader.js"), /<x-listview[^>]*auto-scroll/);

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
    assert.match(demo, /<x-listview-column[^>]*>[\s\S]*x-model="state\.status"/);
    assert.match(demo, /x-show="!state\.status/);
    assert.doesNotMatch(demo, /<x-listview-item[\s\S]*?slot="column"/);
});
