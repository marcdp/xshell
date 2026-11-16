import assert from "node:assert/strict";
import test from "node:test";

import commandDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/commands/demo-operation.js";
import commandsPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/pages/90-advanced/08-commands.js";
import tasksPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/pages/90-advanced/07-tasks.js";
import tempPage from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/pages/90-advanced/09-temp.js";
import commandSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/command.schema.json" with {type:"json"};
import contractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with {type:"json"};
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Tasks from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/tasks.js";

const cloneState = definition => structuredClone(definition.state);
const turn = () => new Promise(resolve => setImmediate(resolve));

test("demo Command follows the Command schema and cooperatively cancels its pending timer", async () => {
    const validation = new JsonValidator().validate(
        {...commandDefinition, controller:{}},
        commandSchema,
        {"./contract.schema.json":contractSchema}
    );
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
    assert.equal(typeof commandDefinition.controller, "function");

    const tasks = new Tasks({bus:null});
    const task = tasks.run({
        title: "Demo operation",
        background: false,
        handler: context => commandDefinition.controller({task:context}).execute(10, false)
    });
    await turn();
    await task.cancel();
    await task.wait();

    assert.equal(task.status, "canceled");
    await assert.rejects(task.getResult(), error => error?.name === "AbortError");
});

test("Tasks Page runs, lists, inspects, and cancels a real foreground Task", async () => {
    const tasks = new Tasks({bus:null});
    const state = cloneState(tasksPage);
    const controller = tasksPage.controller({tasks, state, page:{invalidate() {}}});

    controller.load();
    controller.startForeground();
    await turn();

    assert.equal(tasks.list().length, 1);
    assert.equal(state.hasCurrent, true);
    assert.equal(state.currentMode, "Foreground");
    assert.equal(state.tasks[0].id, tasks.list()[0].id);

    await controller.cancelCurrent();
    assert.equal(state.currentStatus, "canceled");
    assert.match(state.currentResult, /Canceled/);
    controller.unload();
});

test("Commands Page passes named arguments and distinguishes validation from Task execution", async () => {
    const tasks = new Tasks({bus:null});
    const calls = [];
    const commands = {
        async run(options) {
            calls.push(options);
            if (options.args.steps < 1) throw new Error("Invalid argument 'steps'");
            return tasks.run({
                title: "Demo operation",
                background: options.background,
                handler: async context => {
                    context.setProgress(1, 1);
                    context.info("Executed");
                    if (options.args.fail) throw new Error("execution failed");
                    return {steps:options.args.steps};
                }
            });
        }
    };
    const state = cloneState(commandsPage);
    const controller = commandsPage.controller({commands, state, page:{invalidate() {}}});

    await controller.runSuccess();
    assert.deepEqual(calls[0], {
        id:"demo-operation",
        args:{steps:5, fail:false},
        background:false
    });
    assert.equal(state.status, "finished");
    assert.equal(state.result, '{"steps":5}');
    assert.deepEqual(state.output, [{level:"info", text:"Executed"}]);

    await controller.runInvalid();
    assert.match(state.requestError, /Invalid argument/);

    await controller.runFailure();
    assert.equal(state.status, "error");
    assert.equal(state.executionError, "execution failed");
    assert.equal(state.result, "No result");
    controller.unload();
});

test("Temp Page reports per-file progress, identifiers, URLs, and upload errors", async () => {
    const progressCalls = [];
    const temp = {
        async upload(files, onProgress) {
            assert.deepEqual(files.map(file => file.name), ["ok.txt", "bad.txt"]);
            onProgress({name:"ok.txt", loaded:5, total:10, percent:50});
            progressCalls.push("reported");
            return ["temp:/folder/ok.txt", "error: Upload failed"];
        },
        getAbsoluteUrl(reference) {
            return `https://example.test/temp/${reference.substring(6)}`;
        }
    };
    const state = cloneState(tempPage);
    const controller = tempPage.controller({temp, state});

    controller.selectFiles({event:{currentTarget:{files:[{name:"ok.txt"}, {name:"bad.txt"}]}}});
    await controller.upload();

    assert.deepEqual(progressCalls, ["reported"]);
    assert.equal(state.uploads[0].progress, 100);
    assert.equal(state.uploads[0].reference, "temp:/folder/ok.txt");
    assert.equal(state.uploads[0].url, "https://example.test/temp/folder/ok.txt");
    assert.equal(state.uploads[1].status, "Failed");
    assert.equal(state.uploads[1].error, "Upload failed");
    controller.unload();
});
