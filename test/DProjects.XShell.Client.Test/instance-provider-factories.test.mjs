import assert from "node:assert/strict";
import test from "node:test";

import Filesystem from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem.js";
import FilesystemFile from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem-file.js";
import FilesystemHttp from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem-http.js";
import FilesystemMem from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem-mem.js";
import FilesystemOpfs from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem-opfs.js";
import LoaderInstanceJs from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/instance-js.js";

test("instance-js delegates services to the Loader provider by property access", async () => {
    // Capture the complete factory context while exercising ordinary and symbol service reads.
    const jsonValidator = {};
    const serviceReads = [];
    const runtimeServices = new Proxy(Object.create(null), {
        get(target, property) {
            serviceReads.push(property);
            if (property === "jsonValidator") return jsonValidator;
            if (property === "resolve") throw new Error("instance-js must not call context.services.resolve()");
            if (property === "services") return {beginScope() { throw new Error("instance-js must not create a Services scope"); }};
            throw new Error(`Unexpected service '${String(property)}'`);
        }
    });
    const providerUrl = "data:text/javascript," + encodeURIComponent(`export default class Provider {
        static create(context) {
            return {
                contextKeys: Object.keys(context),
                url: context.url,
                jsonValidator: context.services.jsonValidator,
                symbolValue: context.services[Symbol.toStringTag]
            };
        }
    }`);

    const instance = await new LoaderInstanceJs().load(providerUrl, {resource: "store:mem:demo", services: runtimeServices});

    assert.deepEqual(instance.contextKeys, ["url", "services"]);
    assert.equal(instance.url, "mem:demo");
    assert.strictEqual(instance.jsonValidator, jsonValidator);
    assert.equal(instance.symbolValue, undefined);
    assert.deepEqual(serviceReads, ["jsonValidator"]);
});

test("instance providers accept the shared factory context", () => {
    // Create every filesystem provider without resolving services they do not use.
    const services = new Proxy({}, { get() { throw new Error("Filesystem provider unexpectedly resolved a Service"); } });
    const providers = [
        FilesystemMem.create({url: "mem", services}),
        FilesystemHttp.create({url: "https://example.test/files", services}),
        FilesystemOpfs.create({url: "opfs", services}),
        FilesystemFile.create({url: "file", services})
    ];

    assert.deepEqual(providers.map(provider => provider.url), ["mem://", "https://example.test/files", "opfs:", "file:"]);
    assert.throws(() => FilesystemFile.create({url: "file:demo", services}), /Unsupported local filesystem URL: file:demo/);
});

test("filesystem constructors separate dependencies from provider options", () => {
    // Exercise the common direct-construction convention and provider-specific options.
    const handle = {kind: "directory"};
    const providers = [
        new Filesystem({}, {url: "test:", isReadonly: true}),
        new FilesystemMem({}, {url: "mem:direct", isReadonly: true}),
        new FilesystemHttp({}, {url: new URL("https://example.test/files/"), isReadonly: true}),
        new FilesystemOpfs({}, {url: "opfs:", isReadonly: true}),
        new FilesystemFile({}, {url: "file:", handle, isReadonly: true})
    ];

    assert.deepEqual(providers.map(provider => provider.url), ["test:", "mem://", "https://example.test/files", "opfs:", "file:"]);
    assert.deepEqual(providers.map(provider => provider.isReadonly), [true, true, true, true, true]);
    assert.strictEqual(providers[4].handle, handle);
});

test("direct filesystem construction preserves provider URL validation", () => {
    // Keep constructor invariants aligned with static factory creation.
    assert.throws(() => new FilesystemHttp("https://example.test/files"), /baseUrl must be a URL or string/);
    assert.throws(() => new FilesystemHttp({}, {url: "file:///tmp"}), /requires an HTTP or HTTPS URL/);
    for (const url of ["https://user@example.test/files", "https://example.test/files?view=all", "https://example.test/files#entry"]) {
        assert.throws(() => new FilesystemHttp({}, {url}), /must not contain credentials, query or fragment/);
    }
    assert.throws(() => new FilesystemOpfs({}, {url: "opfs:demo"}), /Unsupported OPFS filesystem URL: opfs:demo/);
    assert.throws(() => new FilesystemFile({}, {url: "file:demo"}), /Unsupported local filesystem URL: file:demo/);
});
