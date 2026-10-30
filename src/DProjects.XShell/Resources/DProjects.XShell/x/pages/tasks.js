
// contract
export const contract = {
    description: "Background tasks page",
    events: {},
    properties: {},
    methods: {}
};

// page
export default {
    meta: {
        title: "Tasks"
    },
    style: `
        :scope {display:block;}
        .toolbar {display:flex; justify-content:flex-end; margin-bottom:1em;}
        .tasks {display:flex; flex-direction:column; gap:.5em;}
        .task {display:flex; align-items:center; gap:1em; padding:.75em; border:var(--x-card-border); border-radius:var(--x-card-border-radius);}
        .task .content {flex:1; min-width:0;}
        .task .name {font-weight:600;}
        .task .description {font-size:.9em; color:var(--x-color-gray); overflow-wrap:anywhere;}
        .task .status {font-size:.8em; color:var(--x-color-gray);}
        .task x-progress {display:block; margin-top:.5em;}
    `,
    template: `

        <div x-if="state.tasks.length == 0">
            No background tasks.
        </div>

        <x-form x-if="state.tasks.length > 0">
            <div class="tasks">
                <div class="task" x-for="task in state.tasks" x-attr:key="task.id">
                    <x-icon x-if="task.status == 'ok'" icon="x-check"></x-icon>
                    <x-icon x-elseif="task.status == 'error'" icon="x-error"></x-icon>
                    <x-icon x-elseif="task.status == 'aborted'" icon="x-error"></x-icon>
                    <x-icon x-else icon="x-file"></x-icon>

                    <div class="content">
                        <div class="name">{{task.name}} ({{task.status}})</div>
                        <div class="description">{{task.description}}</div>
                        
                        <x-progress x-if="task.status == 'running' && task.progress != null" x-attr:value="task.progress" max="100"></x-progress>

                        <div class="status" x-if="task.error">{{task.error}}</div>
                    </div>

                    <x-button class="plain" x-if="task.status == 'running'" tooltip="Abort" icon="x-close" x-attr:data-id="task.id" x-on:click="onAbort"></x-button>
                </div>
            </div>
            <x-button slot="footer" label="Clear completed" icon="x-trash" x-on:click="onClear" x-attr:disabled="state.completed == 0"></x-button>
        </x-form>


    `,
    state: {
        tasks: [],
        running: 0,
        completed: 0,
    },
    controller({state, events, bus, tasks}) {
        return {
            load() {
                // load current tasks
                this.refresh();
                // listen for changes
                events.on(bus, "xshell:tasks:change", "refresh");
            },
            refresh() {
                // update tasks snapshot
                state.tasks = tasks.getTasks();
                state.running = state.tasks.filter(t => t.status == 'running').length;
                state.completed = state.tasks.filter(t => t.status == 'ok' || t.status == 'error' || t.status == 'aborted').length;
            },
            onAbort({event}) {
                // abort running task
                const id = Number(event.currentTarget.dataset.id);
                tasks.abort(id);
            },
            onClear() {
                // remove completed tasks
                tasks.clear();
                this.refresh();
            }
        };
    }
};
