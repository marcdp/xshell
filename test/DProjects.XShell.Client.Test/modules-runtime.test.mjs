import assert from "node:assert/strict";
import test from "node:test";

import Modules from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/modules.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import Loader from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/loader.js";
import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/resolver.js";

function freeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    }
    return value;
}

function moduleDefinition(id, overrides = {}) {
    return {
        label: `${id} module`,
        assets: { path: `/_assets/${id}`, url: `https://example.test/${id}/` },
        files: [],
        ...overrides
    };
}

function createModules(config, { loader = {}, services = {}, document = { adoptedStyleSheets: [] } } = {}) {
    globalThis.document = document;
    return new Modules({
        bus: {},
        config,
        loader,
        resolver: {},
        services,
        document
    });
}

test("module without service requirements initializes and starts normally", async () => {
    let starts = 0;
    const loads = [];
    class ModuleController {

        start() {
            starts++;
        }
    }
    const config = freeze({
        xshell: { assets: { basePath: "/_assets" } },
        modules: {
            orders: moduleDefinition("orders", { files: [{ path: "/_assets/orders/module.js" }] })
        }
    });
    const modules = createModules(config, {
        loader: { async load(resource) { loads.push(resource); return ModuleController; } },
        services: { resolve() { throw new Error("no service should be resolved"); } }
    });

    await modules.init();

    assert.equal(starts, 1);
    assert.deepEqual(loads, ["esm:/_assets/orders/module.js"]);
});

test("module controllers receive singleton services and module-specific metadata", async () => {
    const identity = { id: "identity" };
    let injected;
    class ModuleController {

        constructor(services) {
            injected = {
                identity: services.identity,
                modules: services.modules,
                moduleAssetsPath: services.moduleAssetsPath,
                moduleConfig: services.moduleConfig
            };
        }
    }
    const config = freeze({
        xshell: { assets: { basePath: "/_assets" } },
        modules: { orders: moduleDefinition("orders", { params: { mode: "test" }, files: [{ path: "/_assets/orders/module.js" }] }) }
    });
    let modules;
    const services = { resolve(name) { return name === "identity" ? identity : name === "modules" ? modules : null; } };
    modules = createModules(config, { loader: { async load() { return ModuleController; } }, services });

    await modules.init();

    assert.strictEqual(injected.identity, identity);
    assert.strictEqual(injected.modules, modules);
    assert.equal(injected.moduleAssetsPath, "/_assets/orders");
    assert.deepEqual(injected.moduleConfig, { id: "orders", ...config.modules.orders });
});

test("shared sheets are published before module controller construction", async () => {
    const sheet = { id: "shared" };
    const loads = [];
    let injectedSheets;
    let modules;
    class ModuleController {

        constructor(services) {
            injectedSheets = services.modules.shadowStyleSheets;
        }
    }
    const config = freeze({
        xshell: { assets: { basePath: "/_assets" } },
        modules: { orders: moduleDefinition("orders", { files: [
            { path: "/_assets/orders/styles/shared.css" },
            { path: "/_assets/orders/module.js" }
        ] }) }
    });
    const services = { resolve(name) { return name === "modules" ? modules : null; } };
    modules = createModules(config, {
        loader: { async load(resource) {
            loads.push(resource);
            return resource.startsWith("style:") ? sheet : ModuleController;
        } },
        services
    });

    await modules.init();

    assert.deepEqual(loads, ["style:/_assets/orders/styles/shared.css", "esm:/_assets/orders/module.js"]);
    assert.strictEqual(injectedSheets, modules.shadowStyleSheets);
    assert.deepEqual(injectedSheets, [sheet]);
});

test("module controllers start in dependency order and stop in reverse dependency order", async () => {
    const events = [];
    const config = freeze({
        xshell: { assets: { basePath: "/_assets" } },
        modules: Object.fromEntries(["base", "feature", "app"].map(id => [
            id,
            moduleDefinition(id, { files: [{ path: `/_assets/${id}/module.js` }] })
        ]))
    });
    const modules = createModules(config, {
        loader: { async load(resource) {
            const id = resource.split("/").at(-2);
            return class ModuleController {

                async start() { events.push(`${id}.start`); }
                async stop() { events.push(`${id}.stop`); }
            };
        } }
    });

    await modules.init();
    const orderBeforeStop = modules.registry.map(module => module.id);
    assert.deepEqual(events, ["base.start", "feature.start", "app.start"]);

    await modules.stop();

    assert.deepEqual(events, [
        "base.start", "feature.start", "app.start",
        "app.stop", "feature.stop", "base.stop"
    ]);
    assert.deepEqual(modules.registry.map(module => module.id), orderBeforeStop);
});

test("failed module startup rolls back successful starts in reverse order and preserves the startup error", async () => {
    const events = [];
    const startupError = new Error("app startup failed");
    const config = freeze({
        xshell: { assets: { basePath: "/_assets" } },
        modules: Object.fromEntries(["base", "feature", "app"].map(id => [
            id,
            moduleDefinition(id, { files: [{ path: `/_assets/${id}/module.js` }] })
        ]))
    });
    const modules = createModules(config, {
        loader: { async load(resource) {
            const id = resource.split("/").at(-2);
            return class ModuleController {

                async start() {
                    events.push(`${id}.start`);
                    if (id === "app") throw startupError;
                }
                async stop() {
                    events.push(`${id}.stop`);
                    if (id === "feature") throw new Error("feature stop failed");
                }
            };
        } }
    });

    await assert.rejects(() => modules.init(), error => error === startupError);
    assert.deepEqual(events, [
        "base.start", "feature.start", "app.start",
        "feature.stop", "base.stop"
    ]);
});

test("module registry is a frozen metadata snapshot of the runtime modules", async () => {
    const config = freeze({
        xshell: { assets: { basePath: "/_assets" } },
        modules: { orders: moduleDefinition("orders", { files: [
            { path: "/_assets/orders/pages/index.js", size: 10, resource: { type: "page", title: "Orders" } },
            { path: "/_assets/orders/images/logo.svg", size: 20 }
        ] }) }
    });
    const modules = createModules(config);
    const before = modules.registry;

    await modules.init();

    const registry = modules.registry;
    assert.deepEqual(before, []);
    const runtimeModule = modules.getModuleById("orders");
    assert.equal(Object.isFrozen(registry), true);
    assert.notStrictEqual(registry[0], runtimeModule);
    assert.equal(registry[0].id, runtimeModule.id);
    assert.equal(registry[0].path, runtimeModule.path);
    assert.equal(Object.hasOwn(registry[0], "controller"), false);
    assert.equal(Object.hasOwn(registry[0], "config"), false);
    assert.equal(Object.isFrozen(registry[0]), true);
    assert.equal(Object.isFrozen(registry[0].assets), true);
    assert.equal(Object.isFrozen(registry[0].files), true);
    assert.equal(Object.isFrozen(registry[0].files[0]), true);
    assert.equal(Object.isFrozen(registry[0].files[0].resource), true);
    assert.deepEqual(registry[0].files[0].resource, { type: "page", title: "Orders" });
    assert.equal(Object.hasOwn(registry[0].files[1], "resource"), false);
    assert.throws(() => registry.push({ id: "other" }), TypeError);
    assert.throws(() => registry.splice(0, 1), TypeError);
    assert.notStrictEqual(modules.registry, registry);
    assert.deepEqual(modules.registry, registry);
});

test("runtime module path uses its effective assets.path", async () => {
    const config = freeze({
        xshell: { assets: { basePath: "/_assets" } },
        modules: { orders: moduleDefinition("orders", { assets: { path: "/runtime/orders", url: "https://example.test/orders/" } }) }
    });
    const modules = createModules(config);

    await modules.init();

    const module = modules.getModuleById("orders");
    assert.equal(module.path, module.config.assets.path);
    assert.equal(module.path, "/runtime/orders");
    assert.equal(modules.resolveModuleId("/runtime/orders/pages/index.js"), "orders");
});

test("module requirements accept configured lazy services without constructing them", async () => {
    let constructions = 0;
    class IdentityService {

        static optionsSchema = {
            type: "object",
            additionalProperties: false
        };

        constructor() {
            constructions++;
        }
    }
    const servicePath = "/_assets/orders/services/identity.js";
    const config = freeze({
        app: { basePath: "/app", baseUrl: "https://example.test/app/" },
        xshell: {
            assets: { basePath: "/_assets" },
            services: { identity: { contract: "identity", implementation: servicePath } }
        },
        modules: {
            orders: moduleDefinition("orders", { requires: ["identity"], files: [{ path: servicePath, size: 1 }] })
        }
    });
    const loader = { async load(resource) {
        assert.equal(resource, `esm:${servicePath}`);
        return IdentityService;
    } };
    const services = new Services({
        config,
        loader,
        contracts: {
            getContractItemById() {
                return { id: "identity", contract: { label: "Identity", methods: {}, properties: {} } };
            }
        },
        resolver: { resolve() { return { definition: { moduleId: "orders" } }; } }
    });
    await services.init();
    const modules = createModules(config, { loader, services });

    await modules.init();

    assert.equal(services.getServiceInfo("identity").state, "registered");
    assert.equal(constructions, 0);
});

test("missing module requirement fails before its controller is loaded or started", async () => {
    const loads = [];
    const config = freeze({
        xshell: { assets: { basePath: "/_assets" } },
        modules: {
            orders: moduleDefinition("orders", { requires: ["identity"], files: [{ path: "/_assets/orders/module.js" }] })
        }
    });
    const modules = createModules(config, {
        loader: { async load(resource) { loads.push(resource); } },
        services: { has() { return false; } }
    });

    await assert.rejects(() => modules.init(), /Module 'orders' requires unavailable service 'identity'\./);
    assert.deepEqual(loads, []);
});

test("runtime module exposes normalized routes from its effective configuration", async () => {
    const routes = {
        "/something": "/_assets/x-demo/pages/index.js",
        "/repository/{repositoryId}/projects/{projectId}/items": "/_assets/x-demo/pages/items.js"
    };
    const config = freeze({
        xshell: { assets: { basePath: "/_assets" } },
        modules: {
            "x-demo": moduleDefinition("x-demo", { routes })
        }
    });
    const modules = createModules(config);

    await modules.init();

    const module = modules.getModuleById("x-demo");
    assert.equal(module.routes, routes);
    assert.equal(module.routes["/something"], "/_assets/x-demo/pages/index.js");
    assert.equal(module.routes["/repository/{repositoryId}/projects/{projectId}/items"], "/_assets/x-demo/pages/items.js");
    assert.equal(Object.isFrozen(module.routes), true);
});

test("runtime modules expose independent route definitions", async () => {
    const config = freeze({
        xshell: { assets: { basePath: "/_assets" } },
        modules: {
            first: moduleDefinition("first", { routes: { "/first": "/_assets/first/pages/index.js" } }),
            second: moduleDefinition("second", { routes: { "/second": "/_assets/second/pages/index.js" } })
        }
    });
    const modules = createModules(config);

    await modules.init();

    assert.deepEqual(modules.getModuleById("first").routes, { "/first": "/_assets/first/pages/index.js" });
    assert.deepEqual(modules.getModuleById("second").routes, { "/second": "/_assets/second/pages/index.js" });
    assert.notEqual(modules.getModuleById("first").routes, modules.getModuleById("second").routes);
});

test("runtime module without routes exposes a frozen empty object", async () => {
    const config = freeze({
        xshell: { assets: { basePath: "/_assets" } },
        modules: { "x-demo": moduleDefinition("x-demo") }
    });
    const modules = createModules(config);

    await modules.init();

    const routes = modules.getModuleById("x-demo").routes;
    assert.deepEqual(routes, {});
    assert.equal(Object.isFrozen(routes), true);
});

test("module document and shared Shadow DOM styles load once and retain module order", async () => {
    const indexPaths = ["/_assets/index-only/styles/index.css", "/_assets/first/styles/index.css", "/_assets/second/styles/index.css"];
    const sharedPaths = ["/_assets/first/styles/shared.css", "/_assets/second/styles/shared.css", "/_assets/shared-only/styles/shared.css"];
    const requests = [];
    const events = [];
    globalThis.window = { location: { origin: "https://example.test" }, customElements: { get() {} } };
    globalThis.CSSStyleSheet = class {
        async replace(css) { this.css = css; }
    };
    globalThis.fetch = async url => {
        requests.push(url);
        return { ok: true, async text() {
            if (url.includes("/first/styles/shared.css")) await new Promise(resolve => setTimeout(resolve, 1));
            return `${url.split("/").at(-3)}-${url.split("/").at(-1)}{background:url(../images/background.png)}`;
        } };
    };
    const styleLoaderUrl = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/style-css.js", import.meta.url).href;
    const config = freeze({
        app: { basePath: "", baseUrl: "https://example.test/" },
        xshell: {
            assets: { basePath: "/_assets" },
            services: { navigation: { options: { mode: "path" } } },
            ui: { component: { lazy: null } },
            resolver: { style: Object.fromEntries(["index-only", "first", "second", "shared-only"].map(id => [
                `/_assets/${id}/{path}.css`,
                { src: `/_assets/${id}/{path}.css`, loader: styleLoaderUrl, cache: true, moduleId: id, modulePath: `/_assets/${id}` }
            ])) }
        },
        modules: {
            "index-only": moduleDefinition("index-only", { files: [{ path: indexPaths[0] }, { path: indexPaths[0] }] }),
            first: moduleDefinition("first", { files: [{ path: indexPaths[1] }, { path: sharedPaths[0] }] }),
            second: moduleDefinition("second", { files: [{ path: indexPaths[2] }, { path: sharedPaths[1] }] }),
            "shared-only": moduleDefinition("shared-only", { files: [{ path: sharedPaths[2] }] }),
            missing: moduleDefinition("missing")
        }
    });
    const resolver = new Resolver({ config });
    const loader = new Loader({ bus: { emit(name, payload) { events.push({ name, payload }); } }, resolver, services: {} }, {
        appBasePath: "", xshellAssetsPath: "/_assets", componentLazy: null
    });
    const existingStyleSheet = { id: "existing" };
    const document = { adoptedStyleSheets: [existingStyleSheet, existingStyleSheet] };
    globalThis.document = document;
    const modules = new Modules({ bus: {}, config, loader, resolver, services: {}, document });

    await modules.init();

    const indexOnly = modules.getModuleById("index-only").styles;
    const first = modules.getModuleById("first").styles;
    const second = modules.getModuleById("second").styles;
    assert.equal(indexOnly.length, 1);
    assert.equal(first.length, 1);
    assert.equal(second.length, 1);
    assert.deepEqual(modules.getModuleById("missing").styles, []);
    assert.notStrictEqual(first[0], second[0]);
    assert.match(indexOnly[0].css, /^index-only-index\.css/);
    assert.match(first[0].css, /^first-index\.css/);
    assert.match(second[0].css, /^second-index\.css/);
    assert.deepEqual(modules.shadowStyleSheets.map(sheet => sheet.css), [
        "first-shared.css{background:url(https://example.test/_assets/first/images/background.png)}",
        "second-shared.css{background:url(https://example.test/_assets/second/images/background.png)}",
        "shared-only-shared.css{background:url(https://example.test/_assets/shared-only/images/background.png)}"
    ]);
    assert.deepEqual(document.adoptedStyleSheets, [existingStyleSheet, ...modules.shadowStyleSheets, indexOnly[0], first[0], second[0]]);
    assert.equal(new Set(document.adoptedStyleSheets).size, document.adoptedStyleSheets.length);
    assert.strictEqual(document.adoptedStyleSheets[1], modules.shadowStyleSheets[0]);
    assert.equal(Object.isFrozen(modules.shadowStyleSheets), true);
    assert.deepEqual(requests.toSorted(), [...indexPaths, ...sharedPaths].map(path => `https://example.test${path}`).toSorted());
    assert.deepEqual(loader.registry.map(item => [item.resource, item.moduleId, item.status]), [
        [`style:${indexPaths[0]}`, "index-only", "loaded"],
        [`style:${indexPaths[1]}`, "first", "loaded"],
        [`style:${sharedPaths[0]}`, "first", "loaded"],
        [`style:${indexPaths[2]}`, "second", "loaded"],
        [`style:${sharedPaths[1]}`, "second", "loaded"],
        [`style:${sharedPaths[2]}`, "shared-only", "loaded"]
    ]);
    assert.equal(events.filter(event => event.name === "xshell:loader:resource:loaded").length, 6);
    assert.strictEqual(await loader.load(`style:${indexPaths[0]}`), indexOnly[0]);
    assert.deepEqual(requests.toSorted(), [...indexPaths, ...sharedPaths].map(path => `https://example.test${path}`).toSorted());
});
