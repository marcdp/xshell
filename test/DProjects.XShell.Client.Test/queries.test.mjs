import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";

import Contracts from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/contracts.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Loader from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/loader.js";
import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/resolver.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import InvokePage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/invoke.js";
import queriesPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/pages/90-advanced/10-queries.js";
import DiagnosticsQueries from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/queries.js";

const resources = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);
const bootstrap = readFileSync(new URL("bootstrap/index.js", resources), "utf8");
const fillResolverRules = vm.runInNewContext("(" + bootstrap.slice(
    bootstrap.indexOf("function fillXShellResolverRules(config)"),
    bootstrap.indexOf("config = fillXShell(config);")
).trim() + ")");

const queryFile = (owner, id, resource) => ({path: `/${owner}/queries/${id}.js`, size: 120, resource});
const deferred = () => Promise.withResolvers();
const sourceUrl = source => `data:text/javascript,${encodeURIComponent(source)}`;

function createConfig() {
    // Set up framework, module and service inventories as consumed by the active bootstrap.
    const manifest = readFileSync(new URL("xshell/manifest.jsonc", resources), "utf8");
    const registration = JSON.parse(manifest.match(/"queries":\s*({[^}]+})/)[1]);
    assert.deepEqual(registration, {contract: "queries", implementation: "/services/queries.js", lifetime: "singleton"});
    return {
        app: {baseUrl: resources.href},
        xshell: {
            assets: {path: "/xshell"},
            resolver: {},
            services: {queries: {...registration, implementation: "/xshell" + registration.implementation}},
            files: [
                {path: "/xshell/contracts/queries.json"},
                ...["query", "service", "contract"].map(id => ({path: `/xshell/schemas/${id}.schema.json`})),
                queryFile("xshell", "runtime.version"),
                {path: "/xshell/commands/runtime.version.js"}
            ]
        },
        modules: {
            "x-demo": {
                assets: {path: "/x-demo"},
                files: [
                    queryFile("x-demo", "demo.inventory.list"),
                    queryFile("x-demo", "demo.inventory.detail"),
                    queryFile("x-demo", "demo.inventory.count", {
                        type: "query", label: "Count products", description: "Count stocked products.", tags: ["demo", "inventory"], icon: "x-search"
                    }),
                    {path: "/x-demo/queries/readme.txt"}
                ]
            },
            catalog: {
                assets: {path: "/catalog"},
                files: [queryFile("catalog", "nested/products.lookup")]
            }
        }
    };
}

async function createRuntime(t, {definitions = {}, register} = {}) {
    // Assemble the same Services, Resolver, Loader and schema loader used by the runtime.
    const config = createConfig();
    fillResolverRules(config);
    for (const [id, source] of Object.entries(definitions)) {
        config.xshell.resolver.query[id] = {src: sourceUrl(source), loader: "query-js", cache: true, moduleId: "catalog"};
    }
    const resolver = new Resolver({config});
    const services = {config};
    const bus = {emit() {}};
    const loader = new Loader({bus, resolver, services}, {appBasePath: resources.href.slice(0, -1), xshellAssetsPath: "/xshell"});
    const module = {id: "catalog"};
    Object.assign(services, {loader, modules: {getModuleById: id => id === "catalog" ? module : undefined}});

    Object.defineProperty(globalThis, "document", {configurable: true, value: {baseURI: resources.href}});
    t.after(() => { delete globalThis.document; });
    const fetched = [];
    t.mock.method(globalThis, "fetch", async url => {
        fetched.push(url);
        const json = JSON.parse(readFileSync(new URL(url), "utf8"));
        return {ok: true, async json() { return json; }};
    });
    const contracts = new Contracts({config, loader}, {xshellAssetsPath: "/xshell", xshellFiles: config.xshell.files});
    await contracts.init();
    const root = new Services({config, resolver, loader, contracts, bus});
    services.services = root;
    root.register("config", config);
    root.register("loader", loader);
    root.register("jsonValidator", new JsonValidator());
    register?.(root);
    await root.init();
    t.after(() => root.dispose());
    return {queries: root.resolve("queries"), config, resolver, loader, root, module, fetched};
}

function definition(method, controller, types = {}) {
    // Keep fixtures on the dynamic module import path.
    return `export default {contract: {query: ${JSON.stringify(method)}, types: ${JSON.stringify(types)}}, controller: ${controller}};`;
}

test("Queries discover immutable descriptors across effective inventories without imports or requests", async t => {
    const {queries, root, loader, resolver, config, fetched} = await createRuntime(t);
    const initialLoads = loader.registry.length;
    const initialRequests = fetched.length;
    assert.strictEqual(root.resolve("queries"), queries);
    const entries = queries.list();
    assert.deepEqual(entries.map(item => item.id), [
        "demo.inventory.count", "demo.inventory.detail", "demo.inventory.list", "nested/products.lookup", "runtime.version"
    ]);
    const count = queries.getInfo("demo.inventory.count");
    assert.deepEqual(count, {
        id: "demo.inventory.count", moduleId: "x-demo", label: "Count products", description: "Count stocked products.",
        tags: ["demo", "inventory"], category: "x-demo", icon: "x-search", path: "/x-demo/queries/demo.inventory.count.js", size: 120
    });
    assert.ok(Object.isFrozen(entries) && Object.isFrozen(count) && Object.isFrozen(count.tags));
    assert.notStrictEqual(count.tags, config.modules["x-demo"].files[2].resource.tags);
    assert.deepEqual(queries.list({query: "STOCKED", moduleId: "x-demo", category: "x-demo"}), [count]);
    assert.deepEqual(queries.list({query: "INVENTORY", category: "catalog"}), []);
    assert.deepEqual(queries.list({moduleId: "xshell"})[0].tags, []);
    assert.equal(queries.getInfo("unknown"), null);
    assert.throws(() => queries.list({category: 1}), /must be a string/);
    assert.throws(() => queries.list({unsupported: true}), /Unknown Query list option/);
    assert.equal(loader.registry.length, initialLoads);
    assert.equal(fetched.length, initialRequests);
    assert.equal(resolver.resolve("query:nested/products.lookup").definition.moduleId, "catalog");
    assert.equal(resolver.resolve("query:x-demo:demo.inventory.count").path, count.path);
    assert.equal(resolver.resolve("command:runtime.version").definition.loader, "command-js");
    assert.equal(resolver.resolve("query:runtime.version").definition.loader, "query-js");
});

test("bootstrap rejects duplicate Query IDs and conflicts with exact configured rules", () => {
    // Use both framework and module ownership in the same duplicate declaration.
    const duplicate = createConfig();
    duplicate.modules.catalog.files.push(queryFile("catalog", "runtime.version"));
    assert.throws(() => fillResolverRules(duplicate), /Duplicate query 'runtime.version'.*XShell 'xshell'.*module 'catalog'/);
    const configured = createConfig();
    configured.xshell.resolver.query = {"nested/products.lookup": {src: "/other.js", loader: "query-js"}};
    assert.throws(() => fillResolverRules(configured), /Duplicate query 'nested\/products.lookup' conflicts with an existing resolver entry/);
});

test("Resolver and Loader cache the Query class while the cookbook Page receives direct results", async t => {
    const {queries, loader} = await createRuntime(t);
    const Query = await loader.load("query:demo.inventory.detail");
    assert.strictEqual(await loader.load("query:demo.inventory.detail"), Query);
    assert.ok(Object.isFrozen(Query.contract));
    assert.ok(Object.isFrozen(Query.contract.types.productLookup.schema.anyOf));
    const state = structuredClone(queriesPage.state);
    const page = queriesPage.controller({queries, state});
    page.load();
    assert.equal(state.items.length, 3);
    await page.count();
    assert.equal(state.result, "2");
    await page.list();
    assert.deepEqual(JSON.parse(state.result), ["Notebook", "Pen"]);
    await page.find();
    assert.equal(JSON.parse(state.result).sku, "NOTE-01");
    await page.findMissing();
    assert.equal(state.result, "null");
    await assert.rejects(queries.run({id: "demo.inventory.detail"}), /Missing required argument 'sku'/);
    await assert.rejects(queries.run({id: "demo.inventory.list", args: {category: "invalid"}}), /Invalid argument 'category'/);
    await assert.rejects(queries.run({id: "missing"}), {code: "RESOURCE_NOT_FOUND"});
});

test("Query loading validates definitions and checks controller shape inside each invocation", async t => {
    const valid = {returns: {type: "integer"}};
    const definitions = {
        invalidDefault: "export default class Example {};",
        noContract: "export default {controller() {}};",
        noOperation: "export default {contract: {}, controller() {}};",
        noReturn: definition({}, "() => ({query() {}})"),
        badReturn: definition({returns: {type: "unknown"}}, "() => ({query() {}})"),
        badParameter: definition({...valid, parameters: [{name: "x"}]}, "() => ({query() {}})"),
        badFactory: definition(valid, "{}"),
        noMethod: definition(valid, "() => ({})"),
        badMethod: definition(valid, "() => ({query: 1})")
    };
    const {queries, loader} = await createRuntime(t, {definitions});
    for (const id of ["invalidDefault", "noContract", "noOperation", "noReturn", "badReturn", "badParameter", "badFactory"]) {
        await assert.rejects(loader.load(`query:${id}`), /Invalid query/);
    }
    for (const id of ["noMethod", "badMethod"]) {
        assert.equal(typeof await loader.load(`query:${id}`), "function");
        await assert.rejects(queries.run({id}), /controller must return an object implementing query\(\)/);
    }
});

test("Diagnostics filters Query metadata and activating a row opens invoke.js in the stack", async t => {
    const {queries, loader, root} = await createRuntime(t);
    const state = {...structuredClone(DiagnosticsQueries.state), id: "COUNT", tags: "INVENTORY"};
    const events = {on: t.mock.fn()};
    const navigate = t.mock.fn();
    const diagnosticsPage = {src: "/xshell-diagnostics/pages/queries.js"};
    const diagnostics = DiagnosticsQueries.controller({state, queries, events, page: diagnosticsPage, navigation: {navigate}});
    const loads = loader.registry.length;
    diagnostics.load();
    assert.equal(loader.registry.length, loads);
    assert.deepEqual(state.items.map(item => item.id), ["demo.inventory.count"]);
    assert.equal(events.on.mock.calls.length, 6);
    assert.match(DiagnosticsQueries.template, /x-on:activate="invokeQuery"/);
    assert.match(DiagnosticsQueries.template, /x-prop:value="item\.id"/);
    assert.match(DiagnosticsQueries.template, /x-attr:href="item\.path" target="_blank"/);

    // Follow the list's activation event into the invocation Page.
    await diagnostics.invokeQuery({event: {detail: {value: state.items[0].id}}});
    const [navigation] = navigate.mock.calls[0].arguments;
    assert.equal(navigation.open, "stack");
    assert.strictEqual(navigation.page, diagnosticsPage);
    assert.equal(navigation.href, "page:x:/pages/invoke.js");
    const {params} = navigation;
    assert.deepEqual(params, {type: "query", id: "demo.inventory.count", method: "query"});

    // Load the real Query contract and use its prefilled default through the invocation form.
    const invocationState = {...structuredClone(InvokePage.state), ...params, args: {}};
    const page = {};
    const invocation = InvokePage.controller({state: invocationState, loader, services: root, page});
    await invocation.load();
    assert.equal(page.label, "Count products");
    assert.deepEqual(invocationState.args, {minimumStock: 1});
    await invocation.submit();
    assert.equal(invocationState.result, 2);
    assert.equal(invocationState.completed, true);
    assert.equal(invocationState.running, false);
});

test("Query invocation handles optional arguments, null results and retries after validation errors", async t => {
    const {loader, root} = await createRuntime(t);
    const state = {...structuredClone(InvokePage.state), type: "query", id: "demo.inventory.detail", method: "query", args: {}};
    const invocation = InvokePage.controller({state, loader, services: root, page: {}});
    await invocation.load();
    await invocation.submit();
    assert.match(state.errors[0].message, /Missing required argument 'sku'/);
    assert.equal(state.phase, "arguments");
    state.args.sku = "UNKNOWN";
    await invocation.submit();
    assert.deepEqual(state.errors, []);
    assert.equal(state.result, null);
    assert.equal(state.hasResult, true);
    invocation.editArguments();
    assert.equal(state.phase, "arguments");

    const listState = {...structuredClone(InvokePage.state), type: "query", id: "demo.inventory.list", method: "query", args: {}};
    const list = InvokePage.controller({state: listState, loader, services: root, page: {}});
    await list.load();
    listState.args.category = undefined;
    await list.submit();
    assert.deepEqual(listState.result, ["Notebook", "Pen", "Canvas bag"]);
});

test("Query invocation falls back to JSON for complex parameters and validates through Queries", async t => {
    const {loader, root} = await createRuntime(t, {definitions: {
        "nested/example.list": definition({
            parameters: [{name: "ids", type: "array", schema: {items: {type: "integer"}}, default: [1]}],
            returns: {type: "array"}
        }, "() => ({query(ids) {return ids;}})")
    }});
    const state = {
        ...structuredClone(InvokePage.state), type: "query", id: "nested/example.list", method: "query", args: {}
    };
    const invocation = InvokePage.controller({state, loader, services: root, page: {}});
    await invocation.load();
    assert.equal(state.schema, null);
    assert.deepEqual(JSON.parse(state.jsonArgs), {ids: [1]});
    state.jsonArgs = "{";
    await invocation.submit();
    assert.equal(state.errors.length, 1);
    state.jsonArgs = '{"ids":["invalid"]}';
    await invocation.submit();
    assert.match(state.errors[0].message, /Invalid argument 'ids'/);
    state.jsonArgs = '{"ids":[2,3]}';
    await invocation.submit();
    assert.deepEqual(state.result, [2, 3]);
});

test("Queries bind named arguments in declaration order and validate named types, defaults and returns", async t => {
    const prefix = {name: "prefix", type: "string"};
    const count = {name: "count", ref: "positive", required: true};
    const settings = {name: "settings", type: "object", default: {offset: 0}};
    const returns = {ref: "result"};
    const types = {
        positive: {type: "integer", schema: {$defs: {positive: {minimum: 1}}, $ref: "#/$defs/positive"}},
        result: {type: "array", schema: {minItems: 2, items: {type: "string"}}}
    };
    const map = `() => ({async query(prefix, count, settings) {
        return [prefix ?? "omitted", String(count + ++settings.offset)];
    }})`;
    const definitions = {
        bind: definition({parameters: [prefix, count, settings], returns}, map, types),
        duplicate: definition({parameters: [prefix, prefix], returns}, map, types),
        unknownType: definition({parameters: [{name: "optional", ref: "constructor"}], returns}, map, types),
        unknownReturn: definition({returns: {ref: "constructor"}}, map, types),
        invalidDefault: definition({parameters: [{...count, default: 0}], returns}, map, types),
        invalidReturn: definition({returns}, "() => ({async query() {return [1];}})", types),
        invalidBase: definition({returns: {type: "integer", schema: true}}, "() => ({query() {return null;}})"),
        forbidden: definition({returns: {type: "any", schema: false}}, "() => ({query() {return true;}})"),
        special: definition({
            parameters: [{name: "date", type: "date", required: true}, {name: "callback", type: "function", required: true}],
            returns: {type: "function"}
        }, "() => ({query(date, callback) {return callback;}})")
    };
    const {queries} = await createRuntime(t, {definitions});
    assert.deepEqual(await queries.run({id: "bind", args: {count: 2, prefix: "given"}}), ["given", "3"]);
    for (let i = 0; i < 2; i++) assert.deepEqual(await queries.run({id: "bind", args: {count: 2}}), ["omitted", "3"]);
    await assert.rejects(queries.run({id: "bind", args: {count: 0}}), /Invalid argument 'count'/);
    await assert.rejects(queries.run({id: "bind", args: {count: "2"}}), /Invalid argument 'count'/);
    await assert.rejects(queries.run({id: "bind", args: {count: 2, other: 1}}), /Unknown argument 'other'/);
    await assert.rejects(queries.run({id: "duplicate"}), /Duplicate argument 'prefix'/);
    await assert.rejects(queries.run({id: "unknownType"}), /Unknown type 'constructor' for argument/);
    await assert.rejects(queries.run({id: "unknownReturn"}), /Unknown type 'constructor' for return value/);
    await assert.rejects(queries.run({id: "invalidDefault"}), /Invalid argument 'count'/);
    for (const id of ["invalidReturn", "invalidBase", "forbidden"]) {
        await assert.rejects(queries.run({id}), /Invalid return value/);
    }
    const callback = () => "value";
    assert.strictEqual(await queries.run({id: "special", args: {date: "2026-11-26", callback}}), callback);
    await assert.rejects(queries.run({id: "special", args: {date: "2026-02-30", callback}}), /Invalid argument 'date'/);
});

test("Concurrent Queries isolate scoped and transient dependencies and await asynchronous disposal", async t => {
    const executing = deferred();
    const release = deferred();
    const cleanupStarted = deferred();
    const finishCleanup = deferred();
    const records = [];
    const disposed = [];
    const run = definition({
        parameters: [{name: "value", type: "object", required: true}], returns: {type: "object"}
    }, `({hooks, singleton, session, services, definition, context, module, moduleConfig}) => {
        hooks.records.push({singleton, session, services, definition, context, module, moduleConfig,
            sameSession: services.resolve("session"), transients: [services.resolve("formatter"), services.resolve("formatter")]});
        return {async query(value) {
            if (hooks.records.length === 2) hooks.executing.resolve();
            await hooks.release.promise;
            return value;
        }};
    }`);
    const {queries, root, module, config} = await createRuntime(t, {
        definitions: {run},
        register(root) {
            root.register("hooks", {records, executing, release});
            class Singleton {
                static optionsSchema = {type: "object", additionalProperties: false};
                dispose() { assert.fail("Invocation disposed an application singleton."); }
            }
            class Session {
                static optionsSchema = {type: "object", additionalProperties: false};
                async dispose() {
                    disposed.push(this);
                    cleanupStarted.resolve();
                    await finishCleanup.promise;
                }
            }
            class Formatter {
                static optionsSchema = {type: "object", additionalProperties: false};
                dispose() { disposed.push(this); }
            }
            root.register("singleton", null, {implementationItem: {class: Singleton}});
            root.register("session", null, {lifetime: "scoped", implementationItem: {class: Session}});
            root.register("formatter", null, {lifetime: "transient", implementationItem: {class: Formatter}});
        }
    });
    const firstValue = {value: 1};
    const secondValue = {value: 2};
    const first = queries.run({id: "run", args: {value: firstValue}});
    const second = queries.run({id: "run", args: {value: secondValue}});
    let settled = false;
    const results = Promise.all([first, second]).then(values => { settled = true; return values; });
    try {
        await executing.promise;
        const [a, b] = records;
        assert.notStrictEqual(a.services, b.services);
        assert.strictEqual(a.singleton, b.singleton);
        assert.notStrictEqual(a.session, b.session);
        assert.equal(new Set(records.flatMap(record => record.transients)).size, 4);
        for (const record of records) {
            assert.notStrictEqual(record.services, root);
            assert.strictEqual(record.sameSession, record.session);
            assert.strictEqual(record.module, module);
            assert.strictEqual(record.moduleConfig, config.modules.catalog);
            assert.deepEqual(record.context, {id: "run"});
            assert.ok(Object.isFrozen(record.definition));
        }
        release.resolve();
        await cleanupStarted.promise;
        assert.equal(settled, false);
    } finally {
        release.resolve();
        finishCleanup.resolve();
    }
    const [a, b] = await results;
    assert.strictEqual(a, firstValue);
    assert.strictEqual(b, secondValue);
    assert.equal(disposed.length, 6);
    for (const {services} of records) assert.throws(() => services.has("session"), /Services scope is disposed/);
    assert.ok(root.has("session"));
});

test("Query scope cleanup covers controller, execution and return errors and preserves disposal errors", async t => {
    const executionError = new Error("execution failed");
    const cleanupError = new Error("cleanup failed");
    const scopes = [];
    const cleaned = [];
    const returns = {returns: {type: "integer"}};
    const fixture = body => definition(returns, `${body.async ? "async " : ""}({hooks, services}) => {
        hooks.scopes.push(services);
        services.addDisposable({async dispose() { hooks.cleaned.push(services); ${body.cleanup ?? ""} }});
        ${body.factory ?? ""}
        return {async query() { ${body.query ?? "return 1;"} }};
    }`);
    const {queries} = await createRuntime(t, {
        definitions: {
            factory: fixture({factory: "throw hooks.executionError;"}),
            asyncFactory: fixture({async: true, factory: "await Promise.resolve(); throw hooks.executionError;"}),
            execution: fixture({query: "throw hooks.executionError;"}),
            invalidResult: fixture({query: "return {};"}),
            cleanup: fixture({cleanup: "throw hooks.cleanupError;"}),
            combined: fixture({query: "throw hooks.executionError;", cleanup: "throw hooks.cleanupError;"}),
            falsy: fixture({query: "throw undefined;", cleanup: "throw hooks.cleanupError;"})
        },
        register: root => root.register("hooks", {executionError, cleanupError, scopes, cleaned})
    });
    for (const id of ["factory", "asyncFactory", "execution"]) await assert.rejects(queries.run({id}), error => error === executionError);
    await assert.rejects(queries.run({id: "invalidResult"}), /Invalid return value/);
    await assert.rejects(queries.run({id: "cleanup"}), error => error === cleanupError);
    for (const [id, failure] of [["combined", executionError], ["falsy", undefined]]) {
        await assert.rejects(queries.run({id}), error => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [failure, cleanupError]);
            return true;
        });
    }
    assert.equal(scopes.length, 7);
    assert.deepEqual(cleaned, scopes);
    for (const scope of scopes) assert.throws(() => scope.has("hooks"), /Services scope is disposed/);
});
