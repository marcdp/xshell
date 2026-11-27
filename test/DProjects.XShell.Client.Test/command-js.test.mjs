import assert from "node:assert/strict";
import test from "node:test";

import LoaderCommandJs from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/command-js.js";
import Logger from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/logger.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";
import {createThrowingLogger} from "./fixtures/throwing-logger.mjs";

let instanceId = 0;

function assertScopeActive(scope) {
    assert.doesNotThrow(() => scope.has("__test__"));
}

function assertScopeDisposed(scope) {
    assert.throws(() => scope.has("__test__"), /Services scope is disposed/);
}

function createRoot({disposed = [], scopedDispose} = {}) {
    const root = new Services({config: {xshell: {services: {}}}, bus: null});
    class Singleton {
        static optionsSchema = {type: "object", additionalProperties: false};
        constructor() { this.id = ++instanceId; }
        dispose() { throw new Error("Command scopes must not dispose singletons."); }
    }
    class Scoped {
        static optionsSchema = {type: "object", additionalProperties: false};
        constructor() { this.id = ++instanceId; }
        async dispose() { disposed.push(`scoped:${this.id}`); await scopedDispose?.(this); }
    }
    class Transient {
        static optionsSchema = {type: "object", additionalProperties: false};
        constructor() { this.id = ++instanceId; }
        async dispose() { disposed.push(`transient:${this.id}`); }
    }
    root.register("services", root);
    root.register("singleton", null, {implementationItem: {class: Singleton}});
    root.register("session", null, {lifetime: "scoped", implementationItem: {class: Scoped}});
    root.register("formatter", null, {lifetime: "transient", implementationItem: {class: Transient}});
    return root;
}

async function loadCommand(source, {root = createRoot(), module, moduleConfig, logger = new Logger({})} = {}) {
    const schema = {
        type: "object",
        required: ["contract", "controller"],
        properties: {contract: {type: "object"}, controller: {type: "object"}}
    };
    const context = {
        resourceName: "sample.command",
        resourceDefinition: {moduleId: "sample"},
        services: {
            logger,
            loader: {async load(id) { assert.equal(id, "schema:command"); return schema; }},
            config: {modules: {sample: moduleConfig ?? {id: "sample", src: "sample.jsonc"}}},
            modules: {getModuleById(id) { return id === "sample" ? module ?? {id: "sample"} : null; }},
            services: root
        }
    };
    const src = `data:text/javascript,${encodeURIComponent(source)}#${crypto.randomUUID()}`;
    return {Command: await new LoaderCommandJs().load(src, context), context, root};
}

test("Command instances own independent direct-root scopes and preserve controller injections", async () => {
    const disposed = [];
    const root = createRoot({disposed});
    const records = [];
    const hooks = {records};
    const ordinary = {
        loader: {name: "loader"},
        resolver: {name: "resolver"},
        tasks: new Tasks({logger: new Logger({}), bus: null})
    };
    root.register("hooks", hooks);
    for (const [name, service] of Object.entries(ordinary)) root.register(name, service);
    const module = {id: "sample"};
    const moduleConfig = {id: "sample", src: "sample.jsonc"};
    const {Command} = await loadCommand(`
        export default {
            contract: { label: "Example", tags: ["automation", "tasks"], execute: { parameters: [] } },
            controller(provider) {
                const record = {
                    definition: provider.definition,
                    context: provider.context,
                    task: provider.task,
                    module: provider.module,
                    moduleConfig: provider.moduleConfig,
                    services: provider.services,
                    loader: provider.loader,
                    resolver: provider.resolver,
                    tasks: provider.tasks,
                    singleton: provider.singleton,
                    session: provider.session,
                    repeatedSession: provider.session,
                    transients: [provider.formatter, provider.formatter],
                    symbol: provider[Symbol.toStringTag]
                };
                provider.hooks.records.push(record);
                return { execute(value) { return value; } };
            }
        };
    `, {root, module, moduleConfig});
    const invocationContexts = [
        {task: {id: "first"}, metadata: 1, services: {resolve() { throw new Error("Invocation Services must not own the Command scope."); }}},
        {task: {id: "second"}, metadata: 2}
    ];

    const commands = invocationContexts.map(context => new Command(context));

    assert.deepEqual(Command.contract.tags, ["automation", "tasks"]);
    assert.strictEqual(commands[0].contract, Command.contract);
    assert.equal(Object.isFrozen(Command.contract.tags), true);
    assert.equal(commands[0].execute(7), 7);
    assert.equal(records.length, 2);
    assert.notStrictEqual(records[0].services, records[1].services);
    assert.ok(records.every(record => record.services !== root && record.services.resolve("services") === root));
    assert.strictEqual(records[0].singleton, records[1].singleton);
    assert.strictEqual(records[0].session, records[0].repeatedSession);
    assert.notStrictEqual(records[0].session, records[1].session);
    assert.ok(records.every(record => record.transients[0] !== record.transients[1]));
    for (const [index, record] of records.entries()) {
        assert.strictEqual(record.context, invocationContexts[index]);
        assert.strictEqual(record.task, invocationContexts[index].task);
        assert.strictEqual(record.definition.contract, Command.contract);
        assert.strictEqual(record.module, module);
        assert.strictEqual(record.moduleConfig, moduleConfig);
        assert.strictEqual(record.loader, ordinary.loader);
        assert.strictEqual(record.resolver, ordinary.resolver);
        assert.strictEqual(record.tasks, ordinary.tasks);
        assert.equal(record.symbol, undefined);
    }
    records.forEach(record => assertScopeActive(record.services));
    assert.equal(ordinary.tasks.list().length, 0);

    await commands[0].dispose();
    assertScopeDisposed(records[0].services);
    assertScopeActive(records[1].services);
    await commands[1].dispose();

    assertScopeDisposed(records[1].services);
    assert.equal(disposed.filter(item => item.startsWith("scoped:")).length, 2);
    assert.equal(disposed.filter(item => item.startsWith("transient:")).length, 4);
    assert.strictEqual(commands[0].controller, null);
    assert.strictEqual(commands[0]._servicesScope, null);
});

test("Command constructor failure initiates owned-scope cleanup and preserves the construction error", async t => {
    const disposed = [];
    const cleanupError = new Error("constructor cleanup failed");
    const root = createRoot({disposed, scopedDispose() { throw cleanupError; }});
    const constructionError = new Error("controller failed");
    const {logger, calls: {error}} = await createThrowingLogger(t);
    root.register("hooks", {constructionError});
    const {Command} = await loadCommand(`
        export default {
            contract: { label: "Failure", execute: { parameters: [] } },
            controller(provider) {
                provider.session;
                throw provider.hooks.constructionError;
            }
        };
    `, {root, logger});

    assert.throws(() => new Command({task: {}}), error => error === constructionError);
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(disposed.filter(item => item.startsWith("scoped:")).length, 1);
    assert.equal(error.mock.callCount(), 1);
    assert.deepEqual(error.mock.calls[0].arguments, ["Commands: disposal failed", {commandId: "sample.command", moduleId: "sample", stage: "construction"}]);
});

test("Command.dispose propagates cleanup failure while clearing owned references", async () => {
    const disposalError = new Error("scope disposal failed");
    const root = createRoot({scopedDispose() { throw disposalError; }});
    const {Command} = await loadCommand(`
        export default {
            contract: { label: "Disposal", execute: { parameters: [] } },
            controller(provider) {
                provider.session;
                return { execute() { return true; } };
            }
        };
    `, {root});
    const command = new Command();

    await assert.rejects(command.dispose(), error => error === disposalError);

    assert.strictEqual(command.controller, null);
    assert.strictEqual(command._servicesScope, null);
    await command.dispose();
});
