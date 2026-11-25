// page
export default {
    contract: {
        description: "List and monitor XShell runtime tasks.",
        events: {},
        properties: {},
        methods: {}
    },

    meta: {
        title: "Tasks",
        description: "List and monitor XShell runtime tasks."
    },

    style: `
        .summary {margin-bottom:1em;}
        .actions {margin-bottom:.75em;}
        .description {overflow-wrap:anywhere;}
    `,

    template: `
        <x-toolbar slot="header-actions">
            <x-button label="Refresh" icon="x-refresh" command="refresh"></x-button>
            <x-button label="Clear completed" icon="x-clear" command="clear"
                x-attr:disabled="!state.hasTerminal"></x-button>
        </x-toolbar>

        <x-notice type="error" x-if="state.error" x-prop:message="state.error"></x-notice>

        <x-listview view="details" x-on:activate="activateTask">
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
                <x-listview-item x-for="item in state.items" x-key="id"
                    x-attr:label="item.title"
                    x-attr:description="item.description"
                    x-attr:path="item.id"
                    x-attr:icon="item.icon">

                    <div class="description">{{ item.description }}</div>
                    <div>{{ item.status }}</div>
                    <div>{{ item.progressLabel }}</div>
                    <div><x-time-ms x-prop:value="item.duration"></x-time-ms></div>
                    <div>{{ item.background }}</div>
                    <div><x-datetime x-prop:value="item.createdAt"></x-datetime></div>
                </x-listview-item>
            </x-listview-body>
        </x-listview>
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
        error: ""
    },

    controller({ state, events, bus, tasks, timer, navigation, page }) {
        const TERMINAL = new Set(["finished", "error", "canceled"]);
        return {
            load() {
                // Initialize task filters
                events.on(state, "change:query_title", "refresh");
                events.on(state, "change:query_description", "refresh");
                events.on(state, "change:query_status", "refresh");

                // Subscribe to task lifecycle events
                events.on(bus, "xshell:tasks:added", "refresh");
                events.on(bus, "xshell:tasks:removed", "refresh");
                events.on(bus, "xshell:tasks:updated", "refresh");

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
                    progressLabel: percentage === null
                        ? (task.status === "running" ? "Indeterminate" : "—")
                        : `${percentage}%`,
                    background: task.background ? "Yes" : "No",
                    createdAt: task.createdAt.toISOString(),
                    duration: task.duration
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
            },

            async activateTask({ event }) {
                // Open the registered Task in a stacked Page.
                const id = event.detail?.path;
                if (!id || !tasks.get(id)) return;

                state.error = "";
                try {
                    await navigation.navigate({
                        href: "page:xshell-diagnostics:/pages/detail/tasks-detail.js", page, open: "stack", params: { id }
                    });
                } catch (error) {
                    state.error = error?.message || String(error);
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
