export default {
    meta: {
        title: "Commands",
        description: "Runs a real Command through the Commands service and observes its returned Task."
    },

    style: `
        .actions {display:flex; flex-wrap:wrap; gap:.5em;}
        .output-entry {display:grid; grid-template-columns:4em minmax(0, 1fr); gap:.5em;}
        .output-entry pre {margin:0; white-space:pre-wrap; overflow-wrap:anywhere;}
    `,

    template: `
        <p>The <code>commands</code> service resolves a Command, validates named arguments, and uses <code>tasks.run()</code> for execution. It returns the
        live Task handle rather than introducing a second execution lifecycle.</p>

        <h2>Run the demo Command</h2>
        <p class="actions">
            <x-button label="Run successfully" command="runSuccess"></x-button>
            <x-button label="Pass invalid arguments" command="runInvalid"></x-button>
            <x-button label="Trigger execution error" command="runFailure"></x-button>
            <x-button label="Cancel execution" command="cancel"></x-button>
        </p>
        <pre x-pre><code>const task = await commands.run({
    id: "demo-operation",
    args: {steps: 5, fail: false},
    background: false
});

await task.wait();
const result = await task.getResult();</code></pre>
        <x-notice x-if="state.requestError" type="error" label="Command request rejected" x-attr:message="state.requestError"></x-notice>

        <h2>Returned Task</h2>
        <p x-if="!state.hasTask">Run the Command to receive and inspect its Task.</p>
        <x-datafields x-if="state.hasTask" columns="2">
            <x-datafield label="Status">{{ state.status }}</x-datafield>
            <x-datafield label="Description">{{ state.description }}</x-datafield>
            <x-datafield label="Duration">{{ state.duration }}</x-datafield>
            <x-datafield label="Result">{{ state.result }}</x-datafield>
        </x-datafields>
        <x-progress x-if="state.progress" x-prop:value="state.progress.value" x-prop:max="state.progress.max"></x-progress>
        <x-notice x-if="state.executionError" type="error" label="Execution failed" x-attr:message="state.executionError"></x-notice>

        <h3>Command output</h3>
        <p x-if="state.output.length == 0">No output has been recorded.</p>
        <div x-for="entry in state.output" class="output-entry">
            <strong>{{ entry.level }}</strong>
            <pre>{{ entry.text }}</pre>
        </div>

        <h2>Validation versus execution errors</h2>
        <p>Invalid named arguments reject <code>commands.run()</code> before a Task is created. An exception from <code>execute()</code> is instead captured by
        the returned Task, whose status becomes <code>error</code>. Successful results are retrieved with <code>task.getResult()</code>.</p>
        <p>This focused example calls <code>commands.run()</code> directly; the generic Command invocation Page remains the reusable schema-driven UI.</p>
        <p>Compare this with <x-anchor href="07-tasks.js">Tasks</x-anchor> and <x-anchor href="09-temp.js">Temp</x-anchor>. Return to
        <x-anchor href="01-services.js">Services</x-anchor> for the shared service model.</p>
    `,

    state: {
        hasTask: false,
        status: "",
        description: "",
        duration: "",
        progress: null,
        output: [],
        result: "",
        requestError: "",
        executionError: ""
    },

    controller({commands, state, page}) {
        let alive = true;
        let currentTask = null;
        let taskListener = null;
        let durationInterval = null;
        let outputRevision = 0;

        const stopDuration = () => {
            if (durationInterval !== null) clearInterval(durationInterval);
            durationInterval = null;
        };

        const detach = () => {
            stopDuration();
            if (currentTask && taskListener) currentTask.removeEventListener("change", taskListener);
            taskListener = null;
        };

        const refreshDuration = task => {
            if (!alive || task !== currentTask) return;
            state.duration = task.duration === null ? "Not started" : `${task.duration.toFixed(0)} ms`;
            page.invalidate?.();
            if (task.status !== "pending" && task.status !== "running") stopDuration();
        };

        const refresh = async task => {
            if (!alive || task !== currentTask) return;
            const revision = ++outputRevision;
            state.hasTask = true;
            state.status = task.status;
            state.description = task.description;
            state.progress = task.progress ? {...task.progress} : null;
            state.executionError = task.error?.message || "";
            refreshDuration(task);

            const output = await task.getOutput({limit:1000});
            if (!alive || task !== currentTask || revision !== outputRevision) return;
            state.output = output.entries.map(entry => ({level:entry.level, text:entry.text}));
            if (task.status !== "pending" && task.status !== "running") detach();
            page.invalidate?.();
        };

        const attach = task => {
            detach();
            currentTask = task;
            state.result = "Waiting for completion";
            taskListener = () => { void refresh(task); };
            task.addEventListener("change", taskListener);
            durationInterval = setInterval(() => refreshDuration(task), 100);
            void refresh(task);
        };

        const run = async fail => {
            state.requestError = "";
            state.executionError = "";
            state.output = [];
            state.result = "";

            try {
                const task = await commands.run({
                    id: "demo-operation",
                    args: {steps:5, fail},
                    background: false
                });
                if (!alive) {
                    if (!task.background) void task.cancel();
                    return;
                }

                attach(task);
                await task.wait();
                await refresh(task);
                if (!alive || task !== currentTask) return;

                if (task.status === "finished") {
                    state.result = JSON.stringify(await task.getResult());
                } else if (task.status === "canceled") {
                    state.result = "Canceled before producing a result";
                } else {
                    state.result = "No result";
                }
            } catch (error) {
                if (alive) state.requestError = error?.message || String(error);
            }
        };

        return {
            unload() {
                alive = false;
                const task = currentTask;
                detach();
                currentTask = null;
                if (task && !task.background && (task.status === "pending" || task.status === "running")) void task.cancel();
            },
            runSuccess() { return run(false); },
            runFailure() { return run(true); },
            async runInvalid() {
                state.requestError = "";
                try {
                    await commands.run({
                        id: "demo-operation",
                        args: {steps:0, fail:false},
                        background: false
                    });
                } catch (error) {
                    if (alive) state.requestError = error?.message || String(error);
                }
            },
            async cancel() {
                if (!currentTask || (currentTask.status !== "pending" && currentTask.status !== "running")) return;
                await currentTask.cancel();
                await currentTask.wait();
                await refresh(currentTask);
            }
        };
    }
};
