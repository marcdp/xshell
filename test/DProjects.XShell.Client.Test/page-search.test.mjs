import assert from "node:assert/strict";
import test from "node:test";

import SearchPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/search.js";

function createController(search, page) {
    const state = structuredClone(SearchPage.state);
    const subscriptions = [];
    const events = {on(target, name, handler) { subscriptions.push({target, name, handler}); }};
    return {state, subscriptions, controller: SearchPage.controller({page, state, events, search})};
}

function searchEnter(overrides = {}) {
    // Model a composed keyboard event retargeted to the datafield host.
    const target = {localName: "x-datafield"};
    const input = {matches: selector => selector === "input[type='search']"};
    return {key: "Enter", target, composedPath: () => [input, target], preventDefault() { this.defaultPrevented = true; }, ...overrides};
}

test("Search Page shows configured provider metadata in order and omits providers without prefixes", () => {
    const catalog = {id: "catalog", label: "Catalog", description: "Find entries", icon: "x-folder", prefixes: ["catalog:", ">"]};
    const archive = {id: "archive", label: "Archive", prefixes: ["archive:", ">"]};
    const search = {listProviders: () => [catalog, {id: "default", label: "Default", prefixes: []}, archive]};
    const {state, subscriptions, controller} = createController(search);
    controller.load();

    assert.equal(state.keyword, "");
    assert.equal(state.noResults, false);
    assert.deepEqual(state.providers, [catalog, archive]);
    assert.deepEqual(state.providers.flatMap(provider => provider.prefixes), ["catalog:", ">", "archive:", ">"]);
    assert.deepEqual(subscriptions.map(item => [item.name, item.handler]), [["change:keyword", "queueSearch"]]);
    assert.match(SearchPage.template, /x-if="!\(state.keyword \| trim\) && state.providers.length > 0"/);
    assert.match(SearchPage.template, /x-text="provider.label"/);
    assert.match(SearchPage.template, /x-if="provider.description" x-text="provider.description"/);
    assert.match(SearchPage.template, /x-if="provider.icon" x-attr:icon="provider.icon"/);
    assert.match(SearchPage.template, /<x-chip x-attr:label="prefix">/);
});

test("Search Page keeps empty guidance out of applications without any configured prefixes", () => {
    const search = {listProviders: () => [{id: "default", label: "Default", prefixes: []}]};
    const {state, controller} = createController(search);
    controller.load();

    assert.deepEqual(state.providers, []);
    assert.equal(state.noResults, false);
});

test("Search Page inserts literal prefixes and focuses the input without automatically searching", t => {
    t.mock.timers.enable({apis: ["setTimeout"]});
    const search = {
        listProviders: () => [{id: "catalog", label: "Catalog", prefixes: ["catalog:", ">"]}],
        query: t.mock.fn()
    };
    let focused = 0;
    const page = {host: null, get refs() {
        assert.ok(this.host);
        return {search: {focus() { focused++; }}};
    }};
    const {state, controller} = createController(search, page);
    controller.load();
    controller.focus();
    page.host = {};

    controller.selectPrefix({event: {currentTarget: {dataset: {prefix: ">"}}}});
    assert.equal(state.keyword, "> ");
    assert.equal(focused, 1);
    controller.selectPrefix({event: {currentTarget: {dataset: {prefix: "catalog:"}}}});
    controller.queueSearch();
    t.mock.timers.tick(200);
    assert.equal(state.keyword, "catalog: ");
    assert.equal(search.query.mock.callCount(), 0);
    assert.equal(focused, 2);
    controller.focus();
    assert.equal(focused, 3);
    assert.match(SearchPage.template, /<x-datafield ref="search"/);
    assert.match(SearchPage.template, /<button type="button" x-for="prefix in provider.prefixes" x-on:click="selectPrefix"/);
});

test("Search Page submits named and symbolic standalone prefixes only on Enter", async t => {
    t.mock.timers.enable({apis: ["setTimeout"]});
    const search = {
        listProviders: () => [{id: "catalog", label: "Catalog", prefixes: ["catalog:", ">"]}],
        query: t.mock.fn(async () => ({results: [], errors: []}))
    };
    const {state, controller} = createController(search);
    controller.load();
    assert.match(SearchPage.template, /<x-datafield\b[^>]*x-on:keydown.enter="submitSearch"/);

    state.results = [{id: "old", providerId: "test", type: "page", label: "Old result", href: "/old", open: "top"}];
    state.errors = [{message: "Earlier failure"}];
    state.errorMessage = "Earlier failure";
    for (const keyword of ["CaTaLoG: ", "> "]) {
        state.keyword = keyword;
        controller.queueSearch();
        assert.deepEqual(state.results, []);
        assert.deepEqual(state.errors, []);
        assert.equal(state.errorMessage, "");
        assert.equal(state.noResults, false);
        const priorCalls = search.query.mock.callCount();
        t.mock.timers.tick(200);
        assert.equal(search.query.mock.callCount(), priorCalls);
        const event = searchEnter();
        await controller.submitSearch({event});
        assert.equal(event.defaultPrevented, true);
        assert.equal(state.noResults, true);
        assert.equal(state.searched, keyword.trim());
    }
    for (const keyword of ["", "  ", "ab"]) {
        state.keyword = keyword;
        controller.queueSearch();
        const event = searchEnter();
        await controller.submitSearch({event});
        assert.equal(event.defaultPrevented, undefined);
        assert.equal(state.noResults, false);
    }
    assert.deepEqual(search.query.mock.calls.map(call => call.arguments[0]), ["CaTaLoG: ", "> "]);
});

test("Search Page submits eligible text immediately and avoids duplicate requests", async t => {
    t.mock.timers.enable({apis: ["setTimeout"]});
    const response = Promise.withResolvers();
    const search = {query: t.mock.fn(() => response.promise)};
    const {state, controller} = createController(search);
    state.keyword = "customers";
    controller.queueSearch();
    t.mock.timers.tick(199);
    assert.equal(search.query.mock.callCount(), 0);

    const submitted = controller.submitSearch({event: searchEnter()});
    assert.equal(state.loading, true);
    assert.equal(search.query.mock.callCount(), 1);
    t.mock.timers.tick(200);
    await controller.submitSearch({event: searchEnter()});
    assert.equal(search.query.mock.callCount(), 1);
    response.resolve({results: [], errors: []});
    await submitted;
    await controller.submitSearch({event: searchEnter({repeat: true})});
    assert.equal(search.query.mock.callCount(), 1);
});

test("Search Page ignores Enter from other controls and suspends searches during IME composition", async t => {
    t.mock.timers.enable({apis: ["setTimeout"]});
    const search = {query: t.mock.fn(async () => ({results: [], errors: []}))};
    const {state, controller} = createController(search);
    state.keyword = "initial";
    controller.queueSearch();
    controller.startComposition();
    state.keyword = "顧客名";
    controller.queueSearch();
    await controller.submitSearch({event: searchEnter()});
    t.mock.timers.tick(200);
    assert.equal(search.query.mock.callCount(), 0);

    controller.endComposition();
    for (const event of [searchEnter({isComposing: true}), searchEnter({keyCode: 229}),
        searchEnter({composedPath: () => [{matches: () => false}]})]) {
        await controller.submitSearch({event});
        assert.equal(event.defaultPrevented, undefined);
    }
    assert.equal(search.query.mock.callCount(), 0);
    t.mock.timers.tick(200);
    assert.deepEqual(search.query.mock.calls.map(call => call.arguments[0]), ["顧客名"]);
});

test("Search Page delegates to the Search Service and preserves result presentation modes", async () => {
    const calls = [];
    const search = {
        listProviders() { return []; },
        async query(text, options) {
            calls.push({text, options});
            return {results: [{id: "logs", providerId: "shortcuts", type: "shortcut", label: "Logs", href: "/logs", open: "dock"}], errors: []};
        }
    };
    const {state, controller} = createController(search);
    controller.load();
    await controller.search("logs");

    assert.equal(calls[0].text, "logs");
    assert.equal(calls[0].options.signal instanceof AbortSignal, true);
    assert.equal(state.results[0].open, "dock");
    assert.equal(state.results[0].type, "shortcut");
    assert.equal(state.searched, "logs");
    assert.equal(state.loading, false);
    assert.equal(state.noResults, false);
    assert.equal(SearchPage.template.includes("x-on:activate"), false);
    assert.equal(SearchPage.template.includes('x-attr:href="result.href"'), true);
    assert.equal(SearchPage.template.includes('x-attr:open="result.open"'), true);
    assert.match(SearchPage.template, /<x-chip x-attr:label="result.type">/);
    assert.doesNotMatch(SearchPage.template, /<x-chip x-attr:label="result.providerId">/);
    assert.ok(SearchPage.template.includes('x-attr:key="result.providerId + \':\' + result.id"'));
});

test("Search Page debounces text changes and keeps the three-character minimum in the UI", async () => {
    const calls = [];
    const search = {
        listProviders: () => [{id: "catalog", label: "Catalog", prefixes: ["cat.+", ">"]}],
        async query(text) { calls.push(text); return {results: [], errors: []}; }
    };
    const {state, controller} = createController(search);
    controller.load();
    state.keyword = "ab";
    controller.queueSearch();
    state.keyword = "first";
    controller.queueSearch();
    state.keyword = "  >Second  ";
    controller.queueSearch();
    await new Promise(resolve => setTimeout(resolve, 250));

    assert.deepEqual(calls, ["  >Second  "]);
    assert.equal(state.searched, ">Second");
    assert.equal(state.noResults, true);

    // A bare prefix stays idle, even when it exceeds the minimum and contains regex punctuation.
    state.keyword = "  CAT.+  ";
    controller.queueSearch();
    assert.equal(state.noResults, false);
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.deepEqual(calls, ["  >Second  "]);
    assert.equal(state.searched, "");

    // Leaving a completed expression hides its no-results message immediately and clearing cancels the timer.
    await controller.search("cat.+term");
    assert.equal(state.noResults, true);
    state.keyword = "new search";
    controller.queueSearch();
    assert.equal(state.noResults, false);
    state.keyword = "";
    controller.queueSearch();
    assert.equal(state.searched, "");
    assert.equal(state.noResults, false);
    assert.equal(state.providers.length, 1);
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.deepEqual(calls, ["  >Second  ", "cat.+term"]);
    assert.match(SearchPage.template, /x-if="!state.loading && state.noResults"/);
    controller.unload();
});

test("Search Page aborts superseded requests and ignores stale asynchronous responses", async () => {
    const pending = new Map();
    const signals = new Map();
    const search = {query(text, {signal}) {
        signals.set(text, signal);
        return new Promise(resolve => pending.set(text, resolve));
    }};
    const {state, controller} = createController(search);
    const first = controller.search("first");
    await new Promise(resolve => setImmediate(resolve));
    state.keyword = "second";
    const second = controller.submitSearch({event: searchEnter()});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(signals.get("first").aborted, true);

    pending.get("second")({results: [{id: "second", providerId: "test", type: "page", label: "Second", href: "/second", open: "top"}], errors: []});
    await second;
    pending.get("first")({results: [{id: "first", providerId: "test", type: "page", label: "First", href: "/first", open: "top"}], errors: []});
    await first;
    assert.deepEqual(state.results.map(item => item.id), ["second"]);
    assert.equal(state.searched, "second");
});

test("Search Page cancels pending timers and outstanding requests on unload", async t => {
    t.mock.timers.enable({apis: ["setTimeout"]});
    const queuedSearch = {query: t.mock.fn()};
    const queued = createController(queuedSearch);
    queued.state.keyword = "documents";
    queued.controller.queueSearch();
    queued.controller.unload();
    t.mock.timers.tick(200);
    assert.equal(queuedSearch.query.mock.callCount(), 0);

    let resolveQuery;
    let signal;
    const search = {query(text, options) {
        signal = options.signal;
        return new Promise(resolve => { resolveQuery = resolve; });
    }};
    const {state, controller} = createController(search);
    const pending = controller.search("documents");
    await new Promise(resolve => setImmediate(resolve));
    controller.unload();
    assert.equal(signal.aborted, true);
    resolveQuery({results: [{id: "documents", providerId: "test", type: "page", label: "Documents", href: "/documents", open: "top"}], errors: []});
    await pending;
    assert.deepEqual(state.results, []);
});

test("Search Page restores guidance when cleared during a request and discards the late response", async () => {
    let resolveQuery;
    let signal;
    const search = {
        listProviders: () => [{id: "catalog", label: "Catalog", prefixes: ["catalog:"]}],
        query(text, options) {
            signal = options.signal;
            return new Promise(resolve => { resolveQuery = resolve; });
        }
    };
    const {state, controller} = createController(search);
    controller.load();
    state.keyword = "catalog: book";
    const pending = controller.search();
    assert.equal(state.loading, true);

    state.keyword = "";
    controller.queueSearch();
    assert.equal(signal.aborted, true);
    assert.equal(state.loading, false);
    resolveQuery({results: [], errors: []});
    await pending;

    assert.equal(state.searched, "");
    assert.equal(state.noResults, false);
    assert.equal(state.providers[0].label, "Catalog");
});

test("Search Page displays successful results together with sanitized partial failures", async () => {
    const search = {async query() { return {
        results: [{id: "good", providerId: "good", type: "page", label: "Good", href: "/good", open: "dialog"}],
        errors: [{providerId: "failed", message: "Unable to search Failed."}]
    }; }};
    const {state, controller} = createController(search);
    const pending = controller.search("good");
    assert.equal(state.loading, true);
    assert.equal(state.noResults, false);
    await pending;
    assert.equal(state.loading, false);
    assert.deepEqual(state.results.map(item => item.id), ["good"]);
    assert.equal(state.errorMessage, "Unable to search Failed.");
    assert.equal(state.noResults, false);
    assert.equal(SearchPage.template.includes("x-notice"), true);
    assert.equal(SearchPage.template.includes("x-empty"), true);
});

test("Search Page displays a search failure without an empty-results message", async () => {
    const search = {async query() { throw new Error("internal detail"); }};
    const {state, controller} = createController(search);
    await controller.search("catalog");

    assert.equal(state.loading, false);
    assert.equal(state.noResults, false);
    assert.equal(state.errorMessage, "Search is temporarily unavailable.");
});
