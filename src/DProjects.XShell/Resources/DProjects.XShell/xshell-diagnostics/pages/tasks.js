
 // page
export default {
    contract: {
        description: "Inspect and manage XShell runtime tasks.",
        events: {},
        properties: {},
        methods: {}
    },

    meta: {
        title: "Tasks"
    },

    style: `
        .summary {margin-bottom:1em;}
        .actions {margin-bottom:.75em;}
        .details {margin-top:1.5em;}
        .details x-datafields {margin-bottom:1em;}
        .description {overflow-wrap:anywhere;}
        .output {max-height:25em;overflow:auto;}
        .output-entry {padding:.35em 0;border-bottom:1px solid var(--x-color-border);}
        .output-entry:last-child {border-bottom:0;}
        .output-text {white-space:pre-wrap;overflow-wrap:anywhere;}
        .output-error {color:var(--x-color-error);}
        .output-warn {color:var(--x-color-warning);}
    `,

    template: `
        <p>Shows registered XShell tasks, execution progress, errors, and output.</p>

        <div class="summary">
            <x-datafields>
                <x-datafield label="Total" readonly>
                    <span>{{ state.total }}</span>
                </x-datafield>
                <x-datafield label="Running" readonly>
                    <span>{{ state.running }}</span>
                </x-datafield>
                <x-datafield label="Finished" readonly>
                    <span>{{ state.finished }}</span>
                </x-datafield>
                <x-datafield label="Failed" readonly>
                    <span>{{ state.failed }}</span>
                </x-datafield>
                <x-datafield label="Canceled" readonly>
                    <span>{{ state.canceled }}</span>
                </x-datafield>
            </x-datafields>
        </div>

        <x-toolbar class="actions">
            <x-button label="Refresh" icon="x-refresh" command="refresh"></x-button>
            <x-button label="Clear completed" icon="x-clear" command="clear"
                x-attr:disabled="!state.hasTerminal"></x-button>
            <x-button label="Cancel selected" icon="x-close" command="cancelSelected"
                x-attr:disabled="!state.canCancel"></x-button>
        </x-toolbar>

        <x-notice type="error" x-if="state.error">
            {{ state.error }}
        </x-notice>

        <x-listview view="details" x-on:select="selectTask" x-on:activate="selectTask">
            <x-listview-head>
                <x-listview-column width="16em">
                    <x-datafield type="search" x-model="state.query_title"
                        placeholder="Task title"></x-datafield>
                </x-listview-column>
                <x-listview-column>
                    <x-datafield type="search" x-model="state.query_description"
                        placeholder="Description"></x-datafield>
                </x-listview-column>
                <x-listview-column width="9em">
                    <x-datafield type="search" x-model="state.query_status"
                        placeholder="Status"></x-datafield>
                </x-listview-column>
                <x-listview-column label="Progress" width="9em"></x-listview-column>
                <x-listview-column label="Duration" width="7em"></x-listview-column>
                <x-listview-column label="Background" width="7em"></x-listview-column>
                <x-listview-column label="Created" width="12em"></x-listview-column>
            </x-listview-head>

            <x-listview-body>
                <x-listview-item x-for="item in state.items"
                    x-attr:label="item.title"
                    x-attr:description="item.description"
                    x-attr:path="item.id"
                    x-attr:icon="item.icon"
                    x-attr:selected="item.id == state.selectedId">

                    <div class="description">{{ item.description }}</div>
                    <div>{{ item.status }}</div>
                    <div>{{ item.progressLabel }}</div>
                    <div><x-time-ms x-prop:value="item.duration"></x-time-ms></div>
                    <div>{{ item.background }}</div>
                    <div><x-datetime x-prop:value="item.createdAt"></x-datetime></div>
                </x-listview-item>
            </x-listview-body>
        </x-listview>

        <div class="details" x-if="state.selected">
            <x-datafields label="Task details">
                <x-datafield label="ID" readonly>
                    <span>{{ state.selected.id }}</span>
                </x-datafield>
                <x-datafield label="Title" readonly>
                    <span>{{ state.selected.title }}</span>
                </x-datafield>
                <x-datafield label="Description" readonly>
                    <span>{{ state.selected.description }}</span>
                </x-datafield>
                <x-datafield label="Status" readonly>
                    <span>{{ state.selected.status }}</span>
                </x-datafield>
                <x-datafield label="Progress" readonly>
                    <span>{{ state.selected.progressLabel }}</span>
                </x-datafield>
                <x-datafield label="Background" readonly>
                    <span>{{ state.selected.background }}</span>
                </x-datafield>
                <x-datafield label="Created" readonly>
                    <x-datetime x-prop:value="state.selected.createdAt"></x-datetime>
                </x-datafield>
                <x-datafield label="Started" readonly>
                    <x-datetime x-if="state.selected.startedAt"
                        x-prop:value="state.selected.startedAt"></x-datetime>
                </x-datafield>
                <x-datafield label="Ended" readonly>
                    <x-datetime x-if="state.selected.endedAt"
                        x-prop:value="state.selected.endedAt"></x-datetime>
                </x-datafield>
                <x-datafield label="Duration" readonly>
                    <x-time-ms x-prop:value="state.selected.duration"></x-time-ms>
                </x-datafield>
            </x-datafields>

            <x-notice type="error" x-if="state.selected.error">
                {{ state.selected.error.message }}
            </x-notice>

            <x-object x-if="state.selected.error"
                x-prop:value="state.selected.error" expanded="true"></x-object>

            <x-toolbar>
                <x-button label="Refresh output" icon="x-refresh"
                    command="refreshOutput"></x-button>
                <x-button label="Cancel task" icon="x-close" command="cancelSelected"
                    x-attr:disabled="!state.canCancel"></x-button>
                <x-button label="Remove task" icon="x-clear" command="removeSelected"
                    x-attr:disabled="!state.canRemove"></x-button>
            </x-toolbar>

            <x-datafields label="Execution output">
                <p x-if="state.output.length == 0">No output recorded.</p>

                <div class="output" x-else>
                    <div class="output-entry" x-for="item in state.output">
                        <div>
                            <x-datetime x-prop:value="item.timestamp"></x-datetime>
                            <strong>{{ item.level }}</strong>
                        </div>
                        <div class="output-text"
                            x-class:output-error="item.level == 'error'"
                            x-class:output-warn="item.level == 'warn'">
                            {{ item.text }}
                        </div>
                    </div>
                </div>

                <x-button x-if="state.hasMoreOutput"
                    label="Load more output" command="loadMoreOutput"
                    x-attr:disabled="state.outputLoading"></x-button>
            </x-datafields>
        </div>
    `,

    state: {
        query_title: "",
        query_description: "",
        query_status: "",
        items: [],
        total: 0,
        running: 0,
        finished: 0,
        failed: 0,
        canceled: 0,
        hasTerminal: false,
        selectedId: "",
        selected: null,
        canCancel: false,
        canRemove: false,
        output: [],
        outputCursor: null,
        outputLoading: false,
        hasMoreOutput: false,
        error: ""
    },

    controller({ state, events, bus, tasks, timer }) {
        const TERMINAL = new Set(["finished", "error", "canceled"]);
        const OUTPUT_PAGE_SIZE = 100;
        const MAX_VISIBLE_OUTPUT = 500;
        let outputRevision = 0;

        return {
            load() {
                // Initialize task filters
                events.on(state, "change:query_title", "refresh");
                events.on(state, "change:query_description", "refresh");
                events.on(state, "change:query_status", "refresh");

                // Subscribe to task lifecycle events
                events.on(bus, "xshell:tasks:added", "refresh");
                events.on(bus, "xshell:tasks:removed", "refresh");
                events.on(bus, "xshell:tasks:updated", ({detail}) => {
                    this.refresh();
                    if (detail.id === state.selectedId) this.refreshOutput();
                });

                // Refresh the duration of running tasks
                timer.setInterval("refresh", 1000);

                // Load the initial task registry
                this.refresh();
            },

            project(task) {
                // Project a live Task handle into serializable UI state
                const progress = task.progress;
                const percentage = progress
                    ? Math.round(progress.value / progress.max * 100)
                    : null;

                const icon = task.status === "finished" ? "x-check"
                    : task.status === "error" ? "x-error"
                    : task.status === "canceled" ? "x-close"
                    : "x-task";

                return {
                    id: task.id,
                    title: task.title,
                    description: task.description || "",
                    status: task.status,
                    icon,
                    progress: percentage,
                    progressLabel: percentage === null
                        ? (task.status === "running" ? "Indeterminate" : "—")
                        : `${percentage}%`,
                    background: task.background ? "Yes" : "No",
                    createdAt: task.createdAt,
                    startedAt: task.startedAt,
                    endedAt: task.endedAt,
                    duration: task.duration,
                    error: task.error
                };
            },

            refresh() {
                // Read the current Tasks registry and calculate counters
                const all = tasks.list();

                state.total = all.length;
                state.running = all.filter(t => t.status === "running").length;
                state.finished = all.filter(t => t.status === "finished").length;
                state.failed = all.filter(t => t.status === "error").length;
                state.canceled = all.filter(t => t.status === "canceled").length;
                state.hasTerminal = all.some(t => TERMINAL.has(t.status));

                const title = state.query_title.toLowerCase();
                const description = state.query_description.toLowerCase();
                const status = state.query_status.toLowerCase();

                state.items = all
                    .filter(task =>
                        (!title || task.title.toLowerCase().includes(title)) &&
                        (!description || task.description.toLowerCase().includes(description)) &&
                        (!status || task.status.toLowerCase().includes(status))
                    )
                    .map(task => this.project(task));

                // Keep the selected task synchronized with its live handle
                const selected = state.selectedId ? tasks.get(state.selectedId) : null;
                state.selected = selected ? this.project(selected) : null;
                state.canCancel = !!selected && !TERMINAL.has(selected.status);
                state.canRemove = !!selected && TERMINAL.has(selected.status);

                if (!selected && state.selectedId) {
                    state.selectedId = "";
                    state.output = [];
                    state.outputCursor = null;
                    state.hasMoreOutput = false;
                    outputRevision++;
                }
            },

            async selectTask({event}) {
                // Select the Task identified by the list item path
                const id = event.detail?.path;
                if (!id || !tasks.get(id)) return;

                if (state.selectedId !== id) {
                    state.selectedId = id;
                    state.output = [];
                    state.outputCursor = null;
                    state.hasMoreOutput = false;
                }

                this.refresh();
                await this.refreshOutput();
            },

            async refreshOutput() {
                // Reload the first page of output for the selected Task
                const revision = ++outputRevision;
                const id = state.selectedId;
                const task = id ? tasks.get(id) : null;

                state.output = [];
                state.outputCursor = null;
                state.hasMoreOutput = false;

                if (!task) return;

                state.outputLoading = true;

                try {
                    const result = await task.getOutput({
                        limit: OUTPUT_PAGE_SIZE
                    });

                    if (revision !== outputRevision || state.selectedId !== id) return;

                    state.output = result.entries;
                    state.outputCursor = result.nextCursor;
                    state.hasMoreOutput = result.entries.length === OUTPUT_PAGE_SIZE;
                } catch (error) {
                    if (revision === outputRevision) {
                        state.error = error.message || String(error);
                    }
                } finally {
                    if (revision === outputRevision) state.outputLoading = false;
                }
            },

            async loadMoreOutput() {
                // Read the next page without loading the complete Task history
                if (state.outputLoading || !state.hasMoreOutput) return;

                const id = state.selectedId;
                const task = id ? tasks.get(id) : null;
                if (!task) return;

                const revision = outputRevision;
                const cursor = state.outputCursor;
                const remaining = MAX_VISIBLE_OUTPUT - state.output.length;

                if (remaining <= 0) {
                    state.hasMoreOutput = false;
                    return;
                }

                state.outputLoading = true;

                try {
                    const result = await task.getOutput({
                        cursor,
                        limit: Math.min(OUTPUT_PAGE_SIZE, remaining)
                    });

                    if (revision !== outputRevision || state.selectedId !== id) return;

                    state.output = [...state.output, ...result.entries];
                    state.outputCursor = result.nextCursor;
                    state.hasMoreOutput = result.entries.length === OUTPUT_PAGE_SIZE &&
                        state.output.length < MAX_VISIBLE_OUTPUT;
                } catch (error) {
                    if (revision === outputRevision) {
                        state.error = error.message || String(error);
                    }
                } finally {
                    if (revision === outputRevision) state.outputLoading = false;
                }
            },

            async cancelSelected() {
                // Request cooperative cancellation of the selected Task
                const task = tasks.get(state.selectedId);
                if (!task || TERMINAL.has(task.status)) return;

                state.error = "";

                try {
                    await task.cancel();
                    this.refresh();
                } catch (error) {
                    state.error = error.message || String(error);
                }
            },

            removeSelected() {
                // Remove a completed Task from the registry
                const task = tasks.get(state.selectedId);
                if (!task || !TERMINAL.has(task.status)) return;

                state.error = "";

                try {
                    tasks.remove(task.id);
                    state.selectedId = "";
                    state.output = [];
                    state.outputCursor = null;
                    state.hasMoreOutput = false;
                    outputRevision++;
                    this.refresh();
                } catch (error) {
                    state.error = error.message || String(error);
                }
            },

            clear() {
                // Remove all terminal Tasks while preserving active Tasks
                state.error = "";

                try {
                    tasks.clear();
                    this.refresh();
                } catch (error) {
                    state.error = error.message || String(error);
                }
            }
        };
    }
};
