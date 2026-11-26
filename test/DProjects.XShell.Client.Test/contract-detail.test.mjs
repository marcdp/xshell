import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import Detail from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/detail/contract-detail.js";
import Button from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-button.js";
import Workspace from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/workspace.js";
import Code from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-code.js";
import AreasContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/areas.json" with { type: "json" };
import NavigationContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/navigation.json" with { type: "json" };
import SchemaLoader from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/schema-json.js";
import Page from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/page.js";
import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/resolver.js";
import { deepFreeze } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/utils/object.js";

const detailUrl = "https://example.test/_assets/xshell-diagnostics/pages/detail/contract-detail.js";
const xAssets = "/_assets/x/0.9.0.dev";
const pageRule = { src: xAssets + "/{path}.js", loader: "page-js", moduleId: "x" };
const config = {
    app: { basePath: "", baseUrl: "https://example.test/" },
    xshell: { assets: { basePath: "/_assets" }, resolver: { page: { [pageRule.src]: pageRule, "x:/{path}.js": pageRule } } },
    modules: { x: { assets: { path: xAssets } } }
};
const template = '<x-button x-on:click="unexpected()"></x-button><script>unexpected()</script>';
const code = "throw new Error('Example code executed');";
const optionsSchema = { properties: { nested: { type: "array", items: { type: "object", required: ["value"] } } } };
const exampleContract = deepFreeze({
    label: "Example API", icon: "x-file", description: "Contract description",
    types: { options: { type: "object", schema: optionsSchema, description: "Named options." } },
    properties: {
        options: { ref: "options", required: true, readonly: true, label: "Options", description: "Current options.", default: null },
        mode: { type: "string", enum: ["", "brief"], default: "", readonly: false, attribute: true, reflect: false, state: true },
        enabled: { type: "boolean", default: false },
        count: { type: "integer", default: 0 },
        list: { type: "array", default: [], schema: false },
        object: { type: "object", default: {} },
        unset: { type: "string" }
    },
    methods: {
        write: {
            label: "Write", description: "Writes an entry.",
            parameters: [
                { name: "target", type: "string", required: true, enum: ["local", "remote"], description: "Destination." },
                { name: "options", ref: "options", default: {} }
            ],
            returns: { type: "string", format: "url", description: "Entry URL." }
        },
        reset: {}
    },
    events: {
        changed: { label: "Changed", description: "An entry changed.", detail: {
            current: { ref: "options", required: true, description: "Current entry." },
            previous: { type: "object", schema: optionsSchema }
        } }
    },
    slots: { "": { description: "Main content." }, extra: { description: "Extra content.", required: true } },
    examples: [
        { name: "template-only", description: "Markup sample.", template },
        { name: "code_only", code, language: "javascript" },
        { name: "both", template, code, language: "javascript", state: { count: 0, options: {} } }
    ]
});

function inspect(t, params, dependencies = {}) {
    // Reconstruct the controller from a Page URL without an originating listing.
    const url = new URL(detailUrl);
    url.search = new URLSearchParams(params);
    const bus = { emit: t.mock.fn() };
    const page = new Page({ src: url.href, bus });
    const state = structuredClone(Detail.state);
    Object.assign(state, Object.fromEntries(url.searchParams));
    const loader = { load: t.mock.fn(dependencies.load ?? (() => assert.fail("Unexpected resource load"))) };
    const resolver = dependencies.resolver ?? {
        has: () => true, resolve: () => ({ definition: { moduleId: dependencies.moduleId ?? "x" } })
    };
    t.mock.method(resolver, "resolve");
    const services = {
        getServiceInfo: t.mock.fn(id => dependencies.services?.[id]),
        resolve: t.mock.fn(() => assert.fail("Contract inspection must not resolve the Service"))
    };
    const contracts = {
        getContractById: t.mock.fn(id => Object.hasOwn(dependencies.contracts ?? {}, id) ? dependencies.contracts[id] : undefined),
        getContractItemById: t.mock.fn(() => ({ moduleId: "xshell" }))
    };
    const controller = Detail.controller({ state, page, loader, resolver, services, contracts, config });
    return { state, page, controller, loader, resolver, services, contracts, bus };
}

test.before(() => { globalThis.document = { baseURI: detailUrl }; });
test.after(() => { delete globalThis.document; });

function staticResource(t, kind, contract) {
    // The class exposes the same static metadata as the definition loaders.
    const construct = t.mock.fn(() => assert.fail("Contract inspection must not construct its target"));
    return class {
        static contract = kind === "page" ? undefined : contract;
        static definition = kind === "page" ? { contract } : undefined;
        constructor() { construct(); }
        static constructions = construct;
    };
}

function section(detail, title) {
    return detail.sections.find(section => section.title === title)?.entries;
}

for (const [kind, id, contract, reference] of [
    ["component", "x-button", Button.contract],
    ["page", xAssets + "/pages/workspace.js", Workspace.contract],
    ["page", "x:/pages/workspace.js", Workspace.contract],
    ["page", "/_assets/x/pages/workspace.js", Workspace.contract, "page:x:/pages/workspace.js"]
]) {
    test(`Contract Detail loads the ${kind} metadata for ${id} without constructing the resource`, async t => {
        const Resource = staticResource(t, kind, contract);
        const pageResolver = kind === "page" ? new Resolver({ config }) : undefined;
        const { controller, state, loader, resolver, page } = inspect(t, { kind, id }, { load: () => Resource, resolver: pageResolver });
        await controller.load();
        assert.equal(state.error, "");
        assert.equal(state.detail.id, id);
        assert.equal(state.detail.kind, kind);
        assert.equal(state.detail.moduleId, "x");
        assert.equal(state.detail.description, contract.description);
        assert.equal(page.label, contract.label || id);
        assert.equal(state.detail.examples.length, contract.examples.length);
        assert.deepEqual(loader.load.mock.calls[0].arguments, [reference ?? `${kind}:${id}`]);
        assert.deepEqual(resolver.resolve.mock.calls[0].arguments, [reference ?? `${kind}:${id}`]);
        assert.equal(Resource.constructions.mock.callCount(), 0);
        if (kind === "page") {
            const properties = section(state.detail, "Properties");
            const item = properties.find(property => property.name === "item");
            assert.ok(item.badges.includes("query"));
            assert.ok(item.badges.includes("reflect"));
            assert.ok(!properties.some(property => property.name === "src"));
        }
    });
}

test("Service inspection reads the registration and contract without resolving a live instance", async t => {
    const { controller, state, services, contracts, loader } = inspect(t, { kind: "service", id: "areas" }, {
        services: { areas: { contractId: "areas", moduleId: "xshell" } }, contracts: { areas: AreasContract }
    });
    await controller.load();
    assert.equal(state.error, "");
    assert.equal(state.detail.contractId, "areas");
    assert.equal(state.detail.moduleId, "xshell");
    assert.equal(state.detail.label, AreasContract.label);
    assert.deepEqual(contracts.getContractById.mock.calls[0].arguments, ["areas"]);
    assert.equal(services.resolve.mock.callCount(), 0);
    assert.equal(loader.load.mock.callCount(), 0);
});

test("Registered contract lookup is independent of Service registrations", async t => {
    const { controller, state, services, contracts } = inspect(t, { kind: "contract", id: "navigation" }, {
        contracts: { navigation: NavigationContract }
    });
    await controller.load();
    assert.equal(state.error, "");
    assert.equal(state.detail.label, "Navigation");
    assert.equal(state.detail.moduleId, "xshell");
    assert.deepEqual(contracts.getContractById.mock.calls[0].arguments, ["navigation"]);
    assert.equal(services.getServiceInfo.mock.callCount(), 0);
    assert.equal(services.resolve.mock.callCount(), 0);
});

test("The existing demo.operation Command loads and documents execute without using Commands or Tasks", async t => {
    // The loaders use browser globals even when their source and schemas are local.
    globalThis.CSSStyleSheet = class { replaceSync() {} };
    globalThis.HTMLElement = class {};
    globalThis.customElements = { define() {} };
    t.after(() => {
        delete globalThis.CSSStyleSheet;
        delete globalThis.HTMLElement;
        delete globalThis.customElements;
    });
    const { default: CommandLoader } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/command-js.js");
    const schemaUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/command.schema.json", import.meta.url);
    const schemaLoader = new SchemaLoader();
    t.mock.method(globalThis, "fetch", async url => new Response(await readFile(new URL(url)), { status: 200 }));
    const schema = await schemaLoader.load(schemaUrl.href);
    const commandContext = {
        resourceDefinition: {moduleId: "x-demo"},
        services: {loader: {async load(id) { assert.equal(id, "schema:command"); return schema; }}}
    };

    const src = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/commands/demo.operation.js", import.meta.url);
    const Command = await new CommandLoader().load(src.href, commandContext);
    const Resource = staticResource(t, "command", Command.contract);
    const { controller, state, loader, bus } = inspect(t, { kind: "command", id: "demo.operation" }, {
        moduleId: "x-demo", load: () => Resource
    });
    await controller.load();
    assert.equal(state.error, "");
    assert.equal(state.detail.label, "Demo operation");
    assert.equal(state.detail.moduleId, "x-demo");
    assert.deepEqual(loader.load.mock.calls[0].arguments, ["command:demo.operation"]);
    assert.equal(Resource.constructions.mock.callCount(), 0);
    assert.ok(bus.emit.mock.calls.every(call => call.arguments[0] === "xshell:page:change"));
    const [execute] = section(state.detail, "Methods");
    assert.equal(execute.name, "execute(steps, fail)");
    assert.deepEqual(execute.groups[0].fields[0].schema, { minimum: 1, maximum: 10 });
    assert.equal(execute.groups[0].fields[1].defaultText, "false");
    assert.equal(execute.groups[1].fields[0].type, "object");
});

test("The reference preserves descriptor metadata, declaration order, and copyable example source", async t => {
    const Resource = staticResource(t, "component", exampleContract);
    const { controller, state, page } = inspect(t, { kind: "component", id: "example" }, { load: () => Resource });
    await controller.load();
    const detail = state.detail;
    assert.deepEqual([detail.label, detail.icon, detail.description, detail.id, detail.kindLabel, page.label],
        ["Example API", "x-file", "Contract description", "example", "Component", "Example API"]);
    assert.deepEqual(detail.sections.map(section => section.title), ["Properties", "Methods", "Events", "Slots", "Types"]);
    const [options, mode, enabled, count, list, object, unset] = section(detail, "Properties");
    assert.equal(options.label, "Options");
    assert.equal(options.description, "Current options.");
    assert.equal(options.typeLabel, "options (object)");
    assert.equal(options.ref, "options");
    assert.deepEqual(options.badges, ["required", "Read-only"]);
    assert.equal(options.schema, optionsSchema);
    assert.deepEqual([options, mode, enabled, count, list, object].map(item => [item.hasDefault, item.defaultText]),
        [[true, "null"], [true, '""'], [true, "false"], [true, "0"], [true, "[]"], [true, "{}"]]);
    assert.equal(unset.hasDefault, false);
    assert.equal(mode.enumText, '"", "brief"');
    assert.deepEqual(mode.badges, ["Writable", "attribute", "reflect: false", "state"]);
    assert.equal(list.hasSchema, true);
    assert.equal(list.schema, false);

    const [write, reset] = section(detail, "Methods");
    assert.equal(write.name, "write(target, options)");
    assert.equal(write.label, "Write");
    assert.equal(reset.name, "reset()");
    assert.deepEqual(reset.groups, []);
    const [target, parameter] = write.groups[0].fields;
    assert.deepEqual([target.name, target.type, target.description, target.enumText, target.badges],
        ["target", "string", "Destination.", '"local", "remote"', ["required"]]);
    assert.equal(parameter.typeLabel, "options (object)");
    const [returns] = write.groups[1].fields;
    assert.deepEqual([returns.type, returns.description, returns.format], ["string", "Entry URL.", "url"]);
    const [changed] = section(detail, "Events");
    assert.equal(changed.label, "Changed");
    const [current, previous] = changed.groups[0].fields;
    assert.deepEqual([current.name, current.typeLabel, current.required, current.description],
        ["current", "options (object)", true, "Current entry."]);
    assert.equal(previous.schema, optionsSchema);
    assert.deepEqual(section(detail, "Slots").map(slot => [slot.name, slot.description, slot.badges[0]]),
        [["Default slot", "Main content.", undefined], ["extra", "Extra content.", "required"]]);
    const [type] = section(detail, "Types");
    assert.deepEqual([type.name, type.type, type.description, type.schema], ["options", "object", "Named options.", optionsSchema]);

    const [markup, script, both] = detail.examples;
    assert.deepEqual([markup.title, markup.template, markup.code, markup.hasState], ["Template only", template, undefined, false]);
    assert.deepEqual([script.title, script.template, script.code, script.language], ["Code only", undefined, code, "javascript"]);
    assert.deepEqual([both.template, both.code, both.hasState, both.state], [template, code, true, { count: 0, options: {} }]);
    assert.match(Detail.template, /<x-code[^>]+x-prop:value="example\.template"/);
    assert.match(Detail.template, /<x-code[^>]+x-prop:value="example\.code"/);
    assert.match(Code.template, /<code x-html="state\.highlighted"><\/code>/);
    assert.equal(Code.contract.properties.copyable.default, true);
    assert.equal(exampleContract.properties.options.type, undefined);
});

test("Duplicate authored example names still receive independent stable identities", () => {
    const state = structuredClone(Detail.state);
    const controller = Detail.controller({ state });
    state.detail = controller.describeContract("component", "duplicates", { contract: { examples: [
        { name: "same", template: "<p>First</p>", state: { value: 1 } },
        { name: "same", template: "<p>Second</p>", state: { value: 2 } }
    ] } });
    const [first, second] = state.detail.examples;
    assert.notEqual(first.exampleId, second.exampleId);
    assert.match(Detail.template, /x-for="example in state\.detail\.examples" x-key="exampleId"/);
});

test("Command execute uses the same named type, return, and example display without instantiation", async t => {
    const contract = deepFreeze({
        types: exampleContract.types,
        execute: { parameters: [{ name: "input", ref: "options" }], returns: { ref: "options", description: "Result." } },
        examples: exampleContract.examples
    });
    const Resource = staticResource(t, "command", contract);
    const { controller, state } = inspect(t, { kind: "command", id: "example" }, { load: () => Resource });
    await controller.load();
    const [execute] = section(state.detail, "Methods");
    assert.equal(execute.name, "execute(input)");
    assert.equal(execute.groups[1].fields[0].typeLabel, "options (object)");
    assert.equal(state.detail.examples[2].state.count, 0);
    assert.equal(Resource.constructions.mock.callCount(), 0);
});

const missing = () => { throw Object.assign(new Error("Resource not found"), { code: "RESOURCE_NOT_FOUND" }); };
for (const [name, query, dependencies, message] of [
    ["missing kind", { id: "example" }, {}, /Missing 'kind'/],
    ["invalid kind", { kind: "toString", id: "example" }, {}, /Unsupported contract kind 'toString'/],
    ["missing ID", { kind: "component", id: " " }, {}, /Missing 'id'/],
    ["unknown Component", { kind: "component", id: "missing" }, { load: missing }, /Component 'missing' was not found/],
    ["unknown Page", { kind: "page", id: "missing" }, { load: missing }, /Page 'missing' was not found/],
    ["unknown Command", { kind: "command", id: "missing" }, { load: missing }, /Command 'missing' was not found/],
    ["unknown Service", { kind: "service", id: "missing" }, {}, /Service 'missing' was not found/],
    ["unknown registry contract", { kind: "contract", id: "missing" }, {}, /Registered contract 'missing' was not found/],
    ["Service without a contract", { kind: "service", id: "bare" }, { services: { bare: {} } }, /has no registered contract/],
    ["missing Service contract", { kind: "service", id: "bare" }, { services: { bare: { contractId: "missing" } } }, /for service 'bare' was not found/],
    ["class without contract metadata", { kind: "page", id: "bare" }, { load: () => class {} }, /has no declared contract/],
    ["invalid contract metadata", { kind: "page", id: "bare" }, { load: () => class { static definition = { contract: [] }; } }, /invalid contract metadata/i],
    ["loading failure", { kind: "component", id: "broken" }, { load: () => { throw new Error("Import failed."); } }, /Could not load component 'broken'. Import failed/]
]) {
    test(`Contract Detail handles ${name}`, async t => {
        const { controller, state } = inspect(t, query, dependencies);
        await controller.load();
        assert.equal(state.detail, null);
        assert.match(state.error, message);
    });
}

test("Loader-created empty contract collections show an empty state", async t => {
    const Resource = staticResource(t, "page", { properties: {}, events: {}, methods: {}, slots: {} });
    const { controller, state } = inspect(t, { kind: "page", id: "bare" }, { load: () => Resource });
    await controller.load();
    assert.equal(state.error, "");
    assert.equal(state.detail.empty, true);
    assert.deepEqual(state.detail.sections, []);
    assert.deepEqual(state.detail.examples, []);
});

test("Pending metadata cannot overwrite the reference after a newer request or unload", async t => {
    const first = Promise.withResolvers();
    const second = Promise.withResolvers();
    const { page, controller, state, loader } = inspect(t, { kind: "component", id: "first" }, { load: () => first.promise });
    const pending = controller.load();
    assert.equal(state.detail, null);
    assert.equal(state.error, "");
    t.mock.getter(page, "query", () => ({ kind: "component", id: "second" }));
    loader.load.mock.mockImplementation(() => staticResource(t, "component", { label: "Second request" }));
    await controller.load();
    first.reject(new Error("The first request failed"));
    await pending;
    assert.equal(state.detail.label, "Second request");
    assert.equal(state.error, "");

    loader.load.mock.mockImplementation(() => second.promise);
    const unloaded = controller.load();
    controller.unload();
    second.resolve(staticResource(t, "component", { label: "Unloaded request" }));
    await unloaded;
    assert.equal(state.detail, null);
    assert.equal(page.label, "Second request");
});
