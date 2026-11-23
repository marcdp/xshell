import assert from "node:assert/strict";
import test from "node:test";

import Filesystem from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem.js";
import FilesystemFile from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem-file.js";
import FilesystemHttp from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem-http.js";
import FilesystemMem from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem-mem.js";
import FilesystemOpfs from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem-opfs.js";
import MemoryStore from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-store/js/store-mem.js";
import LoaderInstanceJs from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/instance-js.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";

test("instance-js delegates services to the Loader provider by property access", async () => {
    // Capture the complete factory context while exercising ordinary and symbol service reads.
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
    const providerUrl = "data:text/javascript," + encodeURIComponent(`export default class Provider {
        static optionsSchema = {
            type: "object",
            properties: { timeout: { type: "integer", minimum: 0 } },
            additionalProperties: false
        };
        static create(context) {
            return {
                contextKeys: Object.keys(context),
                url: context.url,
                options: context.options,
                jsonValidator: context.services.jsonValidator,
                symbolValue: context.services[Symbol.toStringTag]
            };
        }
    }`);

    const authoredOptions = {timeout: 30};
    const Provider = (await import(providerUrl)).default;
    const originalSchema = structuredClone(Provider.optionsSchema);
    const instance = await new LoaderInstanceJs().load(providerUrl, {
        resource: "store:mem:demo", resourceDefinition: {options: authoredOptions}, services: runtimeServices
    });

    assert.deepEqual(instance.contextKeys, ["url", "services", "options"]);
    assert.equal(instance.url, "mem:demo");
    assert.deepEqual(instance.options, authoredOptions);
    assert.notStrictEqual(instance.options, authoredOptions);
    assert.strictEqual(instance.jsonValidator, jsonValidator);
    assert.equal(instance.symbolValue, undefined);
    assert.deepEqual(serviceReads, ["jsonValidator", "jsonValidator"]);
    assert.deepEqual(Provider.optionsSchema, originalSchema);
});

test("instance-js supplies an empty validated options object when configuration omits it", async () => {
    // Preserve the three-field factory context even when a provider has no authored configuration.
    const providerUrl = "data:text/javascript," + encodeURIComponent(`export default class Provider {
        static optionsSchema = { type: "object", additionalProperties: false };
        static create({ options }) { return options; }
    }`);
    const instance = await new LoaderInstanceJs().load(providerUrl, {
        resource: "test:empty", resourceDefinition: {}, services: {jsonValidator: new JsonValidator()}
    });

    assert.deepEqual(instance, {});
});

test("instance-js rejects missing and invalid provider option schemas before construction", async () => {
    // Reject absent, non-object, throwing, and malformed schemas without calling create().
    const cases = [
        ["", /must define a static optionsSchema object/],
        ["static optionsSchema = [];", /invalid static optionsSchema.*expected a JSON Schema object/],
        ["static get optionsSchema() { throw new Error('schema failed'); }", /invalid static optionsSchema: schema failed/],
        ["static optionsSchema = { type: 'object', patternProperties: { '[': { type: 'string' } } };", /invalid static optionsSchema/]
    ];
    for (const [schemaSource, expected] of cases) {
        globalThis.__instanceProviderCreates = 0;
        const providerUrl = "data:text/javascript," + encodeURIComponent(`export default class Provider {
            ${schemaSource}
            static create() { globalThis.__instanceProviderCreates++; return {}; }
        }`);
        await assert.rejects(() => new LoaderInstanceJs().load(providerUrl, {
            resource: "test:invalid-schema", resourceDefinition: {}, services: {jsonValidator: new JsonValidator()}
        }), expected);
        assert.equal(globalThis.__instanceProviderCreates, 0);
    }
    delete globalThis.__instanceProviderCreates;
});

test("instance-js validates a cloned provider options snapshot before construction", async () => {
    // Reject invalid and unknown fields, then prove provider mutation cannot reach authored configuration.
    const providerUrl = "data:text/javascript," + encodeURIComponent(`export default class Provider {
        static optionsSchema = {
            type: "object",
            required: ["timeout"],
            properties: { timeout: { type: "integer", minimum: 0 } },
            additionalProperties: false
        };
        static create({ options }) {
            globalThis.__instanceProviderCreates++;
            const received = structuredClone(options);
            options.timeout = 99;
            return received;
        }
    }`);
    const loader = new LoaderInstanceJs();
    const services = {jsonValidator: new JsonValidator()};
    globalThis.__instanceProviderCreates = 0;
    for (const [options, expected] of [
        [{timeout: "fast"}, /Invalid provider options for 'test:invalid'.*#\/timeout/],
        [{timeout: 30, unknown: true}, /Invalid provider options for 'test:invalid'.*additional properties schema/]
    ]) {
        const original = structuredClone(options);
        await assert.rejects(() => loader.load(providerUrl, {resource: "test:invalid", resourceDefinition: {options}, services}), expected);
        assert.deepEqual(options, original);
    }
    assert.equal(globalThis.__instanceProviderCreates, 0);

    const authoredOptions = {timeout: 30};
    assert.deepEqual(await loader.load(providerUrl, {
        resource: "test:valid", resourceDefinition: {options: authoredOptions}, services
    }), authoredOptions);
    assert.deepEqual(authoredOptions, {timeout: 30});
    assert.equal(globalThis.__instanceProviderCreates, 1);
    delete globalThis.__instanceProviderCreates;
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
    for (const Provider of [FilesystemMem, FilesystemHttp, FilesystemOpfs, FilesystemFile, MemoryStore]) {
        assert.deepEqual(Provider.optionsSchema, {type: "object", additionalProperties: false});
    }
});

test("filesystem provider schemas reject unknown authored options", async () => {
    // Validate a real restrictive provider schema through the generic instance-js boundary.
    const providerUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem-mem.js", import.meta.url).href;
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
    // Keep constructor invariants aligned with static factory creation.
    assert.throws(() => new FilesystemHttp("https://example.test/files"), /baseUrl must be a URL or string/);
    assert.throws(() => new FilesystemHttp({}, {url: "file:///tmp"}), /requires an HTTP or HTTPS URL/);
    for (const url of ["https://user@example.test/files", "https://example.test/files?view=all", "https://example.test/files#entry"]) {
        assert.throws(() => new FilesystemHttp({}, {url}), /must not contain credentials, query or fragment/);
    }
    assert.throws(() => new FilesystemOpfs({}, {url: "opfs:demo"}), /Unsupported OPFS filesystem URL: opfs:demo/);
    assert.throws(() => new FilesystemFile({}, {url: "file:demo"}), /Unsupported local filesystem URL: file:demo/);
});
