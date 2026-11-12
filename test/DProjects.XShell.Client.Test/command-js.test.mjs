import assert from "node:assert/strict";
import test from "node:test";

test("command-js injects invocation task, context and ordinary XShell services together", async () => {
    globalThis.CSSStyleSheet ??= class { replaceSync() {} };
    globalThis.HTMLElement ??= class {};
    globalThis.customElements ??= { define() {} };
    const [{ default: LoaderCommandJs }, { default: xshell }] = await Promise.all([
        import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/command-js.js"),
        import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/xshell.js")
    ]);
    const marker = `__command_dependencies_${crypto.randomUUID().replaceAll("-", "")}`;
    const source = `
        export default {
            contract: { label: "Example", execute: { parameters: [] } },
            controller(services) {
                globalThis.${marker} = {
                    task: services.task,
                    context: services.context,
                    loader: services.loader,
                    resolver: services.resolver,
                    tasks: services.tasks,
                    module: services.module,
                    moduleConfig: services.moduleConfig,
                    symbol: services[Symbol.toStringTag]
                };
                return { execute(value) { return value; } };
            }
        };
    `;
    const src = `data:text/javascript,${encodeURIComponent(source)}`;
    const originals = {
        loader: xshell._loader,
        services: xshell._services,
        config: xshell._config,
        modules: xshell._modules
    };
    const ordinary = {
        loader: { name: "loader" },
        resolver: { name: "resolver" },
        tasks: { name: "tasks" }
    };
    const module = { id: "sample" };
    const moduleConfig = { id: "sample", src: "sample.jsonc" };
    const task = { signal: new AbortController().signal };
    const invocationContext = { task, metadata: "value" };

    try {
        xshell._loader = { load: async id => {
            assert.equal(id, "schema:command");
            return {
                type: "object",
                required: ["contract", "controller"],
                properties: { contract: { type: "object" }, controller: { type: "object" } }
            };
        } };
        xshell._services = { resolve: id => ordinary[id] };
        xshell._config = { modules: { sample: moduleConfig } };
        xshell._modules = { getModuleById: id => id === "sample" ? module : null };

        const Command = await new LoaderCommandJs().load(src, { resourceDefinition: { moduleId: "sample" } });
        const instance = new Command(invocationContext);

        assert.equal(instance.execute(7), 7);
        assert.equal(globalThis[marker].task, task);
        assert.equal(globalThis[marker].context, invocationContext);
        assert.equal(globalThis[marker].loader, ordinary.loader);
        assert.equal(globalThis[marker].resolver, ordinary.resolver);
        assert.equal(globalThis[marker].tasks, ordinary.tasks);
        assert.equal(globalThis[marker].module, module);
        assert.equal(globalThis[marker].moduleConfig, moduleConfig);
        assert.equal(globalThis[marker].symbol, undefined);
    } finally {
        xshell._loader = originals.loader;
        xshell._services = originals.services;
        xshell._config = originals.config;
        xshell._modules = originals.modules;
        delete globalThis[marker];
    }
});
