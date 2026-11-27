import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import Modules from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/modules.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";

const frameworkUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/", import.meta.url);

function createServices(options) {
    // Create the declarative registration with effective module definitions kept at the configuration root.
    const bus = { emit() {} };
    const resolver = { resolve() { return { definition: { moduleId: "xshell" } }; } };
    const config = {
        app: { baseUrl: "https://example.test/" },
        modules: { orders: { label: "Orders", assets: { path: "/_assets/orders", url: "https://example.test/orders/" }, files: [] } },
        xshell: {
            files: [{ path: "/services/modules.js", size: 1 }],
            services: { modules: { contract: "modules", implementation: "/services/modules.js", lifetime: "singleton", ...(options === undefined ? {} : { options }) } }
        }
    };
    const loader = { async load(resource) { assert.equal(resource, "esm:/services/modules.js"); return Modules; } };
    const contractItem = {
        id: "modules",
        contract: { properties: { registry: { type: "array" } }, methods: { resolveModuleId: {}, getModuleById: {} } }
    };
    const services = new Services({ config, loader, contracts: { getContractItemById() { return contractItem; } }, resolver, bus });

    // Register the constructor dependencies supplied by the normal service injection proxy.
    services.register("bus", bus);
    services.register("config", config);
    services.register("document", globalThis.document);
    services.register("loader", loader);
    services.register("resolver", resolver);
    services.register("services", services);
    return { bus, config, loader, resolver, services };
}

test("framework manifest registers Modules declaratively without service options", async () => {
    const source = await readFile(new URL("manifest.jsonc", frameworkUrl), "utf8");

    assert.match(source, /"modules"\s*:\s*\{\s*"contract"\s*:\s*"modules",\s*"implementation"\s*:\s*"\/services\/modules\.js",\s*"lifetime"\s*:\s*"singleton"\s*\}/s);
    assert.equal((source.match(/"modules"\s*:/g) ?? []).length, 2);
});

test("Services resolves Modules lazily as one injected singleton", async () => {
    globalThis.document = { adoptedStyleSheets: [] };
    const dependencies = createServices();

    await dependencies.services.init();
    assert.equal(dependencies.services.getServiceInfo("modules").state, "");

    const modules = dependencies.services.resolve("modules");
    assert.ok(modules instanceof Modules);
    assert.strictEqual(dependencies.services.resolve("modules"), modules);
    assert.deepEqual(modules.registry, []);
    assert.ok(["_bus", "_config", "_loader", "_resolver", "_services", "_document", "_modules", "_controllerScopes"].every(name => !(name in modules)));
});

test("Modules accepts omitted options and rejects unknown options before construction", async () => {
    assert.deepEqual(Modules.optionsSchema, { type: "object", additionalProperties: false });
    globalThis.document = { adoptedStyleSheets: [] };
    const dependencies = createServices({ unknown: true });

    await dependencies.services.init();
    assert.throws(() => dependencies.services.resolve("modules"), /Invalid options for service 'modules'/);
    assert.equal(dependencies.services.getServiceInfo("modules").state, "registered");
});

test("XShell delegates its Modules accessor and explicit initialization to the configured singleton", async () => {
    const source = await readFile(new URL("xshell.js", frameworkUrl), "utf8");

    assert.doesNotMatch(source, /import Modules from|new Modules\s*\(|register\("modules"|_modules/);
    assert.match(source, /const modules = await this\._services\.initialize\("modules"\);/);
    assert.match(source, /areas\.init\(\{ modules, menus \}\);/);
});
