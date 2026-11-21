export default {
    meta: {
        title: "Tasks",
        description: "Runs, observes, cancels, and inspects foreground and background Tasks."
    },

    style: `
        .actions {display:flex; flex-wrap:wrap; gap:.5em;}
        .task-list {display:grid; gap:.5em; padding:0; list-style:none;}
        .task-list li {display:flex; align-items:center; justify-content:space-between; gap:1em;}
        .output-entry {display:grid; grid-template-columns:4em minmax(0, 1fr); gap:.5em;}
        .output-entry pre {margin:0; white-space:pre-wrap; overflow-wrap:anywhere;}
    `,

    template: `
        <p>The <code>tasks</code> service creates stable Task handles for asynchronous work. Foreground and background Tasks share the same API;
        <code>background</code> controls ownership and global visibility.</p>

        <h2>Run simulated work</h2>
        <p class="actions">
            <x-button label="Start foreground Task" command="startForeground"></x-button>
            <x-button label="Start background Task" command="startBackground"></x-button>
            <x-button label="Cancel inspected Task" command="cancelCurrent"></x-button>
        </p>
        <x-code language="javascript" x-pre>const task = tasks.run({
    title: "Simulated operation",
    background: false,
    handler: async ({signal, setProgress, info}) =&gt; {
        signal.throwIfAborted();
        setProgress(1, 5);
        info("Step completed");
        return {message:"Finished"};
    }
});

await task.wait();
const result = await task.getResult();</x-code>

        <h2>Inspected Task</h2>
        <p x-if="!state.hasCurrent">Start a Task or inspect one from the registry.</p>
        <x-datafields x-if="state.hasCurrent" columns="2">
            <x-datafield label="Title">{{ state.currentTitle }}</x-datafield>
            <x-datafield label="Status">{{ state.currentStatus }}</x-datafield>
            <x-datafield label="Description">{{ state.currentDescription }}</x-datafield>
            <x-datafield label="Ownership">{{ state.currentMode }}</x-datafield>
            <x-datafield label="Duration">{{ state.currentDuration }}</x-datafield>
            <x-datafield label="Result">{{ state.currentResult }}</x-datafield>
        </x-datafields>
        <x-progress x-if="state.hasCurrent && state.currentProgress" x-prop:value="state.currentProgress.value" x-prop:max="state.currentProgress.max"></x-progress>
        <x-notice x-if="state.currentError" type="error" label="Task failed" x-attr:message="state.currentError"></x-notice>

        <h3>Output</h3>
        <p x-if="state.output.length == 0">No output has been recorded.</p>
        <div x-for="entry in state.output" class="output-entry">
            <strong>{{ entry.level }}</strong>
            <pre>{{ entry.text }}</pre>
        </div>

        <h2>Task registry</h2>
        <p><code>tasks.list()</code> includes both foreground and background Tasks. Use <code>tasks.get(id)</code> to retrieve one stable handle.</p>
        <p><x-button label="Refresh registry" command="refreshList"></x-button></p>
        <ul class="task-list">
            <li x-for="item in state.tasks" x-key="id">
                <span><strong>{{ item.title }}</strong> — {{ item.status }} ({{ item.mode }})</span>
                <x-button label="Inspect" command="inspect" x-attr:data-id="item.id"></x-button>
            </li>
        </ul>

        <h2>Cancellation and cleanup</h2>
        <p>Cancellation is cooperative: the handler observes its <code>AbortSignal</code>, and its timer clears immediately when aborted. Leaving this Page
        cancels a running foreground Task, while a background Task may continue; in both cases the Page detaches listeners and stops duration updates.</p>
        <p>Continue with <x-anchor href="08-commands.js">Commands</x-anchor> or <x-anchor href="09-temp.js">Temp</x-anchor>. Return to
        <x-anchor href="01-services.js">Services</x-anchor> for service discovery and injection.</p>
    `,

    state: {
        hasCurrent: false,
        currentTitle: "",
        currentStatus: "",
        currentDescription: "",
        currentMode: "",
        currentDuration: "",
        currentProgress: null,
        currentResult: "",
        currentError: "",
        output: [],
        tasks: []
    },

    controller({tasks, state, page}) {
        let alive = true;
        let currentTask = null;
        let taskListener = null;
        let durationInterval = null;
        let outputRevision = 0;

        const delay = (milliseconds, signal) => new Promise((resolve, reject) => {
            signal.throwIfAborted();
            const timeout = setTimeout(complete, milliseconds);

            function complete() {
                signal.removeEventListener("abort", cancel);
                resolve();
            }

            function cancel() {
                clearTimeout(timeout);
                reject(signal.reason ?? new DOMException("Task canceled", "AbortError"));
            }

            signal.addEventListener("abort", cancel, {once:true});
        });

        const snapshot = task => ({
            id: task.id,
            title: task.title,
            status: task.status,
            mode: task.background ? "background" : "foreground"
        });

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
            state.currentDuration = task.duration === null ? "Not started" : `${task.duration.toFixed(0)} ms`;
            page.invalidate?.();
            if (task.status !== "pending" && task.status !== "running") stopDuration();
        };

        const refresh = async task => {
            if (!alive || task !== currentTask) return;
            const revision = ++outputRevision;
            state.hasCurrent = true;
            state.currentTitle = task.title;
            state.currentStatus = task.status;
            state.currentDescription = task.description;
            state.currentMode = task.background ? "Background" : "Foreground";
            state.currentProgress = task.progress ? {...task.progress} : null;
            state.currentError = task.error?.message || "";
            refreshDuration(task);

            const output = await task.getOutput({limit:1000});
            if (!alive || task !== currentTask || revision !== outputRevision) return;
            state.output = output.entries.map(entry => ({level:entry.level, text:entry.text}));
            state.tasks = tasks.list().map(snapshot);

            if (task.status === "finished") {
                const result = await task.getResult();
                if (alive && task === currentTask) state.currentResult = JSON.stringify(result);
            } else if (task.status === "canceled") {
                state.currentResult = "Canceled before producing a result";
            } else if (task.status === "error") {
                state.currentResult = "No result";
            }
            if (task.status !== "pending" && task.status !== "running") detach();
            page.invalidate?.();
        };

        const attach = task => {
            detach();
            currentTask = task;
            state.currentResult = "Waiting for completion";
            taskListener = () => { void refresh(task); };
            task.addEventListener("change", taskListener);
            durationInterval = setInterval(() => refreshDuration(task), 100);
            void refresh(task);
        };

        const start = background => {
            const task = tasks.run({
                title: background ? "Background simulation" : "Foreground simulation",
                description: "Waiting to start",
                background,
                data: {steps:5},
                handler: async ({data, signal, setDescription, setProgress, log, info, warn, error}) => {
                    setProgress(0, data.steps);
                    log("Simulation started");
                    for (let step = 1; step <= data.steps; step++) {
                        signal.throwIfAborted();
                        setDescription(`Processing step ${step} of ${data.steps}`);
                        if (step === 2) info("The operation is progressing normally");
                        if (step === 3) warn("This warning is demonstration output");
                        if (step === 4) error("Error-level output does not fail a Task");
                        await delay(400, signal);
                        setProgress(step, data.steps);
                    }
                    setDescription("Simulation completed");
                    return {message:"Finished simulated work", steps:data.steps};
                }
            });
            attach(task);
            state.tasks = tasks.list().map(snapshot);
        };

        return {
            load() {
                state.tasks = tasks.list().map(snapshot);
            },
            unload() {
                alive = false;
                const task = currentTask;
                detach();
                currentTask = null;
                if (task && !task.background && (task.status === "pending" || task.status === "running")) void task.cancel();
            },
            startForeground() { start(false); },
            startBackground() { start(true); },
            refreshList() { state.tasks = tasks.list().map(snapshot); },
            inspect({id}) {
                const task = tasks.get(id);
                if (task) attach(task);
            },
            async cancelCurrent() {
                if (!currentTask || (currentTask.status !== "pending" && currentTask.status !== "running")) return;
                await currentTask.cancel();
                await currentTask.wait();
                await refresh(currentTask);
            }
        };
    }
};
