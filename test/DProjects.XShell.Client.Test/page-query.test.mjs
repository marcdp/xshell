import assert from "node:assert/strict";
import test from "node:test";
import ComponentSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/component.schema.json" with { type: "json" };
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import PageSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/page.schema.json" with { type: "json" };
import { Validator } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/vendor/json-schema/4.1.1/json-schema.js";

class FakeElement {
    attachShadow() {
        this.shadowRoot = { adoptedStyleSheets: [] };
        return this.shadowRoot;
    }
}

globalThis.HTMLElement = FakeElement;
globalThis.CSSStyleSheet = class {
    replaceSync() {}
};
globalThis.customElements = {
    define() {},
    get() { return undefined; }
};
globalThis.window = { customElements: globalThis.customElements };
globalThis.document = { baseURI: "https://example.test/" };

const { createPageClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/page-js.js");
const { default: xshell } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/xshell.js");

class StateEngineFactory {
    constructor(state) {
        this.state = state;
    }

    create() {
        return { ...this.state };
    }
}

class RenderEngineFactory {
    dependencies = [];
    slots = [];

    init() {}
}

function configureDefinitionLoaders() {
    xshell._config = {
        modules: {
            test: {
                defaults: {
                    component: { stateEngine: "test", renderEngine: "test" },
                    page: { stateEngine: "test", renderEngine: "test" }
                }
            }
        }
    };
    xshell._loader = {
        async load(resource) {
            return resource.startsWith("state-engine:") ? StateEngineFactory : RenderEngineFactory;
        }
    };
    xshell._bus = { emit() {} };
}

function createContext() {
    return { resourceDefinition: { moduleId: "test" } };
}

function createDefinition(controller = () => ({})) {
    return { meta: { id: "page-query-test" }, controller };
}

function createContract(properties) {
    return { properties };
}

async function createPage(properties, src, controller = () => ({})) {
    configureDefinitionLoaders();
    const PageClass = await createPageClassFromJsDefinition(src, createContext(), { ...createDefinition(controller), contract: createContract(properties) });
    return new PageClass({ src, context: {} });
}

test("Page injects its owning Module instance and controller from loader context", async () => {
    configureDefinitionLoaders();
    const moduleController = { id: "test-controller" };
    const moduleInstance = { id: "test", controller: moduleController };
    xshell._modules = {
        getModuleById(id) {
            assert.equal(id, "test");
            return moduleInstance;
        }
    };
    let injected;
    const PageClass = await createPageClassFromJsDefinition("/page.js", createContext(),
        createDefinition(({ moduleInstance, moduleController }) => {
            injected = { moduleInstance, moduleController };
            return {};
        }), {});

    new PageClass({ src: "/page.js", context: { fromNavigation: true } });
    assert.strictEqual(injected.moduleInstance, moduleInstance);
    assert.strictEqual(injected.moduleController, moduleController);
});

test("Page query binding is explicit and uses kebab-case names", async () => {
    const page = await createPage({
        foo: { type: "string", default: "default", state: true, query: true },
        bar: { type: "string", default: "default", state: true },
        baz: { type: "string", default: "default", state: true, query: false }
    }, "/page.js?foo=queryFoo&bar=queryBar&baz=queryBaz");

    assert.equal(page._state.foo, "queryFoo");
    assert.equal(page._state.bar, "default");
    assert.equal(page._state.baz, "default");

    const camelCasePage = await createPage({
        pageIndex: { type: "integer", default: 0, state: true, query: true },
        id: { type: "string", default: "", state: true, query: true }
    }, "/page.js?page-index=7&id=123");

    assert.equal(camelCasePage._state.pageIndex, 7);
    assert.equal(camelCasePage._state.id, "123");
});

test("Page query values exclude the URL fragment in controller and contract state", async () => {
    let controllerValue;
    const page = await createPage({
        a: { type: "string", default: "", state: true, query: true }
    }, "/page.js?a=1#section", ({ query }) => {
        controllerValue = query.get("a");
        return {};
    });

    assert.equal(controllerValue, "1");
    assert.equal(page._state.a, "1");
});

test("Page query values use contract scalar types and retain defaults when absent", async () => {
    const page = await createPage({
        text: { type: "string", default: "default", state: true, query: true },
        scale: { type: "number", default: 1, state: true, query: true },
        pageIndex: { type: "integer", default: 0, state: true, query: true },
        enabled: { type: "boolean", default: false, state: true, query: true },
        nullableNumber: { type: "number", default: null, state: true, query: true },
        missing: { type: "string", default: "retained", state: true, query: true }
    }, "/page.js?text=&scale=1.5&page-index=3&enabled=1&nullable-number=2.5");

    assert.equal(page._state.text, "");
    assert.equal(page._state.scale, 1.5);
    assert.equal(page._state.pageIndex, 3);
    assert.equal(page._state.enabled, true);
    assert.equal(page._state.nullableNumber, 2.5);
    assert.equal(page._state.missing, "retained");

    for (const value of ["true", "1"]) {
        const truePage = await createPage({ enabled: { type: "boolean", default: false, state: true, query: true } }, `/page.js?enabled=${value}`);
        assert.equal(truePage._state.enabled, true);
    }
    for (const value of ["false", "0"]) {
        const falsePage = await createPage({ enabled: { type: "boolean", default: true, state: true, query: true } }, `/page.js?enabled=${value}`);
        assert.equal(falsePage._state.enabled, false);
    }
});

test("Page JSON query parsing initializes objects, arrays, and any JSON value", async () => {
    const src = "/page.js?args=%7B%22path%22%3A%22%2Fdocs%2Ffile.txt%22%7D&items=%5B1%2C%22two%22%5D&scalar=42&nothing=null#details";
    const page = await createPage({
        args: { type: "object", default: {}, state: true, query: true, queryParser: "json" },
        items: { type: "array", default: [], state: true, query: true, queryParser: "json" },
        scalar: { type: "any", default: null, state: true, query: true, queryParser: "json" },
        nothing: { type: "any", default: "default", state: true, query: true, queryParser: "json" },
        missing: { type: "object", default: { retained: true }, state: true, query: true, queryParser: "json" }
    }, src);

    assert.deepEqual(page._state.args, { path: "/docs/file.txt" });
    assert.deepEqual(page._state.items, [1, "two"]);
    assert.equal(page._state.scalar, 42);
    assert.equal(page._state.nothing, null);
    assert.deepEqual(page._state.missing, { retained: true });
});

test("Page JSON query parsing rejects malformed and incorrectly typed values", async () => {
    const objectProperty = { type: "object", default: {}, state: true, query: true, queryParser: "json" };
    const arrayProperty = { type: "array", default: [], state: true, query: true, queryParser: "json" };

    await assert.rejects(() => createPage({ args: objectProperty }, "/page.js?args=%7Bbad"), /Page property 'args'.*invalid JSON query value/);
    for (const value of ["null", "%5B1%5D", "true"]) {
        await assert.rejects(() => createPage({ args: objectProperty }, `/page.js?args=${value}`), /Page property 'args'.*does not match type 'object'/);
    }
    await assert.rejects(() => createPage({ items: arrayProperty }, "/page.js?items=%7B%7D"), /Page property 'items'.*does not match type 'array'/);
});

test("Page JSON query metadata requires query, state, and supported types", async () => {
    await assert.rejects(() => createPage({ value: { type: "object", default: {}, state: true, queryParser: "json" } }, "/page.js"), /Page property 'value'.*does not declare query:true/);
    await assert.rejects(() => createPage({ value: { type: "object", default: {}, query: true, queryParser: "json" } }, "/page.js"), /Page property 'value'.*not state-backed/);
    await assert.rejects(() => createPage({ value: { type: "object", default: {}, state: true, query: true, queryParser: "custom" } }, "/page.js"), /Page property 'value'.*unsupported queryParser 'custom'/);
    for (const type of ["string", "number", "integer", "boolean", "date", "function"]) {
        await assert.rejects(() => createPage({ value: { type, default: null, state: true, query: true, queryParser: "json", schema: true } }, "/page.js"), new RegExp(`Page property 'value'.*unsupported type '${type}'`));
    }
});

test("queryParser is accepted only by the Page schema and only for json", () => {
    const definition = parser => ({ contract: { properties: {
        value: { type: "object", default: {}, state: true, query: true, queryParser: parser }
    } } });
    const createValidator = schema => {
        const validator = new Validator(schema, "2020-12");
        validator.addSchema(ContractSchema, new URL("./contract.schema.json", schema.$id).href);
        return validator;
    };

    assert.equal(createValidator(PageSchema).validate(definition("json")).valid, true);
    assert.equal(createValidator(PageSchema).validate(definition("custom")).valid, false);
    assert.equal(createValidator(ComponentSchema).validate(definition("json")).valid, false);
});

test("Page query conversion rejects malformed scalar values", async () => {
    await assert.rejects(() => createPage({ scale: { type: "number", default: 1, state: true, query: true } }, "/page.js?scale=invalid"), /invalid number query value/);
    await assert.rejects(() => createPage({ pageIndex: { type: "integer", default: 0, state: true, query: true } }, "/page.js?page-index=3.5"), /invalid integer query value/);
    await assert.rejects(() => createPage({ enabled: { type: "boolean", default: false, state: true, query: true } }, "/page.js?enabled="), /invalid boolean query value/);
});

test("Page query metadata requires state-backed supported scalar properties", async () => {
    await assert.rejects(() => createPage({ value: { type: "string", default: "", query: true } }, "/page.js?value=query"), /Page property 'value'.*not state-backed/);
    for (const type of ["object", "array", "function", "any", "date"]) {
        await assert.rejects(() => createPage({ value: { type, default: type === "array" ? [] : null, state: true, query: true, schema: { type: "string" } } }, "/page.js?value=query"), new RegExp(`Page property 'value'.*unsupported type '${type}'`));
    }
    await assert.rejects(() => createPage({ value: { type: "void", default: null, state: true, query: true } }, "/page.js?value=query"), /unsupported type 'void'/);
});

test("The controller and load lifecycle see query-derived state", async () => {
    let observedControllerValue;
    let observedLoadValue;
    const page = await createPage({ customerId: { type: "string", default: "default", state: true, query: true } }, "/page.js?customer-id=C42", ({ state }) => ({
        load() {
            observedLoadValue = state.customerId;
        }
    }));

    observedControllerValue = page._state.customerId;
    await page.load();
    assert.equal(observedControllerValue, "C42");
    assert.equal(observedLoadValue, "C42");
});

test("query values are isolated between Page instances", async () => {
    configureDefinitionLoaders();
    const observedQueryIds = [];
    const PageClass = await createPageClassFromJsDefinition("/page.js", createContext(), { ...createDefinition(({ query }) => {
        observedQueryIds.push(query.get("id"));
        return {};
    }), contract: createContract({
        id: { type: "string", default: "", state: true, query: true }
    }) });
    const pageA = new PageClass({ src: "/page.js?id=A", context: {} });
    const pageB = new PageClass({ src: "/page.js?id=B", context: {} });

    assert.equal(pageA.src, "/page.js?id=A");
    assert.equal(pageB.src, "/page.js?id=B");
    assert.equal(pageA._state.id, "A");
    assert.equal(pageB._state.id, "B");
    assert.deepEqual(observedQueryIds, ["A", "B"]);
});
