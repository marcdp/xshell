const TERMINAL_STATUSES = new Set(["finished", "error", "canceled"]);
const OUTPUT_PAGE_SIZE = 100;
const MAX_VISIBLE_OUTPUT = 500;

export default {
    contract: {
        description: "Inspect and manage an XShell Task.",
        events: {},
        properties: {
            id: {type: "string", default: "", state: true, query: true, description: "Identifier of the Task to inspect."}
        },
        methods: {}
    },
    meta: {
        title: "Task details",
        description: "Page for viewing and managing the details of an XShell Task."
    },
    style: `
        .actions {margin-bottom:.75em;}
        .description, .output-text {overflow-wrap:anywhere;}
        .output {max-height:25em;overflow:auto;}
        .output-entry {padding:.35em 0;border-bottom:var(--x-accordion-border);}
        .output-entry:last-child {border-bottom:0;}
        .output-text {white-space:pre-wrap;}
        .output-error {color:var(--x-color-error);}
        .output-warn {color:var(--x-notice-color-warning);}
    `,
    template: `
        <x-notice x-if="state.notice" type="info" x-prop:message="state.notice"></x-notice>
        <x-notice x-if="state.actionError" type="error" x-prop:message="state.actionError"></x-notice>

        <x-toolbar slot="header-actions" x-if="state.task">
            <x-button x-if="state.canCancel" label="Cancel task" icon="x-close" command="cancelTask" x-attr:disabled="state.cancelRequested"></x-button>
            <x-button x-if="state.canRemove" label="Remove task" icon="x-trash" command="removeTask"></x-button>
        </x-toolbar>

        <x-form x-if="state.task">
            
            <x-notice x-if="state.canCancel && state.cancelRequested" type="info" message="Cancellation requested."></x-notice>

            <x-datafields columns="2">
                <x-datafield label="ID" readonly columns="2"><span>{{ state.task.id }}</span></x-datafield>
                <x-datafield label="Title" readonly><span>{{ state.task.title }}</span></x-datafield>
                <x-datafield label="Description" readonly><span class="description">{{ state.task.description }}</span></x-datafield>
                <x-datafield label="Status" readonly><span>{{ state.task.status }}</span></x-datafield>
                <x-datafield label="Progress" readonly><span>{{ state.task.progressLabel }}</span></x-datafield>
                
            </x-datafields>
            <x-details label="Advanced">
                <x-datafields columns="2">
                    <x-datafield label="Background" readonly><span>{{ state.task.background }}</span></x-datafield>
                    <x-datafield label="Created" readonly>
                        <x-datetime x-prop:value="state.task.createdAt" format="datetime"></x-datetime>
                    </x-datafield>
                    <x-datafield label="Started" readonly>
                        <x-datetime x-if="state.task.startedAt" x-prop:value="state.task.startedAt" format="datetime"></x-datetime>
                        <span x-else>—</span>
                    </x-datafield>
                    <x-datafield label="Ended" readonly>
                        <x-datetime x-if="state.task.endedAt" x-prop:value="state.task.endedAt" format="datetime"></x-datetime>
                        <span x-else>—</span>
                    </x-datafield>
                    <x-datafield label="Duration" readonly>
                        <x-time-ms x-if="state.duration != null" x-prop:value="state.duration"></x-time-ms>
                        <span x-else>—</span>
                    </x-datafield>
                </x-datafields>
            </x-details>

            <x-notice x-if="state.task.error" type="error" x-prop:message="state.task.error.message"></x-notice>
            <x-object x-if="state.task.error" x-prop:value="state.task.error" expanded></x-object>

            <x-datafields label="Execution output">
                <x-notice x-if="state.outputError" type="error" x-prop:message="state.outputError"></x-notice>
                <p x-if="state.outputSkipped" class="muted">Some earlier output is no longer shown.</p>
                <p x-if="state.output.length == 0 && !state.outputLoading && !state.outputError">No output recorded.</p>
                <div class="output" x-if="state.output.length > 0">
                    <div class="output-entry" x-for="item in state.output" x-key="offset">
                        <div>
                            <x-datetime x-prop:value="item.timestamp" format="datetime"></x-datetime>
                            <strong>{{ item.level }}</strong>
                        </div>
                        <div class="output-text" x-class:output-error="item.level == 'error'" x-class:output-warn="item.level == 'warn'"
                            x-text="item.text"></div>
                    </div>
                </div>
            </x-datafields>
            <x-button slot="footer" x-if="state.hasMoreOutput || state.outputError" command="readOutput" x-attr:label="state.outputError ? 'Retry output' : 'Load more output'" x-attr:disabled="state.outputLoading"></x-button>
            <p x-if="state.outputLoading" class="muted">Loading output…</p>
            
        </x-form>
    `,
    state: {
        task: null,
        duration: null,
        canCancel: false,
        canRemove: false,
        cancelRequested: false,
        notice: "",
        actionError: "",
        output: [],
        outputLoading: false,
        outputError: "",
        outputSkipped: false,
        hasMoreOutput: false
    },
    controller({ state, tasks, bus, events, timer }) {
        let task, outputCursor;
        let alive = true, revision = 0, outputDirty = false;

        return {
            load() {
                // Scope updates and the shared duration/output tick to this Page's lifetime.
                events.on(state, "change:id", "inspectTask");
                events.on(bus, "xshell:tasks:updated", event => {
                    if (!task || event.detail?.id !== task.id) return;
                    this.refreshTask();
                    outputDirty = true;
                });
                events.on(bus, "xshell:tasks:removed", event => {
                    if (task && event.detail?.id === task.id) this.inspectTask();
                });
                timer.setInterval("tick", 1000);
                this.inspectTask();
            },

            inspectTask() {
                // Reset the view and invalidate requests for the previous Task.
                revision++;
                task = state.id ? tasks.get(state.id) : undefined;
                state.notice = task ? "" : state.id ? `Task '${state.id}' is unavailable.` : "No task ID was provided.";
                state.actionError = "";
                state.cancelRequested = false;
                outputCursor = undefined;
                state.output = [];
                state.outputError = "";
                state.outputSkipped = false;
                state.hasMoreOutput = false;
                outputDirty = !!task;
                this.refreshTask();
                if (task) void this.readOutput();
            },

            refreshTask() {
                // Project the live handle into render state and derive the available actions.
                const status = task?.status;
                const progress = task?.progress;
                state.task = task ? {
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    status,
                    progressLabel: progress ? `${Math.round(progress.value / progress.max * 100)}%`
                        : status === "running" ? "Indeterminate" : "—",
                    background: task.background ? "Yes" : "No",
                    createdAt: task.createdAt.toISOString(),
                    startedAt: task.startedAt?.toISOString(),
                    endedAt: task.endedAt?.toISOString(),
                    error: task.error
                } : null;
                state.duration = task?.duration ?? null;
                state.canCancel = status === "pending" || status === "running";
                state.canRemove = TERMINAL_STATUSES.has(status);
            },

            tick() {
                // Refresh elapsed time and coalesce output probes while caught up.
                if (task?.status === "running") state.duration = task.duration;
                if (outputDirty && !state.hasMoreOutput) void this.readOutput();
            },

            async readOutput() {
                // Advance a single forward cursor with at most one in-flight read.
                if (!alive || !task || state.outputLoading) return;
                const requestRevision = revision;
                const cursor = outputCursor;
                outputDirty = false;
                state.outputLoading = true;
                state.outputError = "";

                try {
                    const { entries, nextCursor } = await task.getOutput({ cursor, limit: OUTPUT_PAGE_SIZE });
                    if (!alive || requestRevision !== revision) return;

                    // The service clamps expired cursors to its oldest retained entry.
                    const start = Number(nextCursor) - entries.length;
                    state.outputSkipped ||= start > Number(cursor ?? 0) || state.output.length + entries.length > MAX_VISIBLE_OUTPUT;
                    if (entries.length) {
                        const page = entries.map((entry, index) => ({
                            ...entry, offset: start + index, timestamp: entry.timestamp.toISOString()
                        }));
                        state.output = [...state.output, ...page].slice(-MAX_VISIBLE_OUTPUT);
                    }
                    outputCursor = nextCursor;
                    state.hasMoreOutput = entries.length === OUTPUT_PAGE_SIZE;
                } catch (error) {
                    if (alive && requestRevision === revision) state.outputError = error?.message || String(error);
                } finally {
                    if (alive) {
                        state.outputLoading = false;
                        if (requestRevision !== revision && task) void this.readOutput();
                    }
                }
            },

            async cancelTask() {
                // Request cancellation once and let the Task report its terminal status.
                if (!task || (task.status !== "pending" && task.status !== "running") || state.cancelRequested) return;
                const requestRevision = revision;
                state.cancelRequested = true;
                state.actionError = "";
                try {
                    await task.cancel();
                } catch (error) {
                    if (alive && requestRevision === revision) {
                        state.cancelRequested = false;
                        state.actionError = error?.message || String(error);
                    }
                }
            },

            removeTask() {
                // Remove only terminal Tasks and confirm the removal in the current Page.
                if (!task || !TERMINAL_STATUSES.has(task.status)) return;
                const id = task.id;
                state.actionError = "";
                try {
                    tasks.remove(id);
                    if (task?.id === id) this.inspectTask();
                    state.notice = `Task '${id}' was removed.`;
                } catch (error) {
                    state.actionError = error?.message || String(error);
                }
            },

            unload() {
                // Ignore asynchronous results after the scoped Page resources are disposed.
                alive = false;
                task = undefined;
            }
        };
    }
};
