import assert from "node:assert/strict";
import test from "node:test";

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
    // Create every filesystem provider through the object-based factory contract.
    const services = {};
    const providers = [
        FilesystemMem.create({url: "mem", services}),
        FilesystemHttp.create({url: "https://example.test/files", services}),
        FilesystemOpfs.create({url: "opfs", services}),
        FilesystemFile.create({url: "file", services})
    ];

    assert.deepEqual(providers.map(provider => provider.url), ["mem://", "https://example.test/files", "opfs:", "file:"]);
});
