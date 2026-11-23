import assert from "node:assert/strict";
import test from "node:test";

import Filesystem from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem.js";
import FilesystemFile from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-file.js";
import FilesystemHttp from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-http.js";
import FilesystemMem from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-mem.js";
import FilesystemOpfs from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-opfs.js";
import MemoryStore from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/providers/store-mem.js";
import LoaderInstanceJs from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/instance-js.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";

test("instance-js directly constructs the implementation with lazy services and final options", async () => {
    // Destructure one dependency while proving the constructor receives exactly the normalized two arguments.
    const jsonValidator = new JsonValidator();
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
    const implementationUrl = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
        static optionsSchema = {
            type: "object",
            properties: { timeout: { type: "integer", minimum: 0 } },
            additionalProperties: false
        };
        constructor({ jsonValidator }, options) {
            this.argumentCount = arguments.length;
            this.options = options;
            this.jsonValidator = jsonValidator;
        }
    }`);

    const authoredOptions = {timeout: 30};
    const Implementation = (await import(implementationUrl)).default;
    const originalSchema = structuredClone(Implementation.optionsSchema);
    const instance = await new LoaderInstanceJs().load(implementationUrl, {
        resource: "store:mem:demo", resourceDefinition: {options: authoredOptions}, services: runtimeServices
    });

    assert.equal(instance.argumentCount, 2);
    assert.deepEqual(instance.options, {timeout: 30, url: "mem:demo"});
    assert.notStrictEqual(instance.options, authoredOptions);
    assert.strictEqual(instance.jsonValidator, jsonValidator);
    assert.deepEqual(serviceReads, ["jsonValidator", "jsonValidator"]);
    assert.deepEqual(Implementation.optionsSchema, originalSchema);
});

test("instance-js supplies an empty validated options object when configuration omits it", async () => {
    // Add the resource-derived URL after validating the missing authored configuration as an empty object.
    const implementationUrl = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor(services, options) { this.options = options; }
    }`);
    const instance = await new LoaderInstanceJs().load(implementationUrl, {
        resource: "test:empty", resourceDefinition: {}, services: {jsonValidator: new JsonValidator()}
    });

    assert.deepEqual(instance.options, {url: "empty"});
});

test("instance-js rejects missing and invalid implementation option schemas before construction", async () => {
    // Reject absent, non-object, throwing, and malformed schemas without invoking the constructor.
    const cases = [
        ["", /must define a static optionsSchema object/],
        ["static optionsSchema = [];", /invalid static optionsSchema.*expected a JSON Schema object/],
        ["static get optionsSchema() { throw new Error('schema failed'); }", /invalid static optionsSchema: schema failed/],
        ["static optionsSchema = { type: 'object', patternProperties: { '[': { type: 'string' } } };", /invalid static optionsSchema/]
    ];
    for (const [schemaSource, expected] of cases) {
        globalThis.__instanceConstructions = 0;
        const implementationUrl = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
            ${schemaSource}
            constructor() { globalThis.__instanceConstructions++; }
        }`);
        await assert.rejects(() => new LoaderInstanceJs().load(implementationUrl, {
            resource: "test:invalid-schema", resourceDefinition: {}, services: {jsonValidator: new JsonValidator()}
        }), expected);
        assert.equal(globalThis.__instanceConstructions, 0);
    }
    delete globalThis.__instanceConstructions;
});

test("instance-js validates a cloned provider options snapshot before construction", async () => {
    // Reject invalid and unknown fields, then prove provider mutation cannot reach authored configuration.
    const implementationUrl = "data:text/javascript," + encodeURIComponent(`export default class Implementation {
        static optionsSchema = {
            type: "object",
            required: ["timeout"],
            properties: { timeout: { type: "integer", minimum: 0 }, url: { type: "string" } },
            additionalProperties: false
        };
        constructor(services, options) {
            globalThis.__instanceConstructions++;
            this.received = structuredClone(options);
            options.timeout = 99;
        }
    }`);
    const loader = new LoaderInstanceJs();
    const services = {jsonValidator: new JsonValidator()};
    globalThis.__instanceConstructions = 0;
    for (const [options, expected] of [
        [{timeout: "fast"}, /Invalid provider options for 'test:invalid'.*#\/timeout/],
        [{timeout: 30, unknown: true}, /Invalid provider options for 'test:invalid'.*additional properties schema/]
    ]) {
        const original = structuredClone(options);
        await assert.rejects(() => loader.load(implementationUrl, {resource: "test:invalid", resourceDefinition: {options}, services}), expected);
        assert.deepEqual(options, original);
    }
    assert.equal(globalThis.__instanceConstructions, 0);

    const authoredOptions = {timeout: 30, url: "authored:override"};
    const instance = await loader.load(implementationUrl, {
        resource: "test:valid", resourceDefinition: {options: authoredOptions}, services
    });
    assert.deepEqual(instance.received, {timeout: 30, url: "valid"});
    assert.deepEqual(authoredOptions, {timeout: 30, url: "authored:override"});
    assert.equal(globalThis.__instanceConstructions, 1);
    delete globalThis.__instanceConstructions;
});

test("filesystem implementations construct directly without resolving unused services", () => {
    // Construct every filesystem implementation through the shared dependency/options convention.
    const services = new Proxy({}, { get() { throw new Error("Filesystem provider unexpectedly resolved a Service"); } });
    const providers = [
        new FilesystemMem(services, {url: "mem"}),
        new FilesystemHttp(services, {url: "https://example.test/files"}),
        new FilesystemOpfs(services, {url: "opfs"}),
        new FilesystemFile(services, {url: "file"})
    ];

    assert.deepEqual(providers.map(provider => provider.url), ["mem://", "https://example.test/files", "opfs:", "file:"]);
    assert.throws(() => new FilesystemFile(services, {url: "file:demo"}), /Unsupported local filesystem URL: file:demo/);
    for (const Implementation of [FilesystemMem, FilesystemHttp, FilesystemOpfs, FilesystemFile, MemoryStore]) {
        assert.deepEqual(Implementation.optionsSchema, {type: "object", additionalProperties: false});
        assert.equal(Object.hasOwn(Implementation, "create"), false);
    }
});

test("filesystem provider schemas reject unknown authored options", async () => {
    // Validate a real restrictive provider schema through the generic instance-js boundary.
    const providerUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/providers/filesystem-mem.js", import.meta.url).href;
    await assert.rejects(() => new LoaderInstanceJs().load(providerUrl, {
        resource: "filesystem:mem:", resourceDefinition: {options: {unknown: true}}, services: {jsonValidator: new JsonValidator()}
    }), /Invalid provider options for 'filesystem:mem:'.*additional properties schema/);
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
    // Keep constructor invariants aligned with instance-js construction.
    assert.throws(() => new FilesystemHttp("https://example.test/files"), /baseUrl must be a URL or string/);
    assert.throws(() => new FilesystemHttp({}, {url: "file:///tmp"}), /requires an HTTP or HTTPS URL/);
    for (const url of ["https://user@example.test/files", "https://example.test/files?view=all", "https://example.test/files#entry"]) {
        assert.throws(() => new FilesystemHttp({}, {url}), /must not contain credentials, query or fragment/);
    }
    assert.throws(() => new FilesystemOpfs({}, {url: "opfs:demo"}), /Unsupported OPFS filesystem URL: opfs:demo/);
    assert.throws(() => new FilesystemFile({}, {url: "file:demo"}), /Unsupported local filesystem URL: file:demo/);
});
