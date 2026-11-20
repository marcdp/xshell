import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as Details from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-details.js";
import Accordion from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-accordion.js";
import LoaderSchemaJson from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/schema-json.js";
import { createComponentClassFromJsDefinition } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/component-js.js";
import { createPageClassFromJsDefinition } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/page-js.js";
import Contracts from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/contracts.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";

globalThis.HTMLElement = class {};
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.customElements = { define() {}, get() {} };
globalThis.window = { customElements: globalThis.customElements };
globalThis.document = { baseURI: "https://example.test/" };

const { default: LoaderCommandJs } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/command-js.js");
const { default: xshell } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/xshell.js");
const schemaDirectory = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/", import.meta.url);
const schemas = {};
const validator = new JsonValidator();
const template = '<x-details label="Advanced options"></x-details>';
const code = 'throw new Error("Contract example was executed.");';
const examples = [
    { name: "basic", template },
    { name: "programmatic", code },
    { name: "mixed", template, code },
    { name: "Full_1", description: "All optional metadata", template, code, language: "future-language", state: { mode: "example" } }
];

test.before(async t => {
    // Load and bundle the production schemas using local files in place of HTTP responses.
    t.mock.method(globalThis, "fetch", async url => new Response(readFileSync(new URL(url))));
    const loader = new LoaderSchemaJson();
    for (const name of ["contract", "component", "page", "service", "command"]) {
        schemas[name] = await loader.load(new URL(name + ".schema.json", schemaDirectory).href);
    }
});

const contractLocations = {
    contract: contract => contract,
    component: contract => ({ contract }),
    page: contract => ({ contract }),
    service: contract => contract,
    command: contract => ({ contract: { execute: {}, ...contract }, controller: {} })
};

for (const [name, wrapContract] of Object.entries(contractLocations)) {
    test(`${name}: examples follow the shared schema`, () => {
        // Cover both source formats, their combination, and optional array and metadata fields.
        for (const contract of [{}, { examples: [] }, { examples }, { examples: [examples[0], examples[0]] }]) {
            const result = validator.validate(wrapContract(contract), schemas[name]);
            assert.equal(result.valid, true, JSON.stringify(result.errors));
        }

        // Reject invalid entries even when the other source field is valid.
        const invalidExamples = {
            "missing name": { template },
            "empty name": { name: "", template },
            "invalid name": { name: "with spaces", template },
            "invalid description": { name: "example", template, description: 1 },
            "missing source": { name: "example", description: "No template or code" },
            "empty template": { name: "example", template: "", code },
            "empty code": { name: "example", template, code: "" },
            "invalid template": { name: "example", template: {}, code },
            "invalid code": { name: "example", template, code: 1 },
            "invalid language": { name: "example", code, language: 1 },
            "empty language": { name: "example", code, language: "" },
            "invalid state": { name: "example", code, state: [] },
            "unknown property": { name: "example", code, extra: true }
        };
        for (const [reason, example] of Object.entries(invalidExamples)) {
            assert.equal(validator.validate(wrapContract({ examples: [example] }), schemas[name]).valid, false, reason);
        }
        assert.equal(validator.validate(wrapContract({ examples: examples[0] }), schemas[name]).valid, false);
    });
}

test("Command examples preserve the specialized contract restrictions", () => {
    // Examples do not replace execute or open the Command contract to unknown fields.
    assert.equal(validator.validate({ contract: { examples }, controller: {} }, schemas.command).valid, false);
    assert.equal(validator.validate(contractLocations.command({ examples, extra: true }), schemas.command).valid, false);
});

test("Existing x-details and x-accordion templates validate as inline examples", () => {
    // Validate the authored contracts and confirm the two disclosure examples are available on the default export.
    for (const definition of [Details.default, Accordion]) {
        const result = validator.validate({ ...definition, controller: {} }, schemas.component);
        assert.equal(result.valid, true, JSON.stringify(result.errors));
    }
    assert.equal(Object.hasOwn(Details, "docs"), false);
    assert.deepEqual(Details.default.contract.examples.map(example => example.name), ["basic", "custom-summary"]);
    assert.match(Details.default.contract.examples[0].template, /label="Advanced options"/);
    assert.match(Details.default.contract.examples[1].template, /slot="summary"/);
    assert.equal(Accordion.contract.examples[0].template, "<x-accordion></x-accordion>");
});

test("Component and Page loaders retain examples separately from implementation state and template", async () => {
    // Observe the inputs delivered to the runtime engines during both definition loads.
    const stateInputs = [];
    const templateInputs = [];
    class StateEngineFactory {
        constructor(state) { stateInputs.push(state); }
    }
    class RenderEngineFactory {
        dependencies = [];
        slots = [];
        constructor(template) { templateInputs.push(template); }
        init() {}
    }
    const defaults = { stateEngine: "test", renderEngine: "test" };
    const engines = { "state-engine:test": StateEngineFactory, "render-engine:test": RenderEngineFactory };
    const context = {
        resourceDefinition: { moduleId: "test" },
        services: {
            config: { modules: { test: { defaults: { component: defaults, page: defaults } } } },
            loader: { async load(id) { return id.startsWith("schema:") ? schemas[id.slice(7)] : engines[id]; } },
            modules: {}
        }
    };
    const createDefinition = () => ({
        meta: { id: "x-example-test" },
        contract: { examples: structuredClone(examples) },
        state: { mode: "runtime" },
        template: "<p>Implementation</p>"
    });
    const Component = await createComponentClassFromJsDefinition("component.js", context, createDefinition());
    const Page = await createPageClassFromJsDefinition("page.js", context, createDefinition());
    assert.deepEqual(Component.contract.examples, examples);
    assert.deepEqual(Page.definition.contract.examples, examples);
    assert.deepEqual(stateInputs, [{ mode: "runtime" }, { mode: "runtime" }]);
    assert.deepEqual(templateInputs, ["<p>Implementation</p>", "<p>Implementation</p>"]);
});

test("Service registration preserves examples in the validated contract document", async () => {
    // Register a service contract through the existing inventory and schema loading path.
    const contract = {
        examples: structuredClone(examples),
        types: { result: { type: "object" } },
        methods: { read: { returns: { ref: "result" } } }
    };
    const contracts = new Contracts({
        config: {
            app: { baseUrl: "https://example.test/" },
            modules: { test: { assets: { path: "/_assets/test" }, files: [{ path: "/_assets/test/contracts/sample.json" }] } }
        },
        loader: { async load(id) { return id === "schema:service" ? schemas.service : contract; } }
    }, {});
    await contracts.init();
    assert.deepEqual(contracts.getContractById("sample").examples, examples);
});

test("Command loader exposes the same examples on the class and instance", async t => {
    // Validate a definition through the Command loader before invoking its actual controller.
    const originalLoader = xshell._loader;
    t.after(() => { xshell._loader = originalLoader; });
    xshell._loader = { async load(id) {
        assert.equal(id, "schema:command");
        return schemas.command;
    } };
    const source = `export default {
        contract: { execute: { returns: { type: "string" } }, examples: ${JSON.stringify(examples)} },
        controller() { return { execute() { return "executed"; } }; }
    };`;
    const src = `data:text/javascript,${encodeURIComponent(source)}`;
    const Command = await new LoaderCommandJs().load(src, { resourceDefinition: { moduleId: "test" } });
    const command = new Command();
    assert.deepEqual(Command.contract.examples, examples);
    assert.equal(command.contract, Command.contract);
    assert.equal(command.execute(), "executed");
});
