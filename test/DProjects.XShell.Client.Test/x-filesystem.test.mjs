import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import FilesystemsContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/contracts/filesystems.json" with { type: "json" };
import filesystemDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/components/x-filesystem.js";
import Filesystem, {checkAbort, matchesPattern, parentPath} from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem.js";
import FilesystemFile from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-file.js";
import FilesystemHttp from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-http.js";
import FilesystemMem from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-mem.js";
import FilesystemOpfs from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-opfs.js";
import Filesystems from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/services/filesystems.js";
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Loader from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/loader.js";
import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/resolver.js";

const commands = [
    { id: "command:filesystem.entry.encrypt.aes", label: "Encrypt", icon: "x-lock", type: "file", extensions: ["txt"], actions: [] },
    { id: "command:filesystem.entry.zip", label: "Download as ZIP", icon: "x-zip", type: "entry", actions: [] }
];
const editors = {
    text: { page: "page:x-filesystem:/pages/editor-text.js", label: "Open", icon: "x-preview", extensions: ["txt", "txt.aes", "md"] },
    image: { page: "page:x-filesystem:/pages/editor-image.js", label: "Open", icon: "x-preview", extensions: ["png", "png.aes"] },
    iframe: { page: "page:x-filesystem:/pages/editor-iframe.js", label: "Open", icon: "x-preview", extensions: ["pdf"] }
};
const testConfig = { app: { baseUrl: "https://example.test/" } };

function createServices(values = {}) {
    // Model the owning Services context while recording only dependencies providers actually request.
    const resolved = [];
    const services = {resolved, resolve(name) { resolved.push(name); if (Object.hasOwn(values, name)) return values[name]; throw new Error(`Unexpected Service '${name}'.`); }};
    return services;
}

function createPreferences(initial = []) {
    // Model Preferences records with structured-clone boundaries and observable writes for focused Service tests.
    const values = new Map(initial.map(([key, value]) => [key, structuredClone(value)]));
    const calls = {set: 0, delete: 0};
    return {
        calls,
        async set(key, value) { calls.set++; values.set(key, structuredClone(value)); },
        async get(key, defaultValue) { return values.has(key) ? structuredClone(values.get(key)) : defaultValue; },
        async delete(key) { calls.delete++; values.delete(key); },
        async list(prefix = "") {
            return [...values].filter(([key]) => key.startsWith(prefix)).map(([name, value], index) => ({
                id: `preference-${index}`,
                name,
                label: name,
                revision: 1,
                value: structuredClone(value)
            }));
        }
    };
}

function createRuntime(providers, services = {}) {
    // Build scheme-dispatched providers beside a global Resolver and Loader with no Filesystem category.
    const jsonValidator = new JsonValidator();
    const serviceScope = createServices({jsonValidator, ...services});
    const config = {
        app: { basePath: "", baseUrl: new URL("../../", import.meta.url).href },
        xshell: { assets: { path: "/_assets/xshell" }, resolver: {} }
    };
    const resolver = new Resolver({config});
    const xshellRuntimeUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell", import.meta.url).href;
    const loader = new Loader({resolver, bus: {emit() {}}, services}, {
        appBasePath: xshellRuntimeUrl,
        xshellAssetsPath: "",
        componentLazy: null
    });
    return {
        config,
        resolver,
        loader,
        serviceScope,
        filesystems: new Filesystems({config, jsonValidator, preferences: services.preferences, services: serviceScope}, {providers})
    };
}

function createController() {
    // Create a focused controller harness with real editor selection and captured navigation.
    const state = structuredClone(filesystemDefinition.state);
    state.src = "mem:";
    const navigationCalls = [];
    const contextMenuCalls = [];
    const filesystemOpenCalls = [];
    const jsonValidator = new JsonValidator();
    const filesystems = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {commands, editors});
    filesystems.open = async url => { filesystemOpenCalls.push(url); return {url}; };
    const eventHandlers = {};
    const host = {
        shadowRoot: {
            querySelector(selector) {
                if (selector === "x-contextmenu") return { open(options) { contextMenuCalls.push(options); } };
                return null;
            }
        }
    };
    const controller = filesystemDefinition.controller({
        state,
        events: { on(target, event, handler) { eventHandlers[event] = handler; } },
        navigation: { navigate(options) { navigationCalls.push(options); } },
        getPage() { return { id: "filesystem-page" }; },
        host,
        dialog: {},
        tasks: {},
        resolver: {},
        filesystems
    });
    return { state, controller, navigationCalls, contextMenuCalls, filesystemOpenCalls, eventHandlers };
}

test("shared filesystem helpers preserve virtual paths, wildcard matching, and abort behavior", () => {
    // Exercise the provider-independent semantics now shared by the base and concrete providers.
    assert.equal(parentPath("/"), "/");
    assert.equal(parentPath("/file.txt"), "/");
    assert.equal(parentPath("/folder/file.txt"), "/folder");
    assert.throws(() => parentPath("relative/file.txt"), /Invalid filesystem path/);

    assert.equal(matchesPattern("anything.txt", null), true);
    assert.equal(matchesPattern("anything.txt", "*"), true);
    assert.equal(matchesPattern("file1.txt", "file?.txt"), true);
    assert.equal(matchesPattern("file12.txt", "file?.txt"), false);
    assert.equal(matchesPattern("item7", "item#"), true);
    assert.equal(matchesPattern("itemx", "item#"), false);
    assert.equal(matchesPattern("file[1].txt", "file[1].txt"), true);
    assert.equal(matchesPattern("file1.txt", "file[1].txt"), false);
    assert.throws(() => matchesPattern("file.txt", 1), /pattern must be a string or null/);

    const controller = new AbortController();
    assert.doesNotThrow(() => checkAbort(controller.signal));
    controller.abort();
    assert.throws(() => checkAbort(controller.signal), error => error?.name === "AbortError");
    assert.throws(() => checkAbort({aborted: true}), error => error?.name === "AbortError");
});

test("Filesystems.open resolves and imports providers locally", async () => {
    // Prove parsed options override cloned defaults and the canonical URL reaches direct construction.
    const implementation = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
        static optionsDefinition = {
            schema: {type: "object", required: ["scheme", "resource"], properties: {scheme: {type: "string"}, tag: {type: "string"}, resource: {type: "string"}}, additionalProperties: false},
            parseUrl(url) { if (!this.schema) throw new Error("missing descriptor context"); const separator = url.indexOf(":"); return {scheme: url.slice(0, separator).toLowerCase(), resource: url.slice(separator + 1)}; },
            getUrl(options) { if (!this.schema) throw new Error("missing descriptor context"); return options.scheme + ":" + options.resource.toLowerCase(); }
        };
        constructor(services, options, credentials = null) { this.options = structuredClone(options); this.url = Implementation.optionsDefinition.getUrl(options); this.credentials = credentials; options.tag = "provider mutation"; }
    }`);
    const providerOptions = {tag: "configured", resource: "authored"};
    const jsonValidator = new JsonValidator();
    const filesystems = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {
        providers: {test: {implementation, options: providerOptions}}
    });
    providerOptions.tag = "changed";

    const instance = await filesystems.open("test:DEMO");
    const second = await filesystems.open("test:DEMO");
    assert.deepEqual(instance.options, {tag: "configured", scheme: "test", resource: "DEMO"});
    assert.equal(instance.url, "test:demo");
    assert.equal(instance.credentials, null);
    assert.notStrictEqual(instance, second);
    assert.deepEqual(providerOptions, {tag: "changed", resource: "authored"});
    for (const value of [null, undefined, "", "   ", 0, false, {}, []]) {
        await assert.rejects(() => filesystems.open(value), { name: "TypeError", message: "Filesystem URL must be a non-empty string." });
    }
    await assert.rejects(() => filesystems.open("unknown:missing"), /Filesystem provider not found: unknown:missing/);
});

test("Filesystems contract exposes the minimal named management API and existing operations", () => {
    // Validate the public methods through the shared Service contract vocabulary.
    const result = new JsonValidator().validate(FilesystemsContract, ContractSchema);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(Object.keys(FilesystemsContract.methods), [
        "listProviders", "listDefinitions", "saveDefinition", "removeDefinition", "openNamed", "open", "getEditor"
    ]);
});

test("Filesystems.listProviders exposes sorted cloned management metadata only", async () => {
    // Discover configured providers without leaking implementation details or mutable internal configuration.
    const jsonValidator = new JsonValidator();
    const httpImplementation = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-http.js", import.meta.url).href;
    const memImplementation = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-mem.js", import.meta.url).href;
    const filesystems = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {
        providers: {
            https: {implementation: httpImplementation, options: {scheme: "https"}},
            mem: {implementation: memImplementation}
        }
    });

    const providers = await filesystems.listProviders();
    assert.deepEqual(providers.map(provider => provider.id), ["https", "mem"]);
    assert.deepEqual(providers.map(provider => provider.credentialsSchema), [null, null]);
    assert.deepEqual(providers[0].defaults, {scheme: "https"});
    assert.deepEqual(Object.keys(providers[0]).sort(), ["credentialsSchema", "defaults", "id", "label", "optionsSchema"]);
    assert.equal(providers[0].optionsSchema.properties.scheme.enum.includes("https"), true);
    assert.equal(Object.hasOwn(providers[0], "implementation"), false);

    providers[0].defaults.scheme = "http";
    providers[0].optionsSchema.properties.scheme.enum.push("ftp");
    const again = await filesystems.listProviders();
    assert.deepEqual(again[0].defaults, {scheme: "https"});
    assert.equal(again[0].optionsSchema.properties.scheme.enum.includes("ftp"), false);
});

test("Filesystems saves, lists, replaces, and validates named definitions", async () => {
    // Persist only the domain shape after provider validation while keeping caller and returned objects isolated.
    const preferences = createPreferences();
    const jsonValidator = new JsonValidator();
    const implementation = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-http.js", import.meta.url).href;
    const filesystems = new Filesystems({config: testConfig, jsonValidator, preferences, services: createServices({jsonValidator})}, {
        providers: {https: {implementation, options: {scheme: "https"}}}
    });
    const input = {
        name: "work",
        label: "Work Files",
        provider: "HTTPS",
        options: {host: "files.example.com", path: "/documents", isReadonly: true}
    };
    const inputSnapshot = structuredClone(input);

    await filesystems.saveDefinition(input);
    assert.deepEqual(input, inputSnapshot);
    assert.equal(preferences.calls.set, 1);
    assert.deepEqual(await filesystems.listDefinitions(), [{
        name: "work",
        label: "Work Files",
        provider: "https",
        options: {host: "files.example.com", path: "/documents", isReadonly: true}
    }]);

    const returned = await filesystems.listDefinitions();
    returned[0].options.host = "changed.example.com";
    assert.equal((await filesystems.listDefinitions())[0].options.host, "files.example.com");

    await filesystems.saveDefinition({name: "work", provider: "https", options: {host: "updated.example.com", path: "/"}});
    await filesystems.saveDefinition({name: "alpha", label: "Alpha", provider: "https", options: {host: "alpha.example.com"}});
    const updated = await filesystems.listDefinitions();
    assert.deepEqual(updated.map(definition => definition.name), ["alpha", "work"]);
    assert.equal(updated[1].label, "work");
    assert.equal(updated[1].options.host, "updated.example.com");

    const writeCount = preferences.calls.set;
    for (const invalidName of ["", "bad name", "-leading", "slash/name"]) {
        await assert.rejects(() => filesystems.saveDefinition({name: invalidName, provider: "https", options: {host: "example.com"}}), /definition name is invalid/);
    }
    await assert.rejects(() => filesystems.saveDefinition({name: "unknown", provider: "missing", options: {}}), /provider not found: missing/);
    await assert.rejects(() => filesystems.saveDefinition({name: "invalid", provider: "https", options: {path: "/missing-host"}}), /Invalid Filesystem provider options/);
    await assert.rejects(() => filesystems.saveDefinition({name: "mismatch", provider: "https", options: {scheme: "http", host: "example.com"}}), /different provider/);
    await assert.rejects(() => filesystems.saveDefinition({name: "null-options", provider: "https", options: null}), /options must be a non-null object/);
    assert.equal(preferences.calls.set, writeCount);
});

test("Filesystems.openNamed preserves options and caches by registration name", async () => {
    // Materialize named definitions directly so non-URL options survive and names remain independent identities.
    const preferences = createPreferences();
    const jsonValidator = new JsonValidator();
    const implementation = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-http.js", import.meta.url).href;
    const filesystems = new Filesystems({config: testConfig, jsonValidator, preferences, services: createServices({jsonValidator})}, {
        providers: {https: {implementation, options: {scheme: "https"}}}
    });
    const options = {host: "files.example.com", path: "/documents", isReadonly: true};
    await filesystems.saveDefinition({name: "work", provider: "https", options});
    await filesystems.saveDefinition({name: "mirror", provider: "https", options});
    await filesystems.saveDefinition({name: "concurrent", provider: "https", options});

    const work = await filesystems.openNamed("work");
    assert.equal(work.url, "https://files.example.com/documents");
    assert.equal(work.isReadonly, true);
    assert.strictEqual(await filesystems.openNamed("work"), work);
    assert.notStrictEqual(await filesystems.openNamed("mirror"), work);
    const [concurrentFirst, concurrentSecond] = await Promise.all([
        filesystems.openNamed("concurrent"),
        filesystems.openNamed("concurrent")
    ]);
    assert.strictEqual(concurrentFirst, concurrentSecond);

    await filesystems.saveDefinition({name: "work", provider: "https", options: {...options, isReadonly: false}});
    const updated = await filesystems.openNamed("work");
    assert.notStrictEqual(updated, work);
    assert.equal(updated.isReadonly, false);

    const mirror = await filesystems.openNamed("mirror");
    await filesystems.removeDefinition("mirror");
    assert.equal((await filesystems.listDefinitions()).some(definition => definition.name === "mirror"), false);
    await preferences.set("x-filesystem:filesystem:mirror", {name: "mirror", label: "mirror", provider: "https", options});
    assert.notStrictEqual(await filesystems.openNamed("mirror"), mirror);
    await assert.rejects(() => filesystems.openNamed("missing"), /Filesystem definition not found: missing/);
});

test("Filesystems.openNamed evicts failed creation and retries with null credentials", async () => {
    // Exercise named in-flight sharing and failed-entry eviction independently from raw provider cache keys.
    const preferences = createPreferences();
    const providerUrl = new URL("./fixtures/filesystem-provider.mjs?case=named", import.meta.url).href;
    const provider = await import(providerUrl);
    provider.reset();
    const {filesystems} = createRuntime({test: {implementation: providerUrl}}, {preferences});
    const definition = {name: "retry", provider: "test", options: {scheme: "test", resource: "same"}};
    await filesystems.saveDefinition(definition);

    provider.failOnce();
    await assert.rejects(() => filesystems.openNamed("retry"), /Simulated Filesystem provider failure/);
    const retried = await filesystems.openNamed("retry");
    assert.equal(retried.number, 2);
    assert.deepEqual(provider.getCalls().map(call => call.credentials), [null, null]);

    await filesystems.saveDefinition({name: "shared", provider: "test", options: {scheme: "test", resource: "shared"}});
    const [first, second] = await Promise.all([filesystems.openNamed("shared"), filesystems.openNamed("shared")]);
    assert.strictEqual(first, second);
    assert.equal(provider.getCalls().filter(call => call.url === "test:shared").length, 1);
});

test("Filesystems module exposes only the intended default implementation", async () => {
    // Keep private credential validation internal without introducing a test-only production API.
    const module = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/services/filesystems.js");
    const source = readFileSync(new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/services/filesystems.js", import.meta.url), "utf8");
    assert.deepEqual(Object.keys(module), ["default"]);
    assert.doesNotMatch(source, /JSON\.stringify\(\s*(?:credentials|copy)/);
    assert.match(source, /credentials cannot be cloned\./);
});

test("Filesystems.open preserves local provider memory identity semantics without Loader materialization", async t => {
    // Exercise scheme dispatch, direct import, validation, construction, and the domain-owned cache.
    const providerUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-mem.js", import.meta.url).href;
    const {resolver, loader, filesystems} = createRuntime({
        mem: {implementation: providerUrl, options: {instance: "configured"}}
    });

    const anonymousFirst = await filesystems.open("mem:");
    const anonymousSecond = await filesystems.open("mem:");
    const namedFirst = await filesystems.open("mem:demo");
    await namedFirst.saveFile("/shared.txt", "shared state");
    const namedAgain = await filesystems.open("mem:demo");
    const namedOther = await filesystems.open("mem:other");

    assert.notStrictEqual(anonymousFirst, anonymousSecond);
    assert.strictEqual(namedFirst, namedAgain);
    assert.notStrictEqual(namedFirst, namedOther);
    assert.deepEqual([anonymousFirst.url, namedFirst.url, namedOther.url], ["mem:", "mem:demo", "mem:other"]);
    assert.equal((await namedAgain.getEntry("/shared.txt")).length, 12);
    assert.equal(await namedOther.getEntry("/shared.txt"), null);
    assert.deepEqual(loader.registry, []);
    assert.equal(resolver.registry.some(item => item.resource.startsWith("filesystem:")), false);
    t.mock.method(console, "error", () => {});
    assert.equal(resolver.resolve("filesystem:mem:demo"), null);
    await assert.rejects(() => loader.load("filesystem:mem:demo"), { name: "ResourceError", code: "RESOURCE_NOT_FOUND" });
});

test("failed cached provider creation is evicted and retried", async () => {
    // Evict a failed provider-owned cache identity so a later open can retry construction.
    const providerUrl = new URL("./fixtures/filesystem-provider.mjs?case=retry", import.meta.url).href;
    const provider = await import(providerUrl);
    provider.reset();
    provider.failOnce();
    const {filesystems, loader} = createRuntime({test: {implementation: providerUrl}});

    await assert.rejects(() => filesystems.open("test:demo"), /Simulated Filesystem provider failure/);
    const value = await filesystems.open("test:demo");

    assert.equal(value.number, 2);
    assert.deepEqual(provider.getCalls().map(call => call.url), ["test:demo", "test:demo"]);
    assert.deepEqual(loader.registry, []);
});

test("concurrent cached opens share one in-flight provider materialization", async () => {
    // Share one in-flight construction for the provider-defined cache identity.
    const providerUrl = new URL("./fixtures/filesystem-provider.mjs?case=concurrent", import.meta.url).href;
    const provider = await import(providerUrl);
    provider.reset();
    const {filesystems, loader} = createRuntime({test: {implementation: providerUrl}});

    const firstPromise = filesystems.open("test:demo");
    const secondPromise = filesystems.open("test:demo");
    await provider.waitForCallCount(1);
    assert.equal(provider.getCalls().length, 1);
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    assert.strictEqual(first, second);
    assert.equal(loader.registry.length, 0);
});

test("providers can define query-independent cache identity", async () => {
    // Let the implementation share query variants while passing the first complete URL to construction.
    const providerUrl = new URL("./fixtures/filesystem-provider.mjs?case=path-cache", import.meta.url).href;
    const provider = await import(providerUrl);
    provider.reset();
    const {filesystems, loader} = createRuntime({
        test: {implementation: providerUrl}
    });

    const first = await filesystems.open("test:demo?view=one");
    const second = await filesystems.open("test:demo?view=two");

    assert.strictEqual(first, second);
    assert.equal(loader.registry.length, 0);
    assert.deepEqual(provider.getCalls().map(call => call.url), ["test:demo?view=one"]);
});

test("Filesystems constructs from validated options without injecting the projected URL", async () => {
    // Verify construction receives the URL representation as options and leaves credentials null.
    const providerUrl = new URL("./fixtures/filesystem-provider.mjs?case=context", import.meta.url).href;
    const provider = await import(providerUrl);
    provider.reset();
    const {filesystems, loader} = createRuntime({test: {implementation: providerUrl, options: {tag: "configured"}}});

    await filesystems.open("test:demo");

    assert.deepEqual(loader.registry, []);
    assert.deepEqual(provider.getCalls().map(call => call.url), ["test:demo"]);
    assert.deepEqual(provider.getCalls().map(call => call.options), [{tag: "configured", scheme: "test", resource: "demo"}]);
    assert.deepEqual(provider.getCalls().map(call => call.credentials), [null]);
});

test("Filesystems requires valid provider options definitions and resolves dependencies lazily", async () => {
    // Reject definition, schema, and option failures before construction, then expose only requested Services plus the owning context.
    for (const [optionsSource, expected] of [
        ["", /must define a static optionsDefinition object/],
        ["static optionsDefinition = null;", /invalid static optionsDefinition.*expected an object/],
        ["static optionsDefinition = [];", /invalid static optionsDefinition.*expected an object/],
        ["static optionsDefinition = {};", /must define static optionsDefinition\.parseUrl\(\)/],
        ["static optionsDefinition = {parseUrl() { return {}; }, getUrl() { return 'test:demo'; }};", /must define static optionsDefinition\.schema/],
        ["static optionsDefinition = {schema: [], parseUrl() { return {}; }, getUrl() { return 'test:demo'; }};", /invalid static optionsDefinition\.schema.*expected a JSON Schema object/],
        ["static optionsDefinition = {schema: {type: 'object', patternProperties: {'[': {type: 'string'}}}, parseUrl() { return {}; }, getUrl() { return 'test:demo'; }};", /invalid static optionsDefinition\.schema/]
    ]) {
        globalThis.__filesystemConstructions = 0;
        const implementation = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
            ${optionsSource} constructor() { globalThis.__filesystemConstructions++; }
        }`);
        const jsonValidator = new JsonValidator();
        const filesystems = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {
            providers: {test: {implementation}}
        });
        await assert.rejects(() => filesystems.open("test:demo"), expected);
        assert.equal(globalThis.__filesystemConstructions, 0);
    }

    const implementation = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
        static optionsDefinition = {
            schema: {type: "object", properties: {scheme: {type: "string"}, timeout: {type: "integer"}, resource: {type: "string"}}, additionalProperties: false},
            parseUrl(url) { const separator = url.indexOf(":"); return {scheme: url.slice(0, separator), resource: url.slice(separator + 1)}; },
            getUrl(options) { return options.scheme + ":" + options.resource; }
        };
        constructor({secrets, services}, options, credentials = null) { this.secrets = secrets; this.services = services; this.options = options; this.credentials = credentials; }
    }`);
    const jsonValidator = new JsonValidator();
    const serviceScope = createServices({jsonValidator, secrets: {credential: "work"}, unused: {}});
    const filesystems = new Filesystems({config: testConfig, jsonValidator, services: serviceScope}, {
        providers: {test: {implementation, options: {timeout: 30}}}
    });
    const instance = await filesystems.open("test:demo");
    assert.deepEqual(instance.secrets, {credential: "work"});
    assert.strictEqual(instance.services, serviceScope);
    assert.equal(instance.credentials, null);
    assert.deepEqual(serviceScope.resolved, ["secrets"]);
    delete globalThis.__filesystemConstructions;
});

test("Filesystems recognizes optional provider credential descriptors without requiring a payload", async () => {
    // Validate descriptor structure during ordinary opening while leaving required credential fields dormant when no payload is supplied.
    for (const [credentialsSource, expected] of [
        ["static credentialsDefinition = null;", /invalid static credentialsDefinition.*expected an object/],
        ["static credentialsDefinition = [];", /invalid static credentialsDefinition.*expected an object/],
        ["static credentialsDefinition = {};", /must define static credentialsDefinition\.schema/],
        ["static credentialsDefinition = {schema: null};", /invalid static credentialsDefinition\.schema.*expected a JSON Schema object/],
        ["static credentialsDefinition = {schema: []};", /invalid static credentialsDefinition\.schema.*expected a JSON Schema object/],
        ["static credentialsDefinition = {schema: {type: 'object', patternProperties: {'[': {type: 'string'}}}};", /invalid static credentialsDefinition\.schema/]
    ]) {
        globalThis.__filesystemCredentialConstructions = 0;
        const implementation = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
            static optionsDefinition = {schema: {type: "object"}, parseUrl() { return {}; }, getUrl() { return "test:"; }};
            ${credentialsSource} constructor() { globalThis.__filesystemCredentialConstructions++; }
        }`);
        const jsonValidator = new JsonValidator();
        const filesystems = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {
            providers: {test: {implementation}}
        });
        await assert.rejects(() => filesystems.open("test:"), expected);
        assert.equal(globalThis.__filesystemCredentialConstructions, 0);
    }

    const implementationWithoutCredentials = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
        static optionsDefinition = {schema: {type: "object"}, parseUrl() { return {}; }, getUrl() { return "test:"; }};
        constructor(services, options, credentials) { this.credentials = credentials; }
    }`);
    const jsonValidator = new JsonValidator();
    const withoutCredentials = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {
        providers: {test: {implementation: implementationWithoutCredentials}}
    });
    assert.equal((await withoutCredentials.open("test:")).credentials, null);

    const implementation = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
        static optionsDefinition = {schema: {type: "object"}, parseUrl() { return {}; }, getUrl() { return "test:"; }};
        static credentialsDefinition = {schema: {type: "object", required: ["token"], properties: {token: {type: "string"}}, additionalProperties: false}};
        constructor(services, options, credentials) { this.credentials = credentials; }
    }`);
    const filesystems = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {
        providers: {test: {implementation}}
    });
    assert.equal((await filesystems.open("test:")).credentials, null);
    delete globalThis.__filesystemCredentialConstructions;
});

test("Filesystems requires valid URL parsing and projection contracts", async () => {
    // Reject missing, malformed, and throwing provider URL methods before construction.
    const cases = [
        ["static optionsDefinition = {schema: {}, getUrl() { return 'test:demo'; }};", /must define static optionsDefinition\.parseUrl\(\)/],
        ["static optionsDefinition = {schema: {}, parseUrl: true, getUrl() { return 'test:demo'; }};", /invalid static optionsDefinition\.parseUrl.*expected a function/],
        ["static optionsDefinition = {schema: {}, parseUrl() { throw new Error('parse failed'); }, getUrl() { return 'test:demo'; }};", /static optionsDefinition\.parseUrl\(\) failed: parse failed/],
        ["static optionsDefinition = {schema: {}, parseUrl() { return null; }, getUrl() { return 'test:demo'; }};", /static optionsDefinition\.parseUrl\(\) must return a non-null options object/],
        ["static optionsDefinition = {schema: {}, parseUrl() { return []; }, getUrl() { return 'test:demo'; }};", /static optionsDefinition\.parseUrl\(\) must return a non-null options object/],
        ["static optionsDefinition = {schema: {}, parseUrl() { return 'invalid'; }, getUrl() { return 'test:demo'; }};", /static optionsDefinition\.parseUrl\(\) must return a non-null options object/],
        ["static optionsDefinition = {schema: {}, parseUrl() { return {}; }};", /must define static optionsDefinition\.getUrl\(\)/],
        ["static optionsDefinition = {schema: {}, parseUrl() { return {}; }, getUrl: true};", /invalid static optionsDefinition\.getUrl.*expected a function/],
        ["static optionsDefinition = {schema: {}, parseUrl() { return {}; }, getUrl() { throw new Error('projection failed'); }};", /static optionsDefinition\.getUrl\(\) failed: projection failed/],
        ["static optionsDefinition = {schema: {}, parseUrl() { return {}; }, getUrl() { return ''; }};", /static optionsDefinition\.getUrl\(\) must return a non-empty string/]
    ];
    for (const [optionsSource, expected] of cases) {
        globalThis.__filesystemContractConstructions = 0;
        const implementation = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
            ${optionsSource} constructor() { globalThis.__filesystemContractConstructions++; }
        }`);
        const jsonValidator = new JsonValidator();
        const filesystems = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {
            providers: {test: {implementation}}
        });
        await assert.rejects(() => filesystems.open("test:demo"), expected);
        assert.equal(globalThis.__filesystemContractConstructions, 0);
    }
    delete globalThis.__filesystemContractConstructions;
});

test("Filesystems validates parsed and merged options before canonical projection", async () => {
    // Prove invalid parsed data stops projection and construction after defaults are merged.
    globalThis.__filesystemProjectionCalls = 0;
    globalThis.__filesystemValidationConstructions = 0;
    const implementation = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
        static optionsDefinition = {
            schema: {type: "object", required: ["count"], properties: {count: {type: "integer"}}, additionalProperties: false},
            parseUrl() { return {count: "invalid"}; },
            getUrl() { globalThis.__filesystemProjectionCalls++; return "test:canonical"; }
        };
        constructor() { globalThis.__filesystemValidationConstructions++; }
    }`);
    const jsonValidator = new JsonValidator();
    const defaults = {count: 1};
    const filesystems = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {
        providers: {test: {implementation, options: defaults}}
    });

    await assert.rejects(() => filesystems.open("test:demo"), /Invalid Filesystem provider options/);
    assert.equal(globalThis.__filesystemProjectionCalls, 0);
    assert.equal(globalThis.__filesystemValidationConstructions, 0);
    assert.deepEqual(defaults, {count: 1});
    delete globalThis.__filesystemProjectionCalls;
    delete globalThis.__filesystemValidationConstructions;
});

test("Filesystems validates provider-defined cache identity before construction", async () => {
    // Reject malformed, empty, and throwing cache policies without constructing an implementation.
    for (const [cacheSource, expected] of [
        ["static getCacheKey = true;", /invalid static getCacheKey.*expected a function/],
        ["static getCacheKey() { return ''; }", /must return a non-empty string or null/],
        ["static getCacheKey() { throw new Error('identity failed'); }", /static getCacheKey failed: identity failed/]
    ]) {
        globalThis.__filesystemCacheConstructions = 0;
        const implementation = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
            static optionsDefinition = {
                schema: {type: "object", properties: {scheme: {type: "string"}, resource: {type: "string"}}, additionalProperties: false},
                parseUrl(url) { const separator = url.indexOf(":"); return {scheme: url.slice(0, separator), resource: url.slice(separator + 1)}; },
                getUrl(options) { return options.scheme + ":" + options.resource; }
            };
            ${cacheSource} constructor() { globalThis.__filesystemCacheConstructions++; }
        }`);
        const jsonValidator = new JsonValidator();
        const filesystems = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {
            providers: {test: {implementation}}
        });
        await assert.rejects(() => filesystems.open("test:demo"), expected);
        assert.equal(globalThis.__filesystemCacheConstructions, 0);
    }
    delete globalThis.__filesystemCacheConstructions;
});

test("Filesystems uses the canonical projected URL for cache identity", async () => {
    // Collapse distinct raw spellings only after provider-owned canonical projection.
    const providerUrl = new URL("./fixtures/filesystem-provider.mjs?case=canonical-cache", import.meta.url).href;
    const provider = await import(providerUrl);
    provider.reset();
    const {filesystems} = createRuntime({test: {implementation: providerUrl}});

    const first = await filesystems.open("test:demo/");
    const second = await filesystems.open("test:demo");

    assert.strictEqual(first, second);
    assert.equal(first.url, "test:demo");
    assert.equal(provider.getCalls().length, 1);
});

test("Filesystems options validate commands, keyed editors, and closed provider definitions", () => {
    // Accept provider policy while rejecting incomplete, mistyped, or extended definitions.
    const validator = new JsonValidator();
    const providers = {mem: {
        implementation: "/providers/filesystem-mem.js", options: {credential: "work"}
    } };
    assert.equal(validator.validate({ commands, editors, providers }, Filesystems.optionsSchema).valid, true);
    assert.equal(validator.validate({providers: {"mem:": providers.mem}}, Filesystems.optionsSchema).valid, false);
    assert.equal(validator.validate({providers: {MEM: providers.mem}}, Filesystems.optionsSchema).valid, false);
    assert.equal(validator.validate({ commands, editors: [] }, Filesystems.optionsSchema).valid, false);
    assert.equal(validator.validate({ editors: { text: { label: "Open", extensions: ["txt"] } } }, Filesystems.optionsSchema).valid, false);
    assert.equal(validator.validate({ editors: { text: { page: "/editor.js", label: "Open", extensions: [".txt"] } } }, Filesystems.optionsSchema).valid, false);
    for (const definition of [
        {},
        { implementation: "" },
        { implementation: "/providers/filesystem-mem.js", cache: true },
        { implementation: "/providers/filesystem-mem.js", cache: "yes" },
        { implementation: "/providers/filesystem-mem.js", cacheAnonymous: false },
        { implementation: "/providers/filesystem-mem.js", cacheMode: "path" },
        { implementation: "/providers/filesystem-mem.js", cacheMode: "identity" },
        { implementation: "/providers/filesystem-mem.js", options: null },
        { implementation: "/providers/filesystem-mem.js", options: [] },
        { implementation: "/providers/filesystem-mem.js", options: "invalid" },
        { implementation: "/providers/filesystem-mem.js", loader: "custom-js" },
        { implementation: "/providers/filesystem-mem.js", src: "/other.js" }
    ]) assert.equal(validator.validate({providers: {mem: definition}}, Filesystems.optionsSchema).valid, false);
});

test("filesystem implementations retain direct dependency/options construction", () => {
    // Construct every provider from options plus separate credentials, never a projected URL option.
    const services = new Proxy({}, {get() { throw new Error("Filesystem provider unexpectedly resolved a Service"); }});
    const handle = {kind: "directory"};
    const credentials = {token: "runtime-only"};
    const providers = [
        new Filesystem({isReadonly: true}),
        new FilesystemMem(services, {instance: "direct", isReadonly: true}, credentials),
        new FilesystemHttp(services, {scheme: "https", host: "example.test", path: "/files/", isReadonly: true}, credentials),
        new FilesystemOpfs(services, {isReadonly: true}, credentials),
        new FilesystemFile(services, {handle, isReadonly: true}, credentials)
    ];

    assert.deepEqual(providers.map(provider => provider.url), ["", "mem:direct", "https://example.test/files", "opfs:", "file:"]);
    assert.deepEqual(providers.map(provider => provider.isReadonly), [true, true, true, true, true]);
    assert.strictEqual(providers[4].handle, handle);
    for (const Implementation of [FilesystemMem, FilesystemHttp, FilesystemOpfs, FilesystemFile]) {
        assert.equal(typeof Implementation.optionsDefinition, "object");
        assert.equal(Array.isArray(Implementation.optionsDefinition), false);
        assert.equal(typeof Implementation.optionsDefinition.schema, "object");
        assert.equal(typeof Implementation.optionsDefinition.parseUrl, "function");
        assert.equal(typeof Implementation.optionsDefinition.getUrl, "function");
        assert.deepEqual(Object.keys(Implementation.optionsDefinition), ["schema", "parseUrl", "getUrl"]);
        assert.equal(Object.hasOwn(Implementation, "options"), false);
        assert.equal(Object.hasOwn(Implementation, "optionsSchema"), false);
        assert.equal(Object.hasOwn(Implementation, "parseUrl"), false);
        assert.equal(Object.hasOwn(Implementation, "getUrl"), false);
        assert.equal(Object.hasOwn(Implementation, "create"), false);
        assert.equal(Object.hasOwn(Implementation, "credentialsDefinition"), false);
    }
    assert.equal(FilesystemMem.getCacheKey("mem:"), null);
    assert.equal(FilesystemMem.getCacheKey("mem:workspace"), "mem:workspace");
    assert.equal(FilesystemHttp.getCacheKey, undefined);
});

test("FilesystemFile preserves public handle, navigation, file, delete, and readonly behavior", async () => {
    // Model the File System Access API through public provider operations without reaching private helpers.
    const filesystemError = name => Object.assign(new Error(name), {name});
    const createFileHandle = () => {
        let blob = new Blob([]);
        return {
            kind: "file",
            async getFile() {
                const file = blob.slice();
                Object.defineProperty(file, "lastModified", {value: 1});
                return file;
            },
            async createWritable({keepExistingData = false} = {}) {
                const chunks = keepExistingData ? [blob] : [];
                return {
                    async write(value) { chunks.push(value); },
                    async seek() {},
                    async close() { blob = new Blob(chunks); },
                    async abort() {}
                };
            }
        };
    };
    const createDirectoryHandle = () => {
        const children = new Map();
        return {
            kind: "directory",
            async getDirectoryHandle(name, {create = false} = {}) {
                const child = children.get(name);
                if (child?.kind === "directory") return child;
                if (child) throw filesystemError("TypeMismatchError");
                if (!create) throw filesystemError("NotFoundError");
                const directory = createDirectoryHandle();
                children.set(name, directory);
                return directory;
            },
            async getFileHandle(name, {create = false} = {}) {
                const child = children.get(name);
                if (child?.kind === "file") return child;
                if (child) throw filesystemError("TypeMismatchError");
                if (!create) throw filesystemError("NotFoundError");
                const file = createFileHandle();
                children.set(name, file);
                return file;
            },
            async removeEntry(name) {
                if (!children.delete(name)) throw filesystemError("NotFoundError");
            },
            async *entries() { yield* children.entries(); }
        };
    };

    const root = createDirectoryHandle();
    const filesystem = new FilesystemFile({}, {handle: root});
    await filesystem.createDirectory("/docs");
    await filesystem.saveFile("/docs/readme.txt", "hello");

    assert.equal(filesystem.url, "file:");
    assert.strictEqual(filesystem.handle, root);
    assert.deepEqual(await filesystem.getEntry("/docs/readme.txt"), {
        path: "/docs/readme.txt", name: "readme.txt", type: "file", created: null, modified: new Date(1), length: 5, etag: "", flags: 0
    });
    const entries = [];
    for await (const entry of filesystem.getEntries("/", {mode: "descendants"})) entries.push(entry.path);
    assert.deepEqual(entries, ["/docs", "/docs/readme.txt"]);
    assert.equal(await new Response(await filesystem.loadReadStream("/docs/readme.txt")).text(), "hello");

    await filesystem.delete("/docs/readme.txt");
    assert.equal(await filesystem.getEntry("/docs/readme.txt"), null);
    await filesystem.delete("/docs/readme.txt");

    const replacement = createDirectoryHandle();
    filesystem.setDirectoryHandle(replacement);
    assert.strictEqual(filesystem.handle, replacement);
    const readonly = new FilesystemFile({}, {handle: root, isReadonly: true});
    await assert.rejects(() => readonly.saveFile("/blocked.txt", "blocked"), /filesystem is readonly/);
});

test("filesystem provider schemas describe declarative options and exclude runtime URL state", () => {
    // Keep the schemas suitable for generated forms without admitting canonical URLs or local handles.
    const validator = new JsonValidator();
    for (const Implementation of [FilesystemMem, FilesystemOpfs, FilesystemFile]) {
        assert.equal(validator.validate({}, Implementation.optionsDefinition.schema).valid, true);
        assert.equal(validator.validate({isReadonly: true}, Implementation.optionsDefinition.schema).valid, true);
        assert.equal(Implementation.optionsDefinition.schema.properties.isReadonly.default, false);
        assert.equal(validator.validate({url: "runtime:"}, Implementation.optionsDefinition.schema).valid, false);
    }
    assert.equal(FilesystemMem.optionsDefinition.schema.properties.instance.default, null);
    assert.equal(validator.validate({instance: null}, FilesystemMem.optionsDefinition.schema).valid, true);
    assert.equal(validator.validate({instance: "nameOfTheInstance"}, FilesystemMem.optionsDefinition.schema).valid, true);
    assert.equal(validator.validate({instance: ""}, FilesystemMem.optionsDefinition.schema).valid, false);
    assert.equal(validator.validate({instance: 1}, FilesystemMem.optionsDefinition.schema).valid, false);
    assert.equal(validator.validate({scheme: "https", host: "example.test", path: "/files", isReadonly: true}, FilesystemHttp.optionsDefinition.schema).valid, true);
    assert.equal(validator.validate({scheme: "ftp", host: "example.test", path: "/files"}, FilesystemHttp.optionsDefinition.schema).valid, false);
    assert.equal(validator.validate({path: "/files"}, FilesystemHttp.optionsDefinition.schema).valid, false);
    assert.equal(validator.validate({scheme: "https", host: "example.test", url: "https://example.test/"}, FilesystemHttp.optionsDefinition.schema).valid, false);
    assert.equal(validator.validate({handle: {kind: "directory"}}, FilesystemFile.optionsDefinition.schema).valid, false);
});

test("filesystem providers parse and canonically project their URL-represented configuration", () => {
    // Exercise provider round trips independently from Filesystems orchestration.
    const validator = new JsonValidator();
    const anonymous = FilesystemMem.optionsDefinition.parseUrl(FilesystemMem.optionsDefinition.getUrl({instance: null}));
    const named = FilesystemMem.optionsDefinition.parseUrl(FilesystemMem.optionsDefinition.getUrl({instance: "nameOfTheInstance", isReadonly: true}));
    assert.deepEqual(anonymous, {instance: null});
    assert.deepEqual(named, {instance: "nameOfTheInstance"});
    assert.equal(Object.hasOwn(anonymous, "options"), false);
    assert.equal(Object.hasOwn(anonymous, "name"), false);

    for (const Implementation of [FilesystemMem, FilesystemHttp, FilesystemOpfs, FilesystemFile]) {
        assert.equal(Implementation.optionsDefinition.parseUrl.length, 1);
        assert.equal(Implementation.optionsDefinition.getUrl.length, 1);
    }

    for (const [raw, canonical, expectedOptions] of [
        ["http://example.test:8080/files/", "http://example.test:8080/files", {scheme: "http", host: "example.test:8080", path: "/files"}],
        ["https://example.test/", "https://example.test/", {scheme: "https", host: "example.test", path: "/"}]
    ]) {
        const parsed = FilesystemHttp.optionsDefinition.parseUrl(raw);
        assert.deepEqual(parsed, expectedOptions);
        assert.equal(Object.hasOwn(parsed, "options"), false);
        assert.equal(Object.hasOwn(parsed, "name"), false);
        assert.equal(validator.validate(parsed, FilesystemHttp.optionsDefinition.schema).valid, true);
        assert.equal(FilesystemHttp.optionsDefinition.getUrl(parsed), canonical);
        assert.deepEqual(FilesystemHttp.optionsDefinition.parseUrl(canonical), parsed);
    }

    for (const [Implementation, input, canonical] of [
        [FilesystemOpfs, "opfs", "opfs:"],
        [FilesystemFile, "file", "file:"]
    ]) {
        const parsed = Implementation.optionsDefinition.parseUrl(input);
        assert.deepEqual(parsed, {});
        assert.equal(Object.hasOwn(parsed, "options"), false);
        assert.equal(Object.hasOwn(parsed, "name"), false);
        assert.equal(validator.validate(parsed, Implementation.optionsDefinition.schema).valid, true);
        assert.equal(Implementation.optionsDefinition.getUrl(parsed), canonical);
        assert.deepEqual(Implementation.optionsDefinition.parseUrl(canonical), parsed);
    }
});

test("HTTP opening overlays URL fields on provider defaults without encoding readonly state", async () => {
    // Keep URL-represented host and path authoritative while retaining non-URL provider configuration.
    const providerUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-http.js", import.meta.url).href;
    const defaults = {scheme: "http", host: "configured.test", path: "/configured", isReadonly: true};
    const {filesystems} = createRuntime({https: {implementation: providerUrl, options: defaults}});

    const filesystem = await filesystems.open("https://example.test:8443/files/");

    assert.equal(filesystem.url, "https://example.test:8443/files");
    assert.equal(filesystem.isReadonly, true);
    assert.deepEqual(defaults, {scheme: "http", host: "configured.test", path: "/configured", isReadonly: true});

    let credentialUrlError;
    try {
        await filesystems.open("https://private-user:private-password@example.test/files");
    } catch (error) {
        credentialUrlError = error;
    }
    assert.match(credentialUrlError?.message ?? "", /must not contain credentials/);
    assert.doesNotMatch(credentialUrlError.message, /private-user|private-password/);
});

test("direct filesystem construction validates structured provider options", () => {
    // Keep provider-specific runtime invariants independent from domain materialization.
    assert.throws(() => new FilesystemHttp({}, {}), /Unsupported HTTP filesystem scheme/);
    assert.throws(() => new FilesystemHttp({}, {scheme: "file", host: "example.test", path: "/"}), /Unsupported HTTP filesystem scheme/);
    for (const url of ["https://user@example.test/files", "https://example.test/files?view=all", "https://example.test/files#entry"]) {
        assert.throws(() => FilesystemHttp.optionsDefinition.parseUrl(url), /must not contain credentials, query or fragment/);
    }
    assert.throws(() => FilesystemHttp.optionsDefinition.getUrl({scheme: "https", host: "user@example.test", path: "/"}), /Invalid HTTP filesystem host/);
    assert.throws(() => FilesystemHttp.optionsDefinition.getUrl({scheme: "https", host: "example.test", path: "relative"}), /path must start/);
    assert.throws(() => FilesystemHttp.optionsDefinition.getUrl({scheme: "ftp", host: "example.test", path: "/"}), /Unsupported HTTP filesystem scheme/);
    assert.throws(() => FilesystemMem.optionsDefinition.parseUrl("mem:invalid identity"), /Unsupported memory filesystem URL/);
    assert.throws(() => new FilesystemMem({}, {instance: "invalid identity"}), /instance must be a non-empty string or null/);
    assert.throws(() => FilesystemOpfs.optionsDefinition.parseUrl("opfs:demo"), /Unsupported OPFS filesystem URL: opfs:demo/);
    assert.throws(() => FilesystemFile.optionsDefinition.parseUrl("file:demo"), /Unsupported local filesystem URL: file:demo/);
});

test("x-filesystem manifest uses the providers directory for instance implementations", () => {
    // Keep authored provider implementations separate from Services and give HTTP variants their scheme defaults.
    const manifest = readFileSync(new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/manifest.jsonc", import.meta.url), "utf8");
    assert.match(manifest, /"implementation"\s*:\s*"\/providers\/filesystem-mem\.js"/);
    assert.match(manifest, /"implementation"\s*:\s*"\/providers\/filesystem-http\.js"/);
    assert.match(manifest, /"http"\s*:\s*\{[^\r\n]*"options"\s*:\s*\{\s*"scheme"\s*:\s*"http"\s*\}/);
    assert.match(manifest, /"https"\s*:\s*\{[^\r\n]*"options"\s*:\s*\{\s*"scheme"\s*:\s*"https"\s*\}/);
    assert.doesNotMatch(manifest, /"implementation"\s*:\s*"\/js\/filesystem-/);
});

test("Filesystems exposes defensive command and editor snapshots", () => {
    // Verify editor definitions remain independent from explicit filesystem Commands.
    const jsonValidator = new JsonValidator();
    const filesystems = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {commands, editors});
    const commandSnapshot = filesystems.commands;
    const editorSnapshot = filesystems.editors;
    commandSnapshot.push({ id: "page:editor", label: "Open", type: "file", extensions: ["txt"], actions: ["open"] });
    editorSnapshot.text.page = "/changed.js";
    editorSnapshot.extra = editorSnapshot.text;

    assert.deepEqual(filesystems.commands, commands);
    assert.deepEqual(filesystems.editors, editors);
    assert.equal(filesystems.commands.some(command => command.id.startsWith("page:")), false);
});

test("getEditor selects simple and compound extensions deterministically", () => {
    // Prefer the longest extension and stable editor ID without accepting arbitrary suffixes.
    const configuredEditors = structuredClone(editors);
    configuredEditors.fallback = { page: "/fallback.js", label: "Open", extensions: ["aes", "txt"] };
    configuredEditors.alternate = { page: "/alternate.js", label: "Open", extensions: ["pdf"] };
    const jsonValidator = new JsonValidator();
    const filesystems = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {editors: configuredEditors});

    assert.equal(filesystems.getEditor("/notes/readme.txt").page, "/fallback.js");
    assert.equal(filesystems.getEditor("/notes/secret.TXT.AES").page, editors.text.page);
    assert.equal(filesystems.getEditor("/images/photo.png.aes").page, editors.image.page);
    assert.equal(filesystems.getEditor("/documents/report.pdf").page, "/alternate.js");
    assert.equal(filesystems.getEditor("/documents/report.notpdf"), null);
    assert.equal(filesystems.getEditor("/documents/pdf"), null);

    const selected = filesystems.getEditor("/notes/secret.txt.aes");
    selected.page = "/changed.js";
    assert.equal(filesystems.getEditor("/notes/secret.txt.aes").page, editors.text.page);
});

test("filesystem opening uses editors for files and navigation for directories", () => {
    // Preserve stack Page parameters for files and directory history for folders.
    const { state, controller, navigationCalls } = createController();
    controller.open([{ type: "file", path: "/notes/readme.txt" }]);
    assert.deepEqual(navigationCalls, [{
        href: editors.text.page,
        page: { id: "filesystem-page" },
        params: { src: "mem:", path: "/notes/readme.txt" },
        open: "stack"
    }]);

    controller.open([{ type: "directory", path: "/notes" }]);
    assert.equal(state.pathList, "/notes");
    assert.deepEqual(state.history, ["/", "/notes"]);
    assert.equal(navigationCalls.length, 1);
});

test("filesystem component opens its source through the Filesystems Service", async () => {
    // Ensure the Component passes the provider URL without constructing a Loader resource reference.
    const { state, controller, filesystemOpenCalls, eventHandlers } = createController();
    await controller.load();
    await eventHandlers["change:src"]({});
    assert.deepEqual(filesystemOpenCalls, ["mem:"]);
    assert.deepEqual(state.filesystem, {url: "mem:"});
});

test("context-menu Open is independent from explicit Commands and is not duplicated", () => {
    // Populate one editor action plus matching explicit Commands, then exercise both execution paths.
    const { state, controller, navigationCalls, contextMenuCalls } = createController();
    const entry = { type: "file", path: "/notes/readme.txt" };
    controller.onContextMenuEntry({ event: { detail: { entry, entries: [entry], x: 10, y: 20 } } });

    assert.equal(state.editor.page, editors.text.page);
    assert.deepEqual(state.commands.map(command => command.id), commands.map(command => command.id));
    assert.deepEqual(contextMenuCalls, [{ x: 10, y: 20 }]);
    assert.equal((filesystemDefinition.template.match(/command="open"/g) ?? []).length, 1);

    controller.onCommand({ event: { detail: { command: "open" }, target: {} } });
    assert.equal(navigationCalls.length, 1);
    assert.equal(navigationCalls[0].href, editors.text.page);

    controller.onCommand({ event: { detail: { command: "customCommand" }, target: { dataset: { command: commands[0].id } } } });
    assert.equal(navigationCalls.length, 2);
    assert.equal(navigationCalls[1].href, "page:x:/pages/invoke.js");
    assert.equal(navigationCalls[1].params.id, commands[0].id);
});
