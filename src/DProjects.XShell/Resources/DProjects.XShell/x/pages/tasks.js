
 // contract
export default {
    contract: {
        description: "Background tasks page",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Tasks"
    },
    style: `
    `,
    template: `
        <x-empty x-if="state.tasks.length == 0" icon="x-tasks" label="No background tasks" message="No background tasks are currently running."></x-empty>

        <x-form x-if="state.tasks.length > 0">

            <x-listview view="tiles">
                <x-listview-head>
                    <x-listview-column>Name</x-listview-column>
                </x-listview-head>
                <x-listview-body>
                    <x-listview-item x-for="task in state.tasks" x-attr:key="task.id"
                        x-attr:label="task.title + ' (' + task.status + ')'"
                        x-attr:description="task.description"
                        x-attr:status="task.status"
                        x-attr:icon="task.status == 'finished' ? 'x-check' : (task.status == 'error' ? 'x-error' : (task.status == 'canceled' ? 'x-error' : 'x-file'))"
                    >
                        <div class="status" x-if="task.error">
                            {{task.error.message}}
                        </div>
                        <x-progress
                            slot="bottom"
                            x-if="task.status == 'running'"
                            x-attr:unknown="(task.progress ? false : true)"
                            x-attr:value="task.progress.value"
                            x-attr:max="task.progress.max">
                        </x-progress>

                        <x-button
                            slot="right"
                            class="plain"
                            x-if="task.status == 'pending' || task.status == 'running'"
                            tooltip="Cancel"
                            icon="x-close"
                            x-attr:data-id="task.id"
                            x-on:click="onCancel">
                        </x-button>

                    </x-listview-item>
                </x-listview-body>
            </x-listview>

            <x-button
                slot="footer"
                label="Clear completed"
                icon="x-trash"
                x-on:click="onClear"
                x-attr:disabled="state.completed == 0">
            </x-button>
        </x-form>
    `,
    state: {
        tasks: [],
        running: 0,
        completed: 0
    },
    controller({state, page, events, bus, tasks}) {
        return {
            load() {
                // load
                events.on(bus, "xshell:tasks:added", "refresh");
                events.on(bus, "xshell:tasks:updated", "refresh");
                events.on(bus, "xshell:tasks:removed", "refresh");
                this.refresh();
            },

            // methods            
            refresh() {
                // Project live Task objects into X Template-friendly data
                state.tasks = tasks.list().map(task => ({
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    status: task.status,
                    progress: task.progress,
                    error: task.error
                }));

                state.running = state.tasks.filter(
                    t => t.status == "pending" || t.status == "running"
                ).length;

                state.completed = state.tasks.filter(
                    t => t.status == "finished" ||
                        t.status == "error" ||
                        t.status == "canceled"
                ).length;

                page.invalidate();
            },


            // events
            async onCancel({event}) {
                const id = event.currentTarget.dataset.id;
                const task = tasks.get(id);
                if (task) {
                    await task.cancel();
                }
            },
            onClear() {
                // Remove terminal tasks
                tasks.clear();
                this.refresh();
            }
        };
    }
};
