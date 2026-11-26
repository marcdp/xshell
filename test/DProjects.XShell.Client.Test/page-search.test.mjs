import assert from "node:assert/strict";
import test from "node:test";

import SearchPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/search.js";

function createController(search) {
    const state = structuredClone(SearchPage.state);
    const subscriptions = [];
    const events = {on(target, name, handler) { subscriptions.push({target, name, handler}); }};
    return {state, subscriptions, controller: SearchPage.controller({state, events, search})};
}

test("Search Page delegates to the Search Service and preserves result presentation modes", async () => {
    const calls = [];
    const search = {
        listProviders() { return [{prefixes: ["command:", ">"]}, {prefixes: ["command:", "custom:"]}, {prefixes: []}]; },
        async query(text, options) {
            calls.push({text, options});
            return {results: [{id: "logs", providerId: "shortcuts", label: "Logs", href: "/logs", open: "dock"}], errors: []};
        }
    };
    const {state, subscriptions, controller} = createController(search);
    controller.load();
    await controller.search("logs");

    assert.deepEqual(subscriptions.map(item => [item.name, item.handler]), [["change:keyword", "queueSearch"]]);
    assert.equal(state.prefixHint, "To target a provider, start with command:, >, custom: followed by search text.");
    assert.equal(SearchPage.template.includes('x-attr:description="state.prefixHint"'), true);
    assert.equal(calls[0].text, "logs");
    assert.equal(calls[0].options.signal instanceof AbortSignal, true);
    assert.equal(state.results[0].open, "dock");
    assert.equal(state.searched, "logs");
    assert.equal(state.loading, false);
    assert.equal(SearchPage.template.includes("x-on:activate"), false);
    assert.equal(SearchPage.template.includes('x-attr:href="result.href"'), true);
    assert.equal(SearchPage.template.includes('x-attr:open="result.open"'), true);
});

test("Search Page debounces text changes and keeps the three-character minimum in the UI", async () => {
    const calls = [];
    const search = {async query(text) { calls.push(text); return {results: [], errors: []}; }};
    const {state, controller} = createController(search);
    state.keyword = "ab";
    controller.queueSearch();
    state.keyword = "first";
    controller.queueSearch();
    state.keyword = "  >Second  ";
    controller.queueSearch();
    await new Promise(resolve => setTimeout(resolve, 250));

    assert.deepEqual(calls, ["  >Second  "]);
    assert.equal(state.searched, ">Second");
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
    const second = controller.search("second");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(signals.get("first").aborted, true);

    pending.get("second")({results: [{id: "second", providerId: "test", label: "Second", href: "/second", open: "top"}], errors: []});
    await second;
    pending.get("first")({results: [{id: "first", providerId: "test", label: "First", href: "/first", open: "top"}], errors: []});
    await first;
    assert.deepEqual(state.results.map(item => item.id), ["second"]);
    assert.equal(state.searched, "second");
});

test("Search Page cancels outstanding requests on unload and does not publish their response", async () => {
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
    resolveQuery({results: [{id: "documents", providerId: "test", label: "Documents", href: "/documents"}], errors: []});
    await pending;
    assert.deepEqual(state.results, []);
});

test("Search Page displays successful results together with sanitized partial failures", async () => {
    const search = {async query() { return {
        results: [{id: "good", providerId: "good", label: "Good", href: "/good", open: "dialog"}],
        errors: [{providerId: "failed", message: "Unable to search Failed."}]
    }; }};
    const {state, controller} = createController(search);
    const pending = controller.search("good");
    assert.equal(state.loading, true);
    await pending;
    assert.equal(state.loading, false);
    assert.deepEqual(state.results.map(item => item.id), ["good"]);
    assert.equal(state.errorMessage, "Unable to search Failed.");
    assert.equal(SearchPage.template.includes("x-notice"), true);
    assert.equal(SearchPage.template.includes("x-empty"), true);
});
