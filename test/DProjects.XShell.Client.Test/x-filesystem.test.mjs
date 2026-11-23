import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import FilesystemsContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/contracts/filesystems.json" with { type: "json" };
import filesystemDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/components/x-filesystem.js";
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

function createLoaderStub() {
    // Resolve exact test providers and capture the internal Loader handoff without involving the global Resolver.
    const calls = [];
    return {
        calls,
        _createResourcePatternResolver(appBaseUrl, providers) {
            return {
                resolve(url) {
                    const definition = providers[url];
                    if (!definition) return null;
                    const isAbsoluteUrl = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(definition.src);
                    return { definition, url: isAbsoluteUrl ? definition.src : new URL(definition.src.replace(/^\/+/, ""), appBaseUrl).href,
                        path: isAbsoluteUrl ? null : definition.src };
                }
            };
        },
        async _loadResolved(resource, resolved) {
            calls.push({ resource, resolved });
            if (!resolved) throw Object.assign(new Error(`Resource not found: ${resource}`), { code: "RESOURCE_NOT_FOUND" });
            return { resource };
        }
    };
}

function createRuntime(providers, services = {}) {
    // Build the real local provider matcher and Loader over a global Resolver with no Filesystem category.
    services = {jsonValidator: new JsonValidator(), ...services};
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
    return { config, resolver, loader, filesystems: new Filesystems({loader, config}, {providers}) };
}

function createController() {
    // Create a focused controller harness with real editor selection and captured navigation.
    const state = structuredClone(filesystemDefinition.state);
    state.src = "mem:";
    const navigationCalls = [];
    const contextMenuCalls = [];
    const filesystemOpenCalls = [];
    const loader = createLoaderStub();
    const filesystems = new Filesystems({ loader, config: testConfig }, {
        commands, editors, providers: { "mem:": { implementation: "/providers/filesystem-mem.js" } }
    });
    const open = filesystems.open.bind(filesystems);
    filesystems.open = async url => { filesystemOpenCalls.push(url); return open(url); };
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

test("Filesystems.open resolves locally and delegates the complete internal resource", async () => {
    // Preserve the provider definition while constructing exactly one internal Filesystem resource identity.
    const loader = createLoaderStub();
    const providerOptions = {credential: "work", transport: {timeout: 30000}};
    const filesystems = new Filesystems({loader, config: testConfig}, {
        providers: {"mem:demo": {implementation: "/providers/filesystem-mem.js", cache: true, options: providerOptions}}
    });
    providerOptions.credential = "changed";
    providerOptions.transport.timeout = 1;

    assert.deepEqual(await filesystems.open("mem:demo"), {resource: "filesystem:mem:demo"});
    assert.equal(loader.calls[0].resource, "filesystem:mem:demo");
    assert.deepEqual(loader.calls[0].resolved.definition, {
        src: "/providers/filesystem-mem.js", loader: "instance-js", cache: true,
        options: {credential: "work", transport: {timeout: 30000}}
    });
    assert.equal(loader.calls[0].resolved.url, "https://example.test/providers/filesystem-mem.js");
    for (const value of [null, undefined, "", "   ", 0, false, {}, []]) {
        await assert.rejects(() => filesystems.open(value), { name: "TypeError", message: "Filesystem URL must be a non-empty string." });
    }
    assert.equal(loader.calls.length, 1);
});

test("Filesystems contract exposes open as the canonical provider operation", () => {
    // Validate the renamed public method through the shared Service contract vocabulary.
    const result = new JsonValidator().validate(FilesystemsContract, ContractSchema);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(Object.keys(FilesystemsContract.methods), ["open", "getEditor"]);
});

test("Filesystems.open preserves local provider and Loader memory identity semantics", async t => {
    // Exercise the local matcher, Loader, instance-js adapter, and memory provider through the domain Service.
    const providerUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-mem.js", import.meta.url).href;
    const {resolver, loader, filesystems} = createRuntime({
        "mem:": {implementation: providerUrl},
        "mem:{identity}": {implementation: providerUrl, cache: true}
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
    assert.deepEqual(loader.registry.map(item => item.resource), [
        "filesystem:mem:", "filesystem:mem:", "filesystem:mem:demo", "filesystem:mem:other"
    ]);
    assert.equal(resolver.registry.some(item => item.resource.startsWith("filesystem:")), false);
    t.mock.method(console, "error", () => {});
    assert.equal(resolver.resolve("filesystem:mem:demo"), null);
    await assert.rejects(() => loader.load("filesystem:mem:demo"), { name: "ResourceError", code: "RESOURCE_NOT_FOUND" });
});

test("failed cached provider creation is evicted and retried", async () => {
    // Reuse Loader failure eviction for a locally resolved provider without adding a Filesystems cache.
    const providerUrl = new URL("./fixtures/filesystem-provider.mjs?case=retry", import.meta.url).href;
    const provider = await import(providerUrl);
    provider.reset();
    provider.failOnce();
    const {filesystems, loader} = createRuntime({"test:{identity}": {implementation: providerUrl, cache: true}});

    await assert.rejects(() => filesystems.open("test:demo"), /Simulated Filesystem provider failure/);
    const value = await filesystems.open("test:demo");

    assert.equal(value.number, 2);
    assert.deepEqual(provider.getCalls().map(call => call.url), ["test:demo", "test:demo"]);
    assert.deepEqual(loader.registry.map(item => item.status), ["error", "loaded"]);
});

test("concurrent cached opens share one in-flight provider materialization", async () => {
    // Preserve Loader promise sharing when provider resolution originates in Filesystems.
    const providerUrl = new URL("./fixtures/filesystem-provider.mjs?case=concurrent", import.meta.url).href;
    const provider = await import(providerUrl);
    provider.reset();
    const {filesystems, loader} = createRuntime({"test:{identity}": {implementation: providerUrl, cache: true}});

    const firstPromise = filesystems.open("test:demo");
    const secondPromise = filesystems.open("test:demo");
    await provider.waitForCallCount(1);
    assert.equal(provider.getCalls().length, 1);
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    assert.strictEqual(first, second);
    assert.equal(loader.registry.length, 1);
});

test("local providers preserve Loader path cache mode", async () => {
    // Share query variants through Loader while retaining the original internal resource in diagnostics.
    const providerUrl = new URL("./fixtures/filesystem-provider.mjs?case=path-cache", import.meta.url).href;
    const provider = await import(providerUrl);
    provider.reset();
    const {filesystems, loader} = createRuntime({
        "test:{identity}": {implementation: providerUrl, cache: true, cacheMode: "path"}
    });

    const first = await filesystems.open("test:demo?view=one");
    const second = await filesystems.open("test:demo?view=two");

    assert.strictEqual(first, second);
    assert.equal(loader.registry[0].resource, "filesystem:test:demo?view=one");
    assert.deepEqual(provider.getCalls().map(call => call.url), ["test:demo?view=one"]);
});

test("instance-js receives the provider URL from the internal resource identity", async () => {
    // Verify the fixed generic adapter receives the domain URL without exposing Loader selection in configuration.
    const providerUrl = new URL("./fixtures/filesystem-provider.mjs?case=context", import.meta.url).href;
    const provider = await import(providerUrl);
    provider.reset();
    const {filesystems, loader} = createRuntime({"test:{identity}": {implementation: providerUrl, options: {tag: "configured"}}});

    await filesystems.open("test:demo");

    assert.deepEqual(loader.registry.map(item => item.resource), ["filesystem:test:demo"]);
    assert.deepEqual(provider.getCalls().map(call => call.url), ["test:demo"]);
    assert.deepEqual(provider.getCalls().map(call => call.options), [{tag: "configured", url: "test:demo"}]);
});

test("Filesystems options validate commands, keyed editors, and closed provider definitions", () => {
    // Accept provider policy while rejecting incomplete, mistyped, or extended definitions.
    const validator = new JsonValidator();
    const providers = { "mem:{identity}": {
        implementation: "/providers/filesystem-mem.js", cache: true, cacheMode: "path", options: {credential: "work"}
    } };
    assert.equal(validator.validate({ commands, editors, providers }, Filesystems.optionsSchema).valid, true);
    assert.equal(validator.validate({ commands, editors: [] }, Filesystems.optionsSchema).valid, false);
    assert.equal(validator.validate({ editors: { text: { label: "Open", extensions: ["txt"] } } }, Filesystems.optionsSchema).valid, false);
    assert.equal(validator.validate({ editors: { text: { page: "/editor.js", label: "Open", extensions: [".txt"] } } }, Filesystems.optionsSchema).valid, false);
    for (const definition of [
        {},
        { implementation: "" },
        { implementation: "/providers/filesystem-mem.js", cache: "yes" },
        { implementation: "/providers/filesystem-mem.js", cacheMode: "identity" },
        { implementation: "/providers/filesystem-mem.js", options: null },
        { implementation: "/providers/filesystem-mem.js", options: [] },
        { implementation: "/providers/filesystem-mem.js", options: "invalid" },
        { implementation: "/providers/filesystem-mem.js", loader: "instance-js" },
        { implementation: "/providers/filesystem-mem.js", src: "/other.js" }
    ]) assert.equal(validator.validate({providers: {"mem:": definition}}, Filesystems.optionsSchema).valid, false);
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
    const filesystems = new Filesystems({ loader: createLoaderStub(), config: testConfig }, { commands, editors });
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
    const filesystems = new Filesystems({ loader: createLoaderStub(), config: testConfig }, { editors: configuredEditors });

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
    assert.deepEqual(state.filesystem, {resource: "filesystem:mem:"});
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
    assert.equal(navigationCalls[1].params.id, "filesystem.entry.encrypt.aes");
});
