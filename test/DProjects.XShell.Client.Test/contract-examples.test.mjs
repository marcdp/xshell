import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import * as Details from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-details.js";
import Accordion from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-accordion.js";
import LoaderSchemaJson from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/schema-json.js";
import { createComponentClassFromJsDefinition } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/component-js.js";
import { createPageClassFromJsDefinition } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/page-js.js";
import Contracts from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/contracts.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";

globalThis.HTMLElement = class {};
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.customElements = { define() {}, get() {} };
globalThis.window = { customElements: globalThis.customElements };
globalThis.document = { baseURI: "https://example.test/", documentElement: { style: {} } };

const { default: LoaderCommandJs } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/command-js.js");
const resourceDirectory = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);
const schemaDirectory = new URL("xshell/schemas/", resourceDirectory);
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
    assert.equal(Accordion.contract.examples[0].name, "basic");
    assert.match(Accordion.contract.examples[0].template, /<x-accordion-panel label="Overview" expanded>/);
    assert.match(Accordion.contract.examples[0].template, /<x-accordion-panel label="Activity">/);
});

test("Public UI usage examples validate against the definition schemas and reference existing APIs", async () => {
    // Enumerate the reusable UI modules and all core Pages using the same definitions the runtime imports.
    const components = new Map();
    const pages = new Map();
    for (const [module, kind, definitions] of [
        ["x", "components", components], ["x-demo", "components", components], ["x-filesystem", "components", components],
        ["x-home", "components", components], ["codemirror", "components", components], ["x", "pages", pages]
    ]) {
        const directory = new URL(`${module}/${kind}/`, resourceDirectory);
        for (const file of readdirSync(directory).filter(file => file.endsWith(".js"))) {
            const { default: definition } = await import(new URL(file, directory));
            definitions.set(kind === "components" ? file.slice(0, -3) : `page:${module}:/pages/${file}`, definition);
        }
    }

    // Require examples for reusable Components and validate every authored definition in its full schema shape.
    for (const [definitions, schema] of [[components, schemas.component], [pages, schemas.page]]) {
        for (const [id, definition] of definitions) {
            const examples = definition.contract?.examples ?? [];
            if (definitions === components && id !== "x-page-info" && !id.startsWith("x-demo-")) assert.ok(examples.length, id);
            const projected = Object.fromEntries(Object.entries(definition).map(([key, value]) => [key, typeof value === "function" ? {} : value]));
            if (definitions === components) projected.meta = { id, ...projected.meta };
            const result = validator.validate(projected, schema);
            assert.equal(result.valid, true, `${id}: ${JSON.stringify(result.errors)}`);
            if (!examples.length) continue;
            const names = examples.map(example => example.name);
            assert.equal(new Set(names).size, names.length, id);

            for (const example of examples) {
                const location = `${id}/${example.name}`;
                assert.match(example.name, /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, location);

                // Check custom tags, attributes, and property bindings in the authored snippets.
                const tags = [...(example.template ?? "").matchAll(/<([a-z][\w-]*)([^<>]*)>/g)];
                for (const [, tag, attributes] of tags) {
                    if (!tag.includes("-")) continue;
                    const component = components.get(tag);
                    assert.ok(component, `${location}: unknown tag ${tag}`);
                    const properties = component.contract.properties ?? {};
                    for (const [, attr] of attributes.matchAll(/\s([\w:-]+)(?:="[^"]*")?/g)) {
                        if (attr === "x-model") assert.ok(Object.hasOwn(properties, "value"), `${location}: ${tag} has no value property`);
                        const binding = /^(x-prop|x-attr):(.+)$/.exec(attr);
                        if (!binding && (/^(x-|aria-|data-)/.test(attr) || ["id", "class", "slot", "role", "style"].includes(attr))) continue;
                        if (tag === "x-wizard-panel" && attr === "label") continue; // Its parent wizard reads this attribute directly.
                        const property = (binding?.[2] ?? attr).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
                        assert.ok(Object.hasOwn(properties, property), `${location}: ${tag} has no ${property} property`);
                        if (binding?.[1] !== "x-prop") assert.equal(properties[property].attribute, true, location);
                    }
                }

                // Validate direct calls on example elements without evaluating their JavaScript.
                for (const [, id, method] of (example.code ?? "").matchAll(/document\.querySelector\("#([\w-]+)"\)\.(\w+)\(/g)) {
                    if (method === "addEventListener") continue;
                    const tag = tags.find(([, , attributes]) => attributes.includes(` id="${id}"`))?.[1];
                    assert.ok(components.get(tag)?.contract.methods?.[method], `${location}: unsupported method ${method}`);
                }

                // Check literal Page locators and query keys across both markup and code examples.
                const sources = [example.template, example.code, JSON.stringify(example.state)].join("\n");
                for (const [, href, query] of sources.matchAll(/(page:x:\/pages\/[\w-]+\.js)(?:\?([^"\s<]+))?/g)) {
                    const target = pages.get(href);
                    assert.ok(target, `${location}: unknown Page ${href}`);
                    for (const key of new URLSearchParams(query?.replaceAll("&amp;", "&")).keys()) {
                        const property = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
                        assert.equal(target.contract?.properties?.[property]?.query, true, `${location}: unsupported query key ${key}`);
                    }
                }
            }
        }
    }
});

test("Component and Page loaders retain examples and give render engines only the explicit render context", async () => {
    // Observe the inputs delivered to the runtime engines during both definition loads.
    const stateInputs = [];
    const stateContexts = [];
    const templateInputs = [];
    const renderContexts = [];
    class StateEngineFactory {
        constructor(state, context) { stateInputs.push(state); stateContexts.push(context); }
    }
    class RenderEngineFactory {
        dependencies = [];
        slots = [];
        constructor(template, context) { templateInputs.push(template); renderContexts.push(context); }
        init() {}
    }
    const defaults = { stateEngine: "test", renderEngine: "test" };
    const engines = { "state-engine:test": StateEngineFactory, "render-engine:test": RenderEngineFactory };
    const i18n = { id: "i18n" };
    const navigation = { mode: "hash" };
    let navigationResolutionCount = 0;
    const services = {
        config: { modules: { test: { defaults: { component: defaults, page: defaults } } } },
        loader: { async load(id) { return id.startsWith("schema:") ? schemas[id.slice(7)] : engines[id]; } },
        modules: {},
        i18n
    };
    // Count Navigation resolution separately from render-context construction.
    Object.defineProperty(services, "navigation", { get() { navigationResolutionCount++; return navigation; } });
    const context = {
        resourceName: "x-example-test",
        resourcePath: "/_assets/test/components/example.js",
        resourceDefinition: { moduleId: "test", modulePath: "/_assets/test" },
        appBasePath: "/app",
        componentLazy: "x-lazy",
        services
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
    assert.deepEqual(stateContexts, [context, context]);
    assert.equal(navigationResolutionCount, 0);
    for (const renderContext of renderContexts) {
        assert.deepEqual(Object.keys(renderContext), ["resourceName", "resourcePath", "resourceDefinition", "appBasePath", "componentLazy", "i18n", "navigationMode"]);
        assert.equal(Object.hasOwn(renderContext, "services"), false);
        assert.equal(Object.hasOwn(renderContext, "navigation"), false);
        assert.equal(renderContext.resourceDefinition, context.resourceDefinition);
        assert.equal(renderContext.i18n, i18n);
        assert.equal(renderContext.navigationMode, "hash");
    }
    assert.equal(navigationResolutionCount, 2);
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

test("Command loader exposes the same examples on the class and instance", async () => {
    // Validate a definition through the Command loader before invoking its actual controller.
    const root = new Services({config: {xshell: {services: {}}}, bus: null});
    root.register("services", root);
    const context = {
        resourceDefinition: {moduleId: "test"},
        services: {
            loader: {async load(id) { assert.equal(id, "schema:command"); return schemas.command; }},
            config: {modules: {test: {id: "test"}}},
            modules: {getModuleById() { return {id: "test"}; }},
            services: root
        }
    };
    const source = `export default {
        contract: { execute: { returns: { type: "string" } }, examples: ${JSON.stringify(examples)} },
        controller() { return { execute() { return "executed"; } }; }
    };`;
    const src = `data:text/javascript,${encodeURIComponent(source)}`;
    const Command = await new LoaderCommandJs().load(src, context);
    const command = new Command();
    assert.deepEqual(Command.contract.examples, examples);
    assert.equal(command.contract, Command.contract);
    assert.equal(command.execute(), "executed");
    await command.dispose();
    assert.equal(root._children.length, 0);
});
