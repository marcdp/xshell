import assert from "node:assert/strict";
import test from "node:test";
import Logger from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/logger.js";

globalThis.HTMLElement = class {};
globalThis.CSSStyleSheet = class {
    replaceSync() {}
};
globalThis.customElements = {
    define() {},
    get() { return undefined; }
};
globalThis.window = { customElements: globalThis.customElements };

const { createComponentClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/component-js.js");
const { createPageClassFromJsDefinition } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/page-js.js");

class StateEngineFactory {
    create() { return {}; }
}

class RenderEngineFactory {
    dependencies = [];
    slots = [];

    init() {}
}

for (const [name, create] of [
    ["component", createComponentClassFromJsDefinition],
    ["page", createPageClassFromJsDefinition]
]) {
    test(`${name} dependencies load esm resources through the normal Loader contract`, async () => {
        const requests = [];
        const config = {
            modules: {
                test: {
                    defaults: {
                        component: { stateEngine: "test", renderEngine: "test" },
                        page: { stateEngine: "test", renderEngine: "test" }
                    }
                }
            }
        };
        const loader = {
            async load(resource) {
                if (resource === "schema:component" || resource === "schema:page") return {};
                if (resource.startsWith?.("state-engine:")) return StateEngineFactory;
                if (resource.startsWith?.("render-engine:")) return RenderEngineFactory;
                requests.push(resource);
                return { helper: { loaded: true } };
            }
        };
        const services = { config, loader, logger: new Logger({}), modules: { shadowStyleSheets: [] } };

        await create("test.js", { resourceDefinition: { moduleId: "test" }, services }, {
            meta: { id: `x-${name}-esm-test` },
            dependencies: { helper: "esm:test:/utils/helper.js" }
        });

        assert.deepEqual(requests, [{ helper: "esm:test:/utils/helper.js" }]);
    });
}
