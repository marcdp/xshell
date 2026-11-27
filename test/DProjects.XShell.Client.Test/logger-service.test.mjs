import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {setImmediate as waitTurn} from "node:timers/promises";
import vm from "node:vm";
import LoggerContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/logger.json" with {type: "json"};
import ProviderContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/logger-provider.json" with {type: "json"};
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with {type: "json"};
import ModuleSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/module.schema.json" with {type: "json"};
import ServiceSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/service.schema.json" with {type: "json"};
import LoaderEsmJs from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/esm-js.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Logger from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/logger.js";
import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";
import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/resolver.js";
import LoggerConsole from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-logger/providers/logger-console.js";

const resources = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);
const bootstrap = readFileSync(new URL("bootstrap/index.js", resources), "utf8");
const manifest = JSON.parse(readFileSync(new URL("xshell/manifest.jsonc", resources), "utf8").replace(/^\s*\/\/[^\r\n]*/gm, ""));
const {logger: registration} = manifest.xshell.services;
const levels = ["trace", "debug", "info", "warn", "error"];
const appBaseUrl = "https://example.test/app/";
const omitted = Symbol("omitted selection");

function composeManifests(app, modules) {
    // Run the active bootstrap's normalization, dependency-ordered merge and resolver generation.
    const source = [bootstrap.match(/^        function normalizeUrl\([\s\S]*?^        \}\r?\n        function normalizeManifest\([\s\S]*?^        \}/m)[0],
        bootstrap.match(/^        function mergeManifests\(\) \{[\s\S]*?^        \}/m)[0],
        bootstrap.slice(bootstrap.indexOf("function fillXShellResolverRules(config)"), bootstrap.indexOf("config = fillXShell(config);"))].join("\n");
    const resolvedModules = new Map([app, ...modules].map(item => [item.name, {...item}]));
    return vm.runInNewContext(`${source}
        for (const module of resolvedModules.values()) module.manifest = normalizeManifest(module.manifest, module);
        const config = mergeManifests();
        config.app = {baseUrl: appBaseUrl};
        fillXShellResolverRules(config);
        structuredClone(config);
    `, {URL, appBaseUrl, app: resolvedModules.get(app.name), resolvedModules, structuredClone});
}

function composeLogger(selection = omitted, providers = {}, overrides = {}, otherProviders = {}, contributedSelection = omitted) {
    // Keep the existing provider fixtures independent of the bundled console provider.
    const serviceConfig = (provider, declarations) => ({services: {logger: {options: {
        ...(provider === omitted ? {} : {provider}), providers: declarations
    }}}});
    const module = (name, xshell, dependencies = {}) => {
        const assetsPath = `/_assets/${name}/1.dev`;
        return {name, assetsPath, dependencies, manifestUrl: appBaseUrl + name + "/manifest.json",
            manifest: {modules: name === "xshell" ? {} : {[name]: {files: []}}, xshell}};
    };
    const framework = module("xshell", {resolver: manifest.xshell.resolver, services: {logger: registration}});
    const first = module("first", serviceConfig(contributedSelection, providers));
    const second = module("second", serviceConfig(omitted, otherProviders));
    const app = module("app", serviceConfig(selection, overrides), {first: "1", second: "1"});
    return composeManifests(app, [first, second, framework]);
}

async function createServices(config, loadProvider = () => assert.fail("Unexpected provider load")) {
    // Use the real resolver and service lifecycle, with test implementations at the loader boundary.
    const loads = [];
    const resolver = new Resolver({config});
    const loader = {async load(resource) {
        if (resource === `esm:${config.xshell.services.logger.implementation}`) return Logger;
        const resolved = resolver.resolve(resource);
        loads.push(resolved);
        if (!resolved) throw new Error(`Resource not found: ${resource}`);
        return loadProvider(resolved);
    }};
    const services = new Services({config, resolver, loader, contracts: {
        getContractItemById: id => id === "logger" ? {id, contract: LoggerContract} : undefined
    }});
    services.register("loader", loader);
    services.register("bus", {emit() {}});
    services.register("tasks", null, {implementationItem: {class: Tasks}});
    await services.init();
    return {services, loads};
}

test("Core registers Logger as a singleton with schema-valid public contracts", async () => {
    assert.deepEqual(registration, {contract: "logger", implementation: "/services/logger.js", lifetime: "singleton",
        options: {provider: null, providers: {}}});
    for (const contract of [LoggerContract, ProviderContract]) {
        const result = new JsonValidator().validate(contract, ServiceSchema, {"./contract.schema.json": ContractSchema});
        assert.equal(result.valid, true, JSON.stringify(result.errors));
    }
    assert.deepEqual(Object.keys(LoggerContract.methods), levels);
    assert.deepEqual(Object.keys(ProviderContract.methods), ["log"]);
    const {services} = await createServices(composeLogger());
    const logger = await services.initialize("logger");
    assert.strictEqual(services.beginScope().resolve("logger"), logger);
    for (const method of ["setProvider", "getProvider", "addProvider", "removeProvider", "configure", "enable", "disable"]) {
        assert.equal(method in logger, false);
    }
});

test("missing and explicit null selection ignore all calls without loading providers or writing output", async t => {
    const output = [...levels, "log"].map(name => t.mock.method(console, name, () => {}));
    const providers = {unused: {implementation: "/providers/unused.js"}};
    const defaultConfig = composeLogger(omitted, providers);
    const disabledConfig = composeLogger(null, providers, {}, {}, "unused");
    assert.equal(defaultConfig.xshell.services.logger.options.provider, null);
    assert.equal(disabledConfig.xshell.services.logger.options.provider, null);
    const missingConfig = composeLogger();
    missingConfig.xshell.services.logger.options = {};
    for (const config of [missingConfig, defaultConfig, disabledConfig]) {
        const {services, loads} = await createServices(config);
        const logger = await services.initialize("logger");
        for (const level of levels) assert.equal(logger[level]("ignored", {}), undefined);
        const task = services.resolve("tasks").run({title: "Logging disabled", handler() { return 42; }});
        assert.equal(await task.getResult(), 42);
        assert.deepEqual(loads, []);
    }
    for (const method of output) assert.equal(method.mock.callCount(), 0);
});

test("a provider can resolve an instrumented service during initialization and its logging errors stay isolated", async () => {
    const config = composeLogger("selected", {selected: {implementation: "/providers/selected.js"}});
    const events = [];
    let tasks;
    const {services, loads} = await createServices(config, () => class {
        constructor(dependencies) { tasks = dependencies.tasks; }
        log(level, message, metadata) {
            events.push({level, message, metadata});
            throw new Error("provider failed");
        }
    });
    const logger = await services.initialize("logger");
    assert.strictEqual(tasks, services.resolve("tasks"));
    const metadata = {count: 1};
    for (const level of levels) assert.equal(logger[level]("Provider isolation", metadata), undefined);
    assert.deepEqual(events.map(event => event.level), levels);
    assert.ok(events.every(event => event.metadata === metadata));
    const task = tasks.run({title: "Logging enabled", handler() { return 42; }});
    assert.equal(await task.getResult(), 42);
    assert.ok(events.some(({level, message, metadata}) => level === "debug" && message === "Tasks: execution completed" && metadata.taskId === task.id));
    assert.equal(loads.length, 1);
});

test("provider contributions compose, preserve module ownership and delegate original arguments once initialized", async () => {
    const config = composeLogger("/custom", {"/custom": {implementation: "/providers/selected.js",
        options: {endpoint: "app:/api/logs", nested: {enabled: true, source: "module"}}}},
    {"/custom": {options: {endpoint: "app:/api/application/logs", nested: {source: "app"}}}},
    {["__proto__"]: {implementation: "./providers/unused.js"}});
    const providerOptions = {endpoint: appBaseUrl + "api/application/logs", nested: {enabled: true, source: "app"}};
    assert.deepEqual(config.xshell.services.logger.options, {provider: "/custom", providers: {
        "/custom": {implementation: "/_assets/first/1.dev/providers/selected.js", options: providerOptions},
        ["__proto__"]: {implementation: "/_assets/second/1.dev/providers/unused.js"}
    }});
    const calls = [];
    let constructions = 0;
    const {services, loads} = await createServices(config, () => class {
        constructor(dependencies, options) {
            constructions++;
            assert.strictEqual(dependencies.services, services);
            assert.deepEqual(options, providerOptions);
        }
        log(...args) { calls.push(args); return Promise.resolve("ignored"); }
    });
    const [logger, same] = await Promise.all([services.initialize("logger"), services.initialize("logger")]);
    assert.strictEqual(logger, same);
    const values = ["message", 42, {key: "value"}, [1], new Error("failure"), undefined, Symbol("value")];
    assert.equal(logger.trace(), undefined);
    for (const level of levels) assert.equal(logger[level](...values), undefined);
    assert.deepEqual(calls.shift(), ["trace"]);
    for (const [index, call] of calls.entries()) {
        assert.equal(call[0], levels[index]);
        assert.equal(call.length, values.length + 1);
        values.forEach((value, position) => assert.strictEqual(call[position + 1], value));
    }
    assert.equal(calls.length, levels.length);
    assert.equal(constructions, 1);
    assert.deepEqual(loads.map(({definition, path}) => [definition.moduleId, path]), [["first", "/_assets/first/1.dev/providers/selected.js"]]);
});

test("an application can select its own provider with omitted options", async () => {
    const config = composeLogger("local", {}, {local: {implementation: "./providers/own.js"}});
    const {services, loads} = await createServices(config, () => class {
        constructor(dependencies, options) { assert.deepEqual(options, {}); }
        log() {}
    });
    (await services.initialize("logger")).info();
    assert.deepEqual(loads.map(({definition, path}) => [definition.moduleId, path]), [["app", "/_assets/app/1.dev/providers/own.js"]]);
});

test("selected provider configuration, load, construction and contract failures reject initialization", async () => {
    for (const [id, declaration, implementation, message] of [
        ["constructor", undefined, undefined, /logger.*unknown provider 'constructor'/],
        ["bad", {}, undefined, /Invalid options for service 'logger'.*bad.*implementation/],
        ["bad", {implementation: " "}, undefined, /Invalid options for service 'logger'.*bad.*implementation/],
        ["bad", {implementation: "unknown-reference"}, undefined, /logger.*'bad'.*Resource not found/],
        ["bad", {implementation: "/bad.js"}, () => { throw new Error("import failed"); }, /logger.*'bad'.*import failed/],
        ["bad", {implementation: "/bad.js"}, () => class { constructor() { throw null; } }, /logger.*'bad'.*null/],
        ["bad", {implementation: "/bad.js"}, () => ({}), /logger.*'bad'.*default-exported class/],
        ["bad", {implementation: "/bad.js"}, () => class { log = true; }, /logger.*'bad'.*callable log/]
    ]) {
        const config = composeLogger(id, declaration ? {[id]: declaration} : {});
        const {services} = await createServices(config, implementation);
        await assert.rejects(async () => services.initialize("logger"), message);
    }
});

test("LoggerConsole synchronously forwards the original arguments to the matching native method", t => {
    assert.equal(LoggerConsole.name, "LoggerConsole");
    const provider = new LoggerConsole();
    assert.equal(typeof provider.log, "function");
    const fallback = t.mock.method(console, "log", () => {});
    const methods = levels.map(level => t.mock.method(console, level, function () {
        assert.strictEqual(this, console);
        return "ignored";
    }));
    const args = ["Message %s %o", "formatted", {count: 1}, ["first"], new Error("failure"), undefined, Symbol("value")];

    // Verify direct delegation, including zero arguments, by inspecting only the selected console method.
    for (const [index, level] of levels.entries()) {
        assert.equal(provider.log(level), undefined);
        assert.equal(provider.log(level, ...args), undefined);
        assert.deepEqual(methods.map(method => method.mock.callCount()), levels.map((_, position) => position <= index ? 2 : 0));
        const [empty, call] = methods[index].mock.calls;
        assert.deepEqual(empty.arguments, []);
        assert.equal(call.arguments.length, args.length);
        args.forEach((value, position) => assert.strictEqual(call.arguments[position], value));
    }
    assert.equal(fallback.mock.callCount(), 0);
});

test("x-logger providers are selected, configured or disabled by the application", async t => {
    // Compose the authored module manifest with the framework and an application selecting the provider.
    const authored = JSON.parse(readFileSync(new URL("x-logger/manifest.jsonc", resources), "utf8").replace(/^\s*\/\/[^\r\n]*/gm, ""));
    const module = authored.modules["x-logger"];
    const providerFile = "/providers/logger-console.js";
    const indexedDBFile = "/providers/logger-indexeddb.js";
    const assetsPath = `/_assets/x-logger/${module.version}.dev`;
    const implementation = assetsPath + providerFile;
    const reference = "module:x-logger:latest";
    const loggerManifest = {...authored, modules: {"x-logger": {...module, files: []}}};
    // Resolve the dependency with the production bootstrap and the standard development index response shape.
    const discovery = bootstrap.slice(bootstrap.indexOf("const stableVersion ="), bootstrap.indexOf("// Load repositories and resolve modules"));
    const discovered = await vm.runInNewContext(discovery + "\nresolveModule(reference)", {
        URL, reference, resolvedModules: new Map(),
        repositoryIndexes: new Map([[0, {url: appBaseUrl + "index.json", index: {modules: {"x-logger": {url: "x-logger/index.json"}}}}]]),
        fetchIndex(url) {
            assert.equal(url, appBaseUrl + "x-logger/index.json");
            return {module: "x-logger", versions: {[module.version]: {url: `${module.version}.dev/manifest.json`, dependencies: {}}}};
        }
    });
    assert.equal(discovered.version, module.version);
    const contributions = [
        {name: "xshell", assetsPath: "/_assets/xshell/1.dev", manifest: {xshell: {resolver: manifest.xshell.resolver, services: {logger: registration}}}},
        {...discovered, assetsPath, assetsUrl: discovered.baseUrl, manifest: loggerManifest}
    ];
    const defaults = {maxEntries: 10000, retentionDays: 7};
    assert.deepEqual(authored.xshell.services, {logger: {options: {providers: {
        console: {implementation: providerFile}, indexeddb: {implementation: indexedDBFile, options: defaults}
    }}}});
    const log = t.mock.method(console, "debug", () => {});
    t.mock.method(console, "warn", () => {});
    const open = t.mock.fn(() => { throw new Error("Test storage unavailable."); });
    const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
    Object.defineProperty(globalThis, "indexedDB", {configurable: true, value: {open}});
    t.after(() => {
        if (previousStorage) Object.defineProperty(globalThis, "indexedDB", previousStorage);
        else delete globalThis.indexedDB;
    });
    const esm = new LoaderEsmJs();
    const value = {commandId: "sample"};
    const overrides = {databaseName: "logger-integration", retentionDays: 30};

    for (const selection of [omitted, "console", "indexeddb", null]) {
        const dependencies = {xshell: "module:xshell:latest", "x-logger": reference};
        const indexeddb = selection === "indexeddb";
        const options = indexeddb ? {provider: selection, providers: {indexeddb: {options: overrides}}} : {provider: selection};
        const app = {name: "app", assetsPath: "/_assets/app/1.dev", dependencies,
            manifest: {modules: {app: {dependencies}}, ...(selection === omitted ? {} : {xshell: {services: {logger: {options}}}})}};
        const config = composeManifests(app, contributions);
        const effective = config.xshell.services.logger;
        assert.deepEqual(effective, {...registration, implementation: "/_assets/xshell/1.dev/services/logger.js",
            options: {provider: selection === omitted ? null : selection, providers: {
                console: {implementation},
                indexeddb: {implementation: assetsPath + indexedDBFile, options: indexeddb ? {...defaults, ...overrides} : defaults}
            }}});
        const validation = new JsonValidator().validate(config.modules["x-logger"], ModuleSchema, {"./contract.schema.json": ContractSchema});
        assert.equal(validation.valid, true, JSON.stringify(validation.errors));

        // Use the standard ESM loader with a file URL for the resolved resource in this Node test.
        const {services, loads} = await createServices(config, resolved => {
            assert.equal(resolved.definition.moduleId, "x-logger");
            assert.equal(resolved.definition.loader, "esm-js");
            assert.equal(resolved.path, indexeddb ? assetsPath + indexedDBFile : implementation);
            return esm.load(new URL("x-logger" + resolved.path.slice(assetsPath.length), resources).href);
        });
        const logger = await services.initialize("logger");
        logger.debug("Provider integration", value);
        await waitTurn();
        assert.equal(loads.length, selection === "console" || indexeddb ? 1 : 0);
        assert.equal(log.mock.callCount(), selection === "console" ? 1 : 0);
        assert.equal(open.mock.callCount(), indexeddb ? 1 : 0);
        if (indexeddb) {
            assert.deepEqual(open.mock.calls[0].arguments, [overrides.databaseName, 1]);
            open.mock.resetCalls();
        }
        if (selection === "console") {
            assert.equal(log.mock.calls[0].arguments[0], "Provider integration");
            assert.strictEqual(log.mock.calls[0].arguments[1], value);
            log.mock.resetCalls();
        }
    }
});
