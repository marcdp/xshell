
const TERMINAL_STATUSES = new Set(["finished", "error", "canceled"]);
const OUTPUT_PAGE_SIZE = 1000;
const MAX_VISIBLE_OUTPUT = 500;

export default {
    contract: {
        description: "Inspect an XShell Task and its execution result.",
        events: {},
        properties: {
            id: {type:"string", default:"", state:true, query:true, description:"Task identifier."}
        },
        methods: {}
    },

    meta: {
        title: "Task details"
    },

    style: `
        .task x-progress {margin-top:.9em; width:33%;}
        .duration {color:var(--x-color-text-gray);}

        .output-controls {display:flex; margin-top:.75em; margin-bottom:.25em;}
        .output-entries {
            margin-top:1em;
            background:rgba(0,0,0,0.25);
            padding:.5em 1em;
            max-height:50vh;
            overflow:auto;
            border-radius:.5em;
        }
        .output-entry {
            font-family:monospace;
            display:grid;
            grid-template-columns:13.5em 3.5em minmax(0, 1fr);
            gap:.25em;
            align-items:start;
        }
        .output-entry.warn strong, .output-entry.warn pre {
            color:var(--x-notice-color-warning);
        }
        .output-entry.error strong, .output-entry.error pre {
            color:var(--x-datafield-error-color);
        }
        .output-entry pre {
            margin:0;
            white-space:pre-wrap;
            overflow-wrap:anywhere;
        }

        .result {margin-top:1.25em;}
        .result-value {white-space:pre-wrap; overflow-wrap:anywhere;}
        .description {overflow-wrap:anywhere;}
    `,

    template: `
        <x-notice x-if="state.notice" type="info" x-prop:message="state.notice"></x-notice>
        <x-notice x-if="state.actionError" type="error" x-prop:message="state.actionError"></x-notice>

        <x-toolbar slot="header-actions" x-if="state.ready">
            <x-button x-if="state.running"
                label="Cancel task" icon="x-close" command="cancelTask"
                x-attr:disabled="state.cancelRequested"></x-button>
            <x-button x-if="state.canRemove"
                label="Remove task" icon="x-trash" command="removeTask"></x-button>
        </x-toolbar>

        <section x-if="state.ready" class="task">

            <x-datafields label="Execution">
                <x-notice
                    x-attr:type="state.taskNoticeType"
                    x-attr:label="state.taskNoticeLabel"
                    x-attr:message="state.taskError ? state.taskError.message : state.taskDescription">

                    <x-progress x-if="state.running"
                        x-attr:unknown="state.taskProgress ? false : true"
                        x-attr:value="state.taskProgress.value"
                        x-attr:max="state.taskProgress.max"></x-progress>

                    <span x-else class="duration">
                        Process finished in <span x-text="state.taskDurationText"></span>
                    </span>

                    <div x-if="state.hasHiddenOutput" class="output-controls">
                        <x-button class="anchor"
                            command="toggleOutput"
                            x-attr:label="state.showAllOutput ? 'Show warnings and errors -' : 'Show all output +'">
                        </x-button>
                    </div>

                    <div x-if="state.visibleTaskOutput.length > 0" class="output-entries">
                        <div x-for="entry in state.visibleTaskOutput"
                            x-key="offset"
                            x-attr:class="'output-entry ' + entry.level">
                            <span x-text="entry.timestamp"></span>
                            <strong x-text="entry.level"></strong>
                            <pre x-text="entry.text"></pre>
                        </div>
                    </div>

                    <p x-if="state.outputSkipped">
                        Some earlier output is no longer displayed.
                    </p>

                    <x-notice x-if="state.outputError"
                        type="error" x-prop:message="state.outputError"></x-notice>
                </x-notice>
            </x-datafields>

            <x-datafields label="Result" x-if="state.completed" class="result">
                <x-notice x-if="state.resultError"
                    type="error" x-prop:message="state.resultError"></x-notice>

                <p x-if="!state.hasResult && !state.resultError">
                    No result returned.
                </p>

                <x-object x-if="state.hasResult && state.resultIsObject"
                    x-prop:value="state.result" expanded></x-object>

                <x-code x-if="state.hasResult && !state.resultIsObject"
                    x-prop:value="state.resultText" wrap></x-code>
            </x-datafields>

            <x-details label="Advanced">
                <x-datafields columns="2">
                    <x-datafield label="ID" readonly columns="2">
                        <span>{{ state.taskId }}</span>
                    </x-datafield>
                    <x-datafield label="Title" readonly>
                        <span>{{ state.taskTitle }}</span>
                    </x-datafield>
                    <x-datafield label="Description" readonly>
                        <span class="description">{{ state.taskDescription }}</span>
                    </x-datafield>
                    <x-datafield label="Status" readonly>
                        <span>{{ state.taskStatus }}</span>
                    </x-datafield>
                    <x-datafield label="Background" readonly>
                        <span>{{ state.taskBackground }}</span>
                    </x-datafield>
                    <x-datafield label="Created" readonly>
                        <x-datetime x-prop:value="state.createdAt" format="datetime"></x-datetime>
                    </x-datafield>
                    <x-datafield label="Started" readonly>
                        <x-datetime x-if="state.startedAt"
                            x-prop:value="state.startedAt" format="datetime"></x-datetime>
                        <span x-else>—</span>
                    </x-datafield>
                    <x-datafield label="Ended" readonly>
                        <x-datetime x-if="state.endedAt"
                            x-prop:value="state.endedAt" format="datetime"></x-datetime>
                        <span x-else>—</span>
                    </x-datafield>
                    <x-datafield label="Duration" readonly>
                        <x-time-ms x-if="state.taskDuration != null"
                            x-prop:value="state.taskDuration"></x-time-ms>
                        <span x-else>—</span>
                    </x-datafield>
                </x-datafields>

                <x-object x-if="state.taskError"
                    x-prop:value="state.taskError" expanded></x-object>
            </x-details>

        </section>
    `,

    state: {
        ready: false,
        notice: "",
        actionError: "",
        cancelRequested: false,
        canRemove: false,

        taskId: "",
        taskTitle: "",
        taskDescription: "",
        taskBackground: "",
        taskStatus: "",
        taskProgress: null,
        taskDuration: null,
        taskDurationText: "",
        taskError: null,

        createdAt: null,
        startedAt: null,
        endedAt: null,

        running: false,
        completed: false,
        taskNoticeType: "",
        taskNoticeLabel: "",

        taskOutput: [],
        visibleTaskOutput: [],
        showAllOutput: false,
        hasHiddenOutput: false,
        outputSkipped: false,
        outputError: "",

        hasResult: false,
        result: null,
        resultText: "",
        resultIsObject: false,
        resultError: ""
    },

    controller({state, tasks, events, timer, page}) {
        let currentTask = null;
        let alive = true;
        let revision = 0;
        let outputCursor;
        let outputReading = false;
        let outputDirty = false;
        let resultRequested = false;

        return {
            load() {
                // Observe task selection and start the duration refresh timer
                events.on(state, "change:id", "inspectTask");
                timer.setInterval("tick", 250);
                this.inspectTask();
            },

            inspectTask() {
                // Reset the view when the inspected task changes
                revision++;
                currentTask = state.id ? tasks.get(state.id) : null;
                const task = currentTask;

                state.ready = !!task;
                state.notice = task ? "" : state.id
                    ? `Task '${state.id}' is unavailable.`
                    : "No task ID was provided.";

                state.actionError = "";
                state.cancelRequested = false;
                state.showAllOutput = false;
                state.taskOutput = [];
                state.visibleTaskOutput = [];
                state.hasHiddenOutput = false;
                state.outputSkipped = false;
                state.outputError = "";

                state.hasResult = false;
                state.result = null;
                state.resultText = "";
                state.resultIsObject = false;
                state.resultError = "";

                outputCursor = undefined;
                outputDirty = !!task;
                resultRequested = false;

                if (!task) return;

                // Listen to the live Task without introducing a new Bus dependency
                events.on(task, "change", () => {
                    if (!alive || currentTask !== task) return;
                    this.refreshTask();
                    outputDirty = true;
                    void this.readOutput();
                });

                this.refreshTask();
                void this.readOutput();
                page.label = task.title;
            },

            refreshTask() {
                // Project the Task's current lifecycle information into Page state
                const task = currentTask;
                if (!alive || !task) return;

                const status = task.status;
                const duration = task.duration;

                state.taskId = task.id;
                state.taskTitle = task.title;
                state.taskDescription = task.description;
                state.taskBackground = task.background ? "Yes" : "No";
                state.taskStatus = status;
                state.taskProgress = task.progress ? {...task.progress} : null;
                state.taskDuration = duration;
                state.taskDurationText = duration === null ? "—" : `${duration.toFixed(2)} ms`;
                state.taskError = task.error ? {...task.error} : null;

                state.createdAt = task.createdAt;
                state.startedAt = task.startedAt;
                state.endedAt = task.endedAt;

                state.running = status === "pending" || status === "running";
                state.completed = status === "finished";
                state.canRemove = TERMINAL_STATUSES.has(status);

                state.taskNoticeType = status === "finished" ? "success"
                    : status === "error" ? "error"
                    : status === "canceled" ? "warning"
                    : "working";

                state.taskNoticeLabel = status === "finished" ? "Completed"
                    : status === "error" ? "Failed"
                    : status === "canceled" ? "Canceled"
                    : status === "pending" ? "Pending"
                    : "Executing";

                // Retrieve the result only after successful completion
                if (status === "finished" && !resultRequested) {
                    void this.readResult();
                }
            },

            tick() {
                // Keep the running duration current
                if (!alive || !currentTask) return;

                if (state.running) {
                    const duration = currentTask.duration;
                    state.taskDuration = duration;
                    state.taskDurationText = duration === null ? "—" : `${duration.toFixed(2)} ms`;
                    page.invalidate();
                }

                if (outputDirty) void this.readOutput();
            },

            async readOutput() {
                // Drain retained output using the Task's forward cursor
                if (!alive || !currentTask || outputReading) return;

                const task = currentTask;
                const requestRevision = revision;
                outputReading = true;
                outputDirty = false;
                state.outputError = "";

                try {
                    while (alive && currentTask === task && requestRevision === revision) {
                        const cursor = outputCursor;
                        const result = await task.getOutput({
                            cursor,
                            limit: OUTPUT_PAGE_SIZE
                        });

                        if (!alive || currentTask !== task || requestRevision !== revision) return;

                        const start = Number(result.nextCursor) - result.entries.length;
                        if (cursor !== undefined && start > Number(cursor)) {
                            state.outputSkipped = true;
                        }

                        // Append new entries and retain only the most recent output
                        if (result.entries.length) {
                            const entries = result.entries.map((entry, index) => ({
                                offset: start + index,
                                timestamp: entry.timestamp.toLocaleTimeString(),
                                level: entry.level,
                                text: entry.text
                            }));

                            if (state.taskOutput.length + entries.length > MAX_VISIBLE_OUTPUT) {
                                state.outputSkipped = true;
                            }

                            state.taskOutput = [
                                ...state.taskOutput,
                                ...entries
                            ].slice(-MAX_VISIBLE_OUTPUT);

                            this.updateOutputVisibility();
                        }

                        outputCursor = result.nextCursor;

                        if (result.entries.length < OUTPUT_PAGE_SIZE) break;
                    }
                } catch (error) {
                    if (alive && currentTask === task && requestRevision === revision) {
                        state.outputError = error?.message || String(error);
                    }
                } finally {
                    outputReading = false;

                    // Process updates that arrived while the previous read was active
                    if (alive && outputDirty && currentTask && !state.outputError) {
                        void this.readOutput();
                    }
                }
            },

            updateOutputVisibility() {
                // Show warnings and errors by default, as in x/pages/invoke.js
                state.hasHiddenOutput = state.taskOutput.some(
                    entry => entry.level !== "warn" && entry.level !== "error"
                );

                state.visibleTaskOutput = state.showAllOutput
                    ? state.taskOutput
                    : state.taskOutput.filter(
                        entry => entry.level === "warn" || entry.level === "error"
                    );
            },

            toggleOutput() {
                // Switch between filtered and complete execution logs
                state.showAllOutput = !state.showAllOutput;
                this.updateOutputVisibility();
            },

            async readResult() {
                // Retrieve the completed Task result once
                const task = currentTask;
                if (!alive || !task || task.status !== "finished" || resultRequested) return;

                const requestRevision = revision;
                resultRequested = true;

                try {
                    const result = await task.getResult();
                    if (!alive || currentTask !== task || requestRevision !== revision) return;

                    state.hasResult = result !== undefined;

                    if (result === undefined) return;

                    // Render structured values with x-object and scalar values with x-code
                    if (result !== null && typeof result === "object") {
                        if (result instanceof Blob) {
                            state.resultIsObject = true;
                            state.result = {
                                type: result.type || "application/octet-stream",
                                size: result.size,
                                filename: result instanceof File ? result.name : null
                            };
                        } else {
                            state.resultIsObject = true;
                            state.result = result;
                        }
                    } else {
                        state.resultIsObject = false;
                        state.resultText = String(result);
                    }
                } catch (error) {
                    if (alive && currentTask === task && requestRevision === revision) {
                        state.resultError = error?.message || String(error);
                    }
                }
            },

            async cancelTask() {
                // Request cooperative cancellation of an active Task
                const task = currentTask;
                if (!task || !state.running || state.cancelRequested) return;

                const requestRevision = revision;
                state.cancelRequested = true;
                state.actionError = "";

                try {
                    await task.cancel();
                } catch (error) {
                    if (alive && currentTask === task && requestRevision === revision) {
                        state.actionError = error?.message || String(error);
                        state.cancelRequested = false;
                    }
                }
            },

            removeTask() {
                // Remove a terminal Task from the service registry
                const task = currentTask;
                if (!task || !TERMINAL_STATUSES.has(task.status)) return;

                try {
                    tasks.remove(task.id);
                    this.inspectTask();
                    state.notice = `Task '${task.id}' was removed.`;
                } catch (error) {
                    state.actionError = error?.message || String(error);
                }
            },

            unload() {
                // Invalidate pending asynchronous updates
                alive = false;
                revision++;
                currentTask = null;
            }
        };
    }
};
