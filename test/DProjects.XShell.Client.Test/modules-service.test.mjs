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
            services: { modules: { contract: "modules", implementation: "/services/modules.js", ...(options === undefined ? {} : { options }) } }
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
    services.register("loader", loader);
    services.register("resolver", resolver);
    services.register("services", services);
    return { bus, config, loader, resolver, services };
}

test("framework manifest registers Modules declaratively without service options", async () => {
    const source = await readFile(new URL("manifest.jsonc", frameworkUrl), "utf8");

    assert.match(source, /"modules"\s*:\s*\{\s*"contract"\s*:\s*"modules",\s*"implementation"\s*:\s*"\/services\/modules\.js"\s*\}/s);
    assert.equal((source.match(/"modules"\s*:/g) ?? []).length, 2);
});

test("Services resolves Modules lazily as one injected singleton", async () => {
    const dependencies = createServices();
    globalThis.document = { adoptedStyleSheets: [] };

    await dependencies.services.init();
    assert.equal(dependencies.services.getServiceInfo("modules").state, "registered");

    const modules = dependencies.services.resolve("modules");
    assert.ok(modules instanceof Modules);
    assert.strictEqual(dependencies.services.resolve("modules"), modules);
    assert.strictEqual(modules._bus, dependencies.bus);
    assert.strictEqual(modules._config, dependencies.config);
    assert.strictEqual(modules._loader, dependencies.loader);
    assert.strictEqual(modules._resolver, dependencies.resolver);
    assert.strictEqual(modules._services, dependencies.services);
    assert.strictEqual(modules._document, globalThis.document);
    assert.strictEqual(modules._config.modules.orders, dependencies.config.modules.orders);
});

test("Modules accepts omitted options and rejects unknown options before construction", async () => {
    assert.deepEqual(Modules.optionsSchema, { type: "object", additionalProperties: false });
    const dependencies = createServices({ unknown: true });
    globalThis.document = { adoptedStyleSheets: [] };

    await dependencies.services.init();
    assert.throws(() => dependencies.services.resolve("modules"), /Invalid options for service 'modules'/);
    assert.equal(dependencies.services.getServiceInfo("modules").state, "registered");
});

test("XShell delegates its Modules accessor and explicit initialization to the configured singleton", async () => {
    const source = await readFile(new URL("xshell.js", frameworkUrl), "utf8");

    assert.doesNotMatch(source, /import Modules from|new Modules\s*\(|register\("modules"|_modules/);
    assert.match(source, /get modules\(\) \{ return this\._services\.resolve\("modules"\); \}/);
    assert.match(source, /const modules = this\._services\.resolve\("modules"\);\s*await modules\.init\(\);/s);
    assert.match(source, /areas\.init\(\{ modules \}\);/);
});
