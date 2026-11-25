// page
export default {
    contract: {
        description: "Runtime diagnostics page.",
        events: {},
        properties: {},
        methods: {}
    },

    meta: {
        title: "Runtime",
        description: "Shows XShell runtime timing information."
    },

    template: `
        <x-datafields columns="3">
            <x-datafield label="Started at">
                <x-datetime x-prop:value="state.startTimeMs"></x-datetime>    
            </x-datafield>            
            <x-datafield label="Startup duration" readonly>
                <x-time-ms x-prop:value="state.startupDurationMs"></x-time-ms>
            </x-datafield>
            <x-datafield label="Uptime" readonly>
                <x-countup x-prop:value="state.startTimeMs"></x-countup>
            </x-datafield>
        </x-datafields>
        <x-datafields>
            <x-datafield label="Timings">
                <table class="datatable">
                    <thead>
                        <tr>
                            <th>Phase</th>
                            <th>Duration</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr x-for="item in state.timings">
                            <td>{{ item.phase }}</td>
                            <td>{{ item.durationMs }} ms</td>
                            <td>{{ item.totalMs }} ms</td>
                        </tr>
                    </tbody>
                </table>
            </x-datafield>
        </x-datafields>
    `,

    state: {
        startTimeMs: null,
        startupDurationMs: 0,
        timings: []
    },

    controller({ state, runtime, timer }) {
        return {
            load() {
                // Load the runtime timing values and keep uptime refreshed.
                this.refresh();
                timer.setInterval("refresh", 1000);
            },

            refresh() {
                // Project the current Runtime values into reactive Page state.
                state.startTimeMs = runtime.startTimeMs;
                state.startupDurationMs = runtime.startupDurationMs;
                state.timings = runtime.timings;
            }
        };
    }
};