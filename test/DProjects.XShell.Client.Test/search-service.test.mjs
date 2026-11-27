import assert from "node:assert/strict";
import test from "node:test";

import Logger from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/logger.js";
import Search from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/search.js";
import SearchContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/search.json" with {type: "json"};
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with {type: "json"};
import ServiceSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/service.schema.json" with {type: "json"};
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import {createThrowingLogger} from "./fixtures/throwing-logger.mjs";

function createSearch(providers, implementations, dependencies = {}, logger = new Logger({})) {
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
    return {loads, search: new Search({logger, loader, services}, {providers})};
}

const result = (id, label = id, extra = {}) => ({id, type: "page", label, href: `/pages/${id}.js`, ...extra});

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
        remote: {label: "Remote", implementation: "/providers/search-remote.js", mode: "explicit", prefixes: ["remote:", ">"], options: {endpoint: "catalog"}}
    }}, Search.optionsSchema);
    assert.equal(valid.valid, true);

    for (const options of [
        {},
        {providers: {local: {implementation: "/providers/search-local.js"}}},
        {providers: {local: {label: "Local", implementation: "", mode: "sometimes"}}},
        {providers: {local: {label: "Local", implementation: "/providers/search-local.js", unknown: true}}}
    ]) assert.equal(validator.validate(options, Search.optionsSchema).valid, false);
});

test("Search rejects malformed prefixes and case-insensitive duplicates at construction", () => {
    const validator = new JsonValidator();
    const definition = {label: "Local", implementation: "/providers/search-local.js"};
    for (const prefixes of [null, "local:", [12], [""], ["two words"], ["local:\n"], ["local:", "local:"]]) {
        const providers = {local: {...definition, prefixes}};
        assert.equal(validator.validate({providers}, Search.optionsSchema).valid, false, JSON.stringify(prefixes));
        assert.throws(() => createSearch(providers, {}), /Search provider 'local'.*prefix/);
    }
    assert.throws(() => createSearch({local: {...definition, prefixes: ["local:", "LOCAL:"]}}, {}), /local.*duplicate prefix 'LOCAL:'/);
    assert.throws(() => createSearch({local: {...definition, prefixes: ["Σ:", "ς:"]}}, {}), /duplicate prefix/);
});

test("listProviders returns defensive immutable metadata without loading implementations", () => {
    const prefixes = ["Local:", ">"];
    const {loads, search} = createSearch({
        local: {label: "Local", description: "Local data", icon: "local", implementation: "/providers/search-local.js", prefixes, options: {secret: "private"}},
        fallback: {label: "Fallback", implementation: "/providers/search-fallback.js"}
    }, {});

    prefixes.splice(0, 2, "changed:");
    const first = search.listProviders();
    const second = search.listProviders();
    assert.deepEqual(first, [
        {id: "local", label: "Local", description: "Local data", icon: "local", mode: "default", prefixes: ["Local:", ">"]},
        {id: "fallback", label: "Fallback", mode: "default", prefixes: []}
    ]);
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first[0], second[0]);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first[0]), true);
    assert.equal(Object.isFrozen(first[1].prefixes), true);
    assert.throws(() => first[0].prefixes.push("changed:"), TypeError);
    assert.deepEqual(loads, []);
    assert.equal("implementation" in first[0], false);
    assert.equal("options" in first[0], false);
});

test("expressions select the longest leading prefix, support aliases, and preserve the remaining text", async () => {
    class Echo { async query(text) { return [result("echo", text)]; } }
    const {loads, search} = createSearch({
        short: {label: "Short", implementation: "/short.js", prefixes: ["c"]},
        commands: {label: "Commands", implementation: "/commands.js", mode: "explicit", prefixes: ["command:", ">", "+", "Σ:"]},
        shared: {label: "Shared", implementation: "/shared.js", prefixes: ["COMMAND:"]},
        plain: {label: "Plain", implementation: "/plain.js"}
    }, {"esm:/short.js": Echo, "esm:/commands.js": Echo, "esm:/shared.js": Echo, "esm:/plain.js": Echo});

    for (const input of ["", "   "]) {
        assert.deepEqual(await search.query(input), {results: [], errors: []});
    }
    assert.deepEqual(await search.query("command: Needle", {providers: ["short", "plain"]}), {results: [], errors: []});
    assert.deepEqual(await search.query(">Needle", {providers: []}), {results: [], errors: []});
    await assert.rejects(search.query("command: Needle", {providers: ["missing"]}), /Unknown Search provider 'missing'/);
    assert.deepEqual(loads, []);

    for (const [input, providers, text, options] of [
        ["> Needle", ["commands"], "Needle"],
        [">Needle", ["commands"], "Needle"],
        ["+Needle", ["commands"], "Needle"],
        ["ς:Needle", ["commands"], "Needle"],
        ["  COMMAND:\tNeedle  Details ", ["commands", "shared"], "Needle  Details", {providers: ["shared", "commands"]}],
        ["command:https://Example.com", ["commands", "shared"], "https://Example.com"],
        ["command: > Needle", ["commands", "shared"], "> Needle"],
        ["command: Needle", ["shared"], "Needle", {providers: ["plain", "shared"]}]
    ]) {
        const response = await search.query(input, options);
        assert.deepEqual(response.results.map(item => [item.providerId, item.label]), providers.map(id => [id, text]));
        assert.deepEqual(response.errors, []);
    }
    assert.deepEqual(loads, ["esm:/commands.js", "esm:/shared.js"]);

    for (const input of ["unknown:", "unknown: Needle", "Needle command: details", "https://Example.com"]) {
        const {results} = await search.query(input);
        assert.deepEqual(results.map(item => [item.providerId, item.label]), ["short", "shared", "plain"].map(id => [id, input]));
    }
    const {results} = await search.query("Needle", {providers: ["plain", "commands"]});
    assert.deepEqual(results.map(item => item.providerId), ["plain", "commands"]);
});

test("standalone prefixes discover results in provider order within the aggregate limit", async t => {
    // Return deliberately nonalphabetical results, including duplicates within and across providers.
    const first = t.mock.fn(async () => [result("z"), result("z", "duplicate"), result("b")]);
    const second = t.mock.fn(async () => [result("z"), result("a")]);
    class First { query(...args) { return first(...args); } }
    class Second { query(...args) { return second(...args); } }
    const {loads, search} = createSearch({
        shorter: {label: "Shorter", implementation: "/short.js", prefixes: ["list"]},
        first: {label: "First", implementation: "/first.js", prefixes: ["list:", ">"], mode: "explicit"},
        second: {label: "Second", implementation: "/second.js", prefixes: ["LIST:"]}
    }, {"esm:/first.js": First, "esm:/second.js": Second});
    const {signal} = new AbortController();

    assert.deepEqual(await search.query("list:", {providers: ["shorter"]}), {results: [], errors: []});
    assert.deepEqual(loads, []);
    const {results, errors} = await search.query("  LiSt:\t ", {providers: ["second", "first"], limit: 3, signal});
    assert.deepEqual(errors, []);
    assert.deepEqual(results.map(({providerId, label}) => [providerId, label]), [
        ["first", "z"], ["first", "b"], ["second", "z"]
    ]);
    assert.deepEqual(first.mock.calls[0].arguments, ["", {signal, limit: 3}]);
    assert.deepEqual(second.mock.calls[0].arguments, ["", {signal, limit: 3}]);
    assert.deepEqual(loads, ["esm:/first.js", "esm:/second.js"]);
    assert.deepEqual((await search.query(" > ")).results.map(item => item.id), ["z", "b"]);
    assert.equal(first.mock.calls[1].arguments[0], "");
    assert.equal(second.mock.callCount(), 1);
});

test("query selects default and explicit providers lazily and skips loading for empty text", async () => {
    class DefaultProvider { async query() { return [result("default")]; } }
    class ExplicitProvider { async query() { return [result("explicit")]; } }
    const {loads, search} = createSearch({
        default: {label: "Default", implementation: "/providers/search-default.js"},
        explicit: {label: "Explicit", implementation: "/providers/search-explicit.js", mode: "explicit"}
    }, {"esm:/providers/search-default.js": DefaultProvider, "esm:/providers/search-explicit.js": ExplicitProvider});

    assert.deepEqual(await search.query("   "), {results: [], errors: []});
    assert.deepEqual(await search.query("", {providers: ["explicit"]}), {results: [], errors: []});
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
    const search = new Search({logger: new Logger({}), loader, services}, {providers: {shared: {label: "Shared", implementation: "/providers/search-shared.js"}}});

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
    const {loads, search} = createSearch({
        local: {label: "Local", implementation: "/providers/search-local.js", mode: "explicit", prefixes: ["local:"]}
    }, {"esm:/providers/search-local.js": Provider});
    const before = new AbortController();
    before.abort();
    await assert.rejects(() => search.query("local: value", {signal: before.signal}), error => error.name === "AbortError");
    assert.deepEqual(loads, []);

    const during = new AbortController();
    const pending = search.query("local:", {signal: during.signal});
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
    const search = new Search({logger: new Logger({}), loader, services}, {providers: {local: {label: "Local", implementation: "/providers/search-local.js"}}});
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

test("Search preserves custom and heterogeneous result types without changing identity", async () => {
    class First {
        async query() {
            return [
                result("shared", "Shared", {type: " catalog-entry "}),
                result("shared", "Duplicate of shared", {type: "command"}),
                result("other", "Other", {type: "command"})
            ];
        }
    }
    class Second { async query() { return [result("shared", "Shared", {type: "catalog-entry"})]; } }
    const {search} = createSearch({
        first: {label: "First", implementation: "/first.js", prefixes: ["catalog:"]},
        second: {label: "Second", implementation: "/second.js", prefixes: ["catalog:"]}
    }, {"esm:/first.js": First, "esm:/second.js": Second});

    const {results, errors} = await search.query("catalog:");
    assert.deepEqual(errors, []);
    assert.deepEqual(results.map(({providerId, id, type}) => [providerId, id, type]), [
        ["first", "shared", "catalog-entry"], ["first", "other", "command"], ["second", "shared", "catalog-entry"]
    ]);
    const validator = new JsonValidator();
    for (const item of results) assert.equal(validator.validate(item, SearchContract.types.searchResult.schema).valid, true);
});

test("Search rejects missing, blank, and non-string resource types and isolates the provider failure", async () => {
    let invalid;
    class Good { async query() { return [result("good")]; } }
    class Invalid { async query() { return [result("discarded"), invalid]; } }
    const {search} = createSearch({
        good: {label: "Good", implementation: "/good.js"},
        invalid: {label: "Invalid", implementation: "/invalid.js"}
    }, {"esm:/good.js": Good, "esm:/invalid.js": Invalid});
    const validator = new JsonValidator();

    for (const fields of [{}, {type: ""}, {type: " \t\n "}, {type: 4}, {type: null}, {type: ["page"]}]) {
        invalid = {id: "bad", label: "Bad", category: "Documents", href: "page:x:/pages/search.js", ...fields};
        assert.equal(validator.validate({...invalid, providerId: "invalid"}, SearchContract.types.searchResult.schema).valid, false);
        const {results, errors} = await search.query("documents");
        assert.deepEqual(results.map(({type, providerId}) => [type, providerId]), [["page", "good"]]);
        assert.deepEqual(errors, [{providerId: "invalid", message: "Unable to search Invalid."}]);
    }
});

test("provider failures are logged safely while successful results survive a throwing logger", async t => {
    class Good { async query() { return [result("good")]; } }
    class Failed { async query() { throw new Error("credential=https://secret.example"); } }
    class Invalid { async query() { return [{...result("invalid"), callback() {}}]; } }
    const {logger, calls: {warn: warning, debug}} = await createThrowingLogger(t);
    const {search} = createSearch({
        good: {label: "Good", implementation: "/providers/search-good.js", prefixes: ["shared:"]},
        failed: {label: "Failed", implementation: "/providers/search-failed.js", prefixes: ["shared:"]},
        invalid: {label: "Invalid", implementation: "/providers/search-invalid.js", prefixes: ["shared:"]}
    }, {"esm:/providers/search-good.js": Good, "esm:/providers/search-failed.js": Failed, "esm:/providers/search-invalid.js": Invalid}, {}, logger);

    for (const expression of ["shared: private query", "shared:"]) {
        const response = await search.query(expression);
        assert.deepEqual(response.results.map(item => item.id), ["good"]);
        assert.deepEqual(response.errors, [
            {providerId: "failed", message: "Unable to search Failed."},
            {providerId: "invalid", message: "Unable to search Invalid."}
        ]);
        assert.equal(JSON.stringify(response).includes("secret.example"), false);
    }
    assert.deepEqual(warning.mock.calls.map(call => call.arguments.slice(1).map(value => value.providerId)), [["failed"], ["invalid"], ["failed"], ["invalid"]]);
    const complete = debug.mock.calls.filter(call => call.arguments[0] === "Search: completed");
    assert.equal(complete.length, 2);
    assert.ok(complete.every(call => call.arguments[1].count === 1 && call.arguments[1].failureCount === 2));
    assert.doesNotMatch(JSON.stringify([...warning.mock.calls, ...debug.mock.calls].map(call => call.arguments)), /private query|secret\.example/);
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
    const {search} = createSearch({local: {label: "Local", implementation: "/providers/search-local.js", prefixes: ["local:"]}}, {
        "esm:/providers/search-local.js": Provider
    });

    const response = await search.query("local: documents", {limit: 2});
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
