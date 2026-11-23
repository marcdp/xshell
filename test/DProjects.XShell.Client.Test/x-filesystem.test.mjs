import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import FilesystemsContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/contracts/filesystems.json" with { type: "json" };
import filesystemDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/components/x-filesystem.js";
import Filesystem from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem.js";
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
    return { config, resolver, loader, serviceScope, filesystems: new Filesystems({config, jsonValidator, services: serviceScope}, {providers}) };
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

test("Filesystems.open resolves and imports providers locally", async () => {
    // Prove authored options are cloned, validated before URL composition, and passed to direct construction.
    const implementation = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
        static optionsSchema = {type: "object", properties: {tag: {type: "string"}, url: {type: "string"}}, additionalProperties: false};
        constructor(services, options) { this.options = structuredClone(options); options.tag = "provider mutation"; }
    }`);
    const providerOptions = {tag: "configured", url: "authored:override"};
    const jsonValidator = new JsonValidator();
    const filesystems = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {
        providers: {test: {implementation, options: providerOptions}}
    });
    providerOptions.tag = "changed";

    const instance = await filesystems.open("test:demo");
    const second = await filesystems.open("test:demo");
    assert.deepEqual(instance.options, {tag: "configured", url: "test:demo"});
    assert.notStrictEqual(instance, second);
    assert.deepEqual(providerOptions, {tag: "changed", url: "authored:override"});
    for (const value of [null, undefined, "", "   ", 0, false, {}, []]) {
        await assert.rejects(() => filesystems.open(value), { name: "TypeError", message: "Filesystem URL must be a non-empty string." });
    }
    await assert.rejects(() => filesystems.open("unknown:missing"), /Filesystem provider not found: unknown:missing/);
});

test("Filesystems contract exposes open as the canonical provider operation", () => {
    // Validate the renamed public method through the shared Service contract vocabulary.
    const result = new JsonValidator().validate(FilesystemsContract, ContractSchema);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(Object.keys(FilesystemsContract.methods), ["open", "getEditor"]);
});

test("Filesystems.open preserves local provider memory identity semantics without Loader materialization", async t => {
    // Exercise scheme dispatch, direct import, validation, construction, and the domain-owned cache.
    const providerUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-mem.js", import.meta.url).href;
    const {resolver, loader, filesystems} = createRuntime({
        mem: {implementation: providerUrl}
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

test("Filesystems adds the provider URL after options validation", async () => {
    // Verify direct materialization passes the domain URL without exposing Loader selection in configuration.
    const providerUrl = new URL("./fixtures/filesystem-provider.mjs?case=context", import.meta.url).href;
    const provider = await import(providerUrl);
    provider.reset();
    const {filesystems, loader} = createRuntime({test: {implementation: providerUrl, options: {tag: "configured"}}});

    await filesystems.open("test:demo");

    assert.deepEqual(loader.registry, []);
    assert.deepEqual(provider.getCalls().map(call => call.url), ["test:demo"]);
    assert.deepEqual(provider.getCalls().map(call => call.options), [{tag: "configured", url: "test:demo"}]);
});

test("Filesystems requires valid schemas and resolves provider dependencies lazily", async () => {
    // Reject schema and option failures before construction, then expose only requested Services plus the owning context.
    for (const [schemaSource, expected] of [
        ["", /must define a static optionsSchema object/],
        ["static optionsSchema = [];", /invalid static optionsSchema.*expected a JSON Schema object/],
        ["static optionsSchema = {type: 'object', patternProperties: {'[': {type: 'string'}}};", /invalid static optionsSchema/]
    ]) {
        globalThis.__filesystemConstructions = 0;
        const implementation = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
            ${schemaSource} constructor() { globalThis.__filesystemConstructions++; }
        }`);
        const jsonValidator = new JsonValidator();
        const filesystems = new Filesystems({config: testConfig, jsonValidator, services: createServices({jsonValidator})}, {
            providers: {test: {implementation}}
        });
        await assert.rejects(() => filesystems.open("test:demo"), expected);
        assert.equal(globalThis.__filesystemConstructions, 0);
    }

    const implementation = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
        static optionsSchema = {type: "object", properties: {timeout: {type: "integer"}}, additionalProperties: false};
        constructor({secrets, services}, options) { this.secrets = secrets; this.services = services; this.options = options; }
    }`);
    const jsonValidator = new JsonValidator();
    const serviceScope = createServices({jsonValidator, secrets: {credential: "work"}, unused: {}});
    const filesystems = new Filesystems({config: testConfig, jsonValidator, services: serviceScope}, {
        providers: {test: {implementation, options: {timeout: 30}}}
    });
    const instance = await filesystems.open("test:demo");
    assert.deepEqual(instance.secrets, {credential: "work"});
    assert.strictEqual(instance.services, serviceScope);
    assert.deepEqual(serviceScope.resolved, ["secrets"]);
    delete globalThis.__filesystemConstructions;
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
            static optionsSchema = {type: "object", additionalProperties: false};
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
    // Preserve provider constructor defaults, runtime-only options, and the absence of factory methods.
    const services = new Proxy({}, {get() { throw new Error("Filesystem provider unexpectedly resolved a Service"); }});
    const handle = {kind: "directory"};
    const providers = [
        new Filesystem({}, {url: "test:", isReadonly: true}),
        new FilesystemMem(services, {url: "mem:direct", isReadonly: true}),
        new FilesystemHttp(services, {url: new URL("https://example.test/files/"), isReadonly: true}),
        new FilesystemOpfs(services, {url: "opfs:", isReadonly: true}),
        new FilesystemFile(services, {url: "file:", handle, isReadonly: true})
    ];

    assert.deepEqual(providers.map(provider => provider.url), ["test:", "mem://", "https://example.test/files", "opfs:", "file:"]);
    assert.deepEqual(providers.map(provider => provider.isReadonly), [true, true, true, true, true]);
    assert.strictEqual(providers[4].handle, handle);
    for (const Implementation of [FilesystemMem, FilesystemHttp, FilesystemOpfs, FilesystemFile]) {
        assert.deepEqual(Implementation.optionsSchema, {type: "object", additionalProperties: false});
        assert.equal(Object.hasOwn(Implementation, "create"), false);
    }
    assert.equal(FilesystemMem.getCacheKey("mem:"), null);
    assert.equal(FilesystemMem.getCacheKey("mem:workspace"), "mem:workspace");
    assert.equal(FilesystemHttp.getCacheKey, undefined);
});

test("direct filesystem construction preserves provider URL validation", () => {
    // Keep provider-specific runtime invariants independent from domain materialization.
    assert.throws(() => new FilesystemHttp("https://example.test/files"), /baseUrl must be a URL or string/);
    assert.throws(() => new FilesystemHttp({}, {url: "file:///tmp"}), /requires an HTTP or HTTPS URL/);
    for (const url of ["https://user@example.test/files", "https://example.test/files?view=all", "https://example.test/files#entry"]) {
        assert.throws(() => new FilesystemHttp({}, {url}), /must not contain credentials, query or fragment/);
    }
    assert.throws(() => new FilesystemOpfs({}, {url: "opfs:demo"}), /Unsupported OPFS filesystem URL: opfs:demo/);
    assert.throws(() => new FilesystemFile({}, {url: "file:demo"}), /Unsupported local filesystem URL: file:demo/);
});

test("x-filesystem manifest uses the providers directory for instance implementations", () => {
    // Keep authored provider implementations separate from registered Services.
    const manifest = readFileSync(new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/manifest.jsonc", import.meta.url), "utf8");
    assert.match(manifest, /"implementation"\s*:\s*"\/providers\/filesystem-mem\.js"/);
    assert.match(manifest, /"implementation"\s*:\s*"\/providers\/filesystem-http\.js"/);
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
