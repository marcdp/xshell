import assert from "node:assert/strict";
import test from "node:test";

import Search from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/search.js";
import SearchContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/search.json" with {type: "json"};
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with {type: "json"};
import ServiceSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/service.schema.json" with {type: "json"};
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";

function createSearch(providers, implementations, dependencies = {}) {
    const loads = [];
    const loader = {
        async load(resource) {
            loads.push(resource);
            const implementation = implementations[resource];
            if (implementation instanceof Error) throw implementation;
            if (typeof implementation === "function" && implementation.prototype === undefined) return implementation();
            return implementation;
        }
    };
    const services = {resolve(name) { return dependencies[name]; }};
    return {loads, search: new Search({loader, services}, {providers})};
}

const result = (id, label = id, extra = {}) => ({id, label, href: `/pages/${id}.js`, ...extra});

test("Search public contract validates with local named type references", () => {
    const validation = new JsonValidator().validate(SearchContract, ServiceSchema, {"./contract.schema.json": ContractSchema});
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
    assert.deepEqual(Object.keys(SearchContract.methods), ["listProviders", "query"]);
    for (const method of Object.values(SearchContract.methods)) {
        for (const descriptor of [...(method.parameters || []), method.returns].filter(Boolean)) {
            if (descriptor.ref) assert.equal(Object.hasOwn(SearchContract.types, descriptor.ref), true);
        }
    }
});

test("Search provider configuration schema validates declarative definitions", () => {
    const validator = new JsonValidator();
    const valid = validator.validate({providers: {
        local: {label: "Local", implementation: "/providers/search-local.js"},
        remote: {label: "Remote", implementation: "/providers/search-remote.js", mode: "explicit", options: {endpoint: "catalog"}}
    }}, Search.optionsSchema);
    assert.equal(valid.valid, true);

    for (const options of [
        {},
        {providers: {local: {implementation: "/providers/search-local.js"}}},
        {providers: {local: {label: "Local", implementation: "", mode: "sometimes"}}},
        {providers: {local: {label: "Local", implementation: "/providers/search-local.js", unknown: true}}}
    ]) assert.equal(validator.validate(options, Search.optionsSchema).valid, false);
});

test("listProviders returns defensive immutable metadata without loading implementations", () => {
    const {loads, search} = createSearch({
        local: {label: "Local", description: "Local data", icon: "local", implementation: "/providers/search-local.js", options: {secret: "private"}}
    }, {});

    const first = search.listProviders();
    const second = search.listProviders();
    assert.deepEqual(first, [{id: "local", label: "Local", description: "Local data", icon: "local", mode: "default"}]);
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first[0], second[0]);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first[0]), true);
    assert.deepEqual(loads, []);
    assert.equal("implementation" in first[0], false);
    assert.equal("options" in first[0], false);
});

test("query selects default and explicit providers lazily and skips loading for empty text", async () => {
    class DefaultProvider { async query() { return [result("default")]; } }
    class ExplicitProvider { async query() { return [result("explicit")]; } }
    const {loads, search} = createSearch({
        default: {label: "Default", implementation: "/providers/search-default.js"},
        explicit: {label: "Explicit", implementation: "/providers/search-explicit.js", mode: "explicit"}
    }, {"esm:/providers/search-default.js": DefaultProvider, "esm:/providers/search-explicit.js": ExplicitProvider});

    assert.deepEqual(await search.query("   "), {results: [], errors: []});
    assert.deepEqual(loads, []);
    assert.deepEqual((await search.query("item")).results.map(item => item.id), ["default"]);
    assert.deepEqual(loads, ["esm:/providers/search-default.js"]);
    assert.deepEqual((await search.query("item", {providers: ["explicit"]})).results.map(item => item.id), ["explicit"]);
    assert.deepEqual(loads, ["esm:/providers/search-default.js", "esm:/providers/search-explicit.js"]);
});

test("provider construction shares concurrent initialization and retries a failed attempt", async () => {
    let release;
    let attempts = 0;
    class Provider { async query(text) { return [result(text)]; } }
    const implementations = {
        "esm:/providers/search-shared.js": async () => {
            attempts++;
            if (attempts === 1) throw new Error("initialization failed");
            await new Promise(resolve => { release = resolve; });
            return Provider;
        }
    };
    const loads = [];
    const loader = {async load(resource) { loads.push(resource); return implementations[resource](); }};
    const services = {resolve() { return undefined; }};
    const search = new Search({loader, services}, {providers: {shared: {label: "Shared", implementation: "/providers/search-shared.js"}}});

    const failed = await search.query("first");
    assert.deepEqual(failed.results, []);
    assert.equal(failed.errors.length, 1);
    const left = search.query("left");
    const right = search.query("right");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(attempts, 2);
    release();
    assert.deepEqual((await left).results.map(item => item.id), ["left"]);
    assert.deepEqual((await right).results.map(item => item.id), ["right"]);
    assert.equal(loads.length, 2);
});

test("query validates options and rejects unknown providers before loading", async () => {
    const {loads, search} = createSearch({local: {label: "Local", implementation: "/providers/search-local.js"}}, {});
    for (const [options, expected] of [
        [null, /options must be an object/],
        [{limit: 0}, /limit/],
        [{limit: 201}, /limit/],
        [{providers: "local"}, /providers must be an array/],
        [{providers: ["local", "local"]}, /unique/],
        [{providers: ["missing"]}, /Unknown Search provider/],
        [{unknown: true}, /Unknown Search option/],
        [{signal: {}}, /AbortSignal/]
    ]) await assert.rejects(() => search.query("value", options), expected);
    await assert.rejects(() => search.query(null), /text must be a string/);
    assert.deepEqual(loads, []);
});

test("cancellation rejects before loading and during provider execution", async () => {
    class Provider {
        async query(text, {signal}) {
            await new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), {once: true}));
            return [];
        }
    }
    const {loads, search} = createSearch({local: {label: "Local", implementation: "/providers/search-local.js"}}, {"esm:/providers/search-local.js": Provider});
    const before = new AbortController();
    before.abort();
    await assert.rejects(() => search.query("value", {signal: before.signal}), error => error.name === "AbortError");
    assert.deepEqual(loads, []);

    const during = new AbortController();
    const pending = search.query("value", {signal: during.signal});
    await new Promise(resolve => setImmediate(resolve));
    during.abort();
    await assert.rejects(() => pending, error => error.name === "AbortError");
});

test("canceling one query does not invalidate provider initialization shared with another query", async () => {
    let release;
    let loads = 0;
    class Provider { async query(text) { return [result(text)]; } }
    const loader = {async load() {
        loads++;
        await new Promise(resolve => { release = resolve; });
        return Provider;
    }};
    const services = {resolve() { return undefined; }};
    const search = new Search({loader, services}, {providers: {local: {label: "Local", implementation: "/providers/search-local.js"}}});
    const controller = new AbortController();
    const canceled = search.query("canceled", {signal: controller.signal});
    const surviving = search.query("surviving");
    await new Promise(resolve => setImmediate(resolve));
    controller.abort();
    await assert.rejects(() => canceled, error => error.name === "AbortError");
    release();
    assert.equal((await surviving).results[0].id, "surviving");
    assert.equal(loads, 1);
});

test("independent concurrent queries publish their own provider results", async () => {
    const pending = new Map();
    class Provider {
        async query(text) { return await new Promise(resolve => pending.set(text, resolve)); }
    }
    const {search} = createSearch({local: {label: "Local", implementation: "/providers/search-local.js"}}, {"esm:/providers/search-local.js": Provider});
    const first = search.query("first");
    const second = search.query("second");
    await new Promise(resolve => setImmediate(resolve));
    pending.get("second")([result("second")]);
    pending.get("first")([result("first")]);
    assert.equal((await first).results[0].id, "first");
    assert.equal((await second).results[0].id, "second");
});

test("provider failures and invalid results are isolated while successful results survive", async () => {
    class Good { async query() { return [result("good")]; } }
    class Failed { async query() { throw new Error("credential=https://secret.example"); } }
    class Invalid { async query() { return [{id: "invalid", label: "Invalid", href: "/invalid", callback() {}}]; } }
    const {search} = createSearch({
        good: {label: "Good", implementation: "/providers/search-good.js"},
        failed: {label: "Failed", implementation: "/providers/search-failed.js"},
        invalid: {label: "Invalid", implementation: "/providers/search-invalid.js"}
    }, {"esm:/providers/search-good.js": Good, "esm:/providers/search-failed.js": Failed, "esm:/providers/search-invalid.js": Invalid});

    const response = await search.query("anything");
    assert.deepEqual(response.results.map(item => item.id), ["good"]);
    assert.deepEqual(response.errors, [
        {providerId: "failed", message: "Unable to search Failed."},
        {providerId: "invalid", message: "Unable to search Invalid."}
    ]);
    assert.equal(JSON.stringify(response).includes("secret.example"), false);
});

test("Search assigns provider IDs, ranks deterministically, deduplicates, and applies the aggregate limit", async () => {
    class First {
        async query() {
            return [
                result("description", "Unrelated", {description: "find needle here"}),
                result("substring", "A needle inside"),
                result("prefix", "Needle case"),
                result("needle", "Different"),
                result("duplicate", "Needle duplicate"),
                result("duplicate", "Needle duplicate later")
            ];
        }
    }
    class Second { async query() { return [result("second", "Needle second", {open: "dock", tags: ["needle"]})]; } }
    const {search} = createSearch({
        first: {label: "First", implementation: "/providers/search-first.js"},
        second: {label: "Second", implementation: "/providers/search-second.js"}
    }, {"esm:/providers/search-first.js": First, "esm:/providers/search-second.js": Second});

    const response = await search.query("needle", {limit: 6});
    assert.deepEqual(response.results.map(item => [item.providerId, item.id]), [
        ["first", "needle"], ["first", "prefix"], ["first", "duplicate"], ["second", "second"], ["first", "substring"], ["first", "description"]
    ]);
    assert.equal(response.results.find(item => item.id === "second").open, "dock");
    assert.equal(response.results.filter(item => item.id === "duplicate").length, 1);
});

test("Search ranks and deduplicates all provider candidates before enforcing the aggregate limit", async () => {
    class Provider {
        async query() {
            return [
                result("duplicate", "Export customer documents"),
                result("duplicate", "Export customer documents later"),
                result("import", "Import documents"),
                result("documents", "Documents")
            ];
        }
    }
    const {search} = createSearch({local: {label: "Local", implementation: "/providers/search-local.js"}}, {
        "esm:/providers/search-local.js": Provider
    });

    const response = await search.query("documents", {limit: 2});
    assert.deepEqual(response.results.map(item => item.id), ["documents", "duplicate"]);
    assert.equal(response.results.length, 2);
});

test("a provider-supplied providerId is rejected instead of trusted", async () => {
    class Provider { async query() { return [{...result("item"), providerId: "spoofed"}]; } }
    const {search} = createSearch({real: {label: "Real", implementation: "/providers/search-real.js"}}, {"esm:/providers/search-real.js": Provider});
    const response = await search.query("item");
    assert.deepEqual(response.results, []);
    assert.deepEqual(response.errors, [{providerId: "real", message: "Unable to search Real."}]);
});
