import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const sourceRoot = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);
const structureFiles = [
    "x/pages/search.js",
    "x-demo/pages/01-components/05-listviews.js",
    "xshell-diagnostics/pages/runtime/bus.js",
    "xshell-diagnostics/pages/ui/components.js",
    "xshell-diagnostics/pages/apis/commands.js",
    "xshell-diagnostics/pages/apis/contracts.js",
    "xshell-diagnostics/pages/ui/icons.js",
    "xshell-diagnostics/pages/resources/loader.js",
    "xshell-diagnostics/pages/application/modules.js",
    "xshell-diagnostics/pages/ui/navigation.js",
    "xshell-diagnostics/pages/ui/pages.js",
    "xshell-diagnostics/pages/resources/resolver.js",
    "xshell-diagnostics/pages/resources/schemas.js",
    "xshell-diagnostics/pages/browser/service-worker.js",
    "xshell-diagnostics/pages/apis/services.js"
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

test("every listview has a direct body after its optional head", () => {
    for (const path of structureFiles) {
        for (const listView of listViews(readSource(path))) {
            const openingTag = listView.match(/^<x-listview\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/);
            assert.ok(openingTag, path);
            assert.match(listView.slice(openingTag[0].length), /^\s*(?:<x-listview-head[\s>][\s\S]*?<\/x-listview-head>\s*)?<x-listview-body[\s>]/, path);
            assert.match(listView, /<\/x-listview-body>\s*<\/x-listview>$/, path);

            const withoutBody = listView.replace(/<x-listview-body[\s>][\s\S]*<\/x-listview-body>/, "");
            assert.doesNotMatch(withoutBody, /<x-listview-item[\s>]/, path);
        }
    }
});

test("details listviews preserve expected column counts and interactive headers", () => {
    const expectedColumns = new Map([
        ["xshell-diagnostics/pages/runtime/bus.js", [4]],
        ["xshell-diagnostics/pages/ui/components.js", [9]],
        ["xshell-diagnostics/pages/apis/commands.js", [8]],
        ["xshell-diagnostics/pages/apis/contracts.js", [9]],
        ["xshell-diagnostics/pages/ui/icons.js", [6]],
        ["xshell-diagnostics/pages/resources/loader.js", [7]],
        ["xshell-diagnostics/pages/application/modules.js", [10]],
        ["xshell-diagnostics/pages/ui/navigation.js", [5, 4, 5]],
        ["xshell-diagnostics/pages/ui/pages.js", [9]],
        ["xshell-diagnostics/pages/resources/resolver.js", [5]],
        ["xshell-diagnostics/pages/resources/schemas.js", [7]],
        ["xshell-diagnostics/pages/browser/service-worker.js", [5]],
        ["xshell-diagnostics/pages/apis/services.js", [12]]
    ]);

    for (const [path, counts] of expectedColumns) {
        const actual = listViews(readSource(path)).map(listView =>
            (listView.match(/<x-listview-column(?=[\s>])/g) || []).length
        );
        assert.deepEqual(actual, counts, path);
    }

    assert.match(readSource("xshell-diagnostics/pages/runtime/bus.js"), /<x-listview-column[^>]*>[\s\S]*<x-datafield[^>]*x-model="state\.query_type"/);
    assert.match(readSource("xshell-diagnostics/pages/runtime/bus.js"), /<x-listview-column[^>]*>[\s\S]*<x-button[^>]*command="clear"/);
    assert.match(readSource("xshell-diagnostics/pages/resources/loader.js"), /<x-listview-column[^>]*>[\s\S]*<x-button[^>]*command="clear"/);
});

test("listview pages preserve dynamic items, navigation, selection, auto-scroll, and treeview", () => {
    const search = readSource("x/pages/search.js");
    assert.match(search, /x-if="state\.results\.length > 0"/);
    assert.match(search, /x-for="result in state\.results"/);
    assert.match(search, /x-attr:href="result\.href"/);
    assert.match(search, /x-attr:open="result\.open"/);
    assert.doesNotMatch(search, /x-on:activate=/);

    assert.match(readSource("xshell-diagnostics/pages/runtime/bus.js"), /<x-listview[^>]*ref="listview"[^>]*auto-scroll="true"/);
    assert.match(readSource("xshell-diagnostics/pages/resources/loader.js"), /<x-listview[^>]*auto-scroll/);

    const navigation = readSource("xshell-diagnostics/pages/ui/navigation.js");
    assert.match(navigation, /<x-treeview>/);
    assert.match(navigation, /<x-treeview-item x-recursive=/);
});

test("demo covers view switching, default-slot cells, selection, and navigation", () => {
    const demo = readSource("x-demo/pages/01-components/05-listviews.js");
    for (const view of ["list", "details", "tiles", "icons"]) {
        assert.match(demo, new RegExp(`views="[^"]*${view}`));
    }
    assert.match(demo, /<x-listview[^>]*x-on:select="onSelect"[^>]*x-on:activate="onActivate"/);
    assert.match(demo, /<x-listview[^>]*multiple[^>]*x-on:select="onMultiSelect"/);
    assert.match(demo, /<x-listview-item[^>]*href="01-buttons\.js"/);
    assert.match(demo, /<x-listview-item[^>]*x-prop:value="customer\.id"/);
    assert.match(demo, /event\.detail\.values/);
    assert.match(demo, /event\.detail\.value/);
    assert.match(demo, /<x-listview-item[^>]*>[\s\S]*?<span>Folder<\/span>/);
    assert.doesNotMatch(demo, /<x-listview-item[\s\S]*?slot="column"/);
});
