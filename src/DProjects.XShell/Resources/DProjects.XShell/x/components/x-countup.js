export default {
    contract: {
        description: "Displays the elapsed time since a start date.",
        tags: ["time", "elapsed-time", "formatting"],
        properties: {
            value:    {type:"any", default:null, attribute:true, state:true, description:"Start datetime (ISO string or Date)."},
            format:   {type:"string", default:"{d}d {hh}h {mm}m {ss}s", attribute:true, state:true},
            interval: {type:"number", default:1000, attribute:true, state:true}
        },
        methods: {},
        examples: [
            {
                name: "basic",
                description: "Display the elapsed time since an ISO timestamp.",
                template: `<x-countup value="2024-01-01T00:00:00Z" format="{d} days, {hh}:{mm}:{ss}"></x-countup>`
            }
        ]
    },

    style: `
        :host {display:inline-block; font-variant-numeric:tabular-nums;}
    `,

    template: `
        <span x-text="state.text"></span>
    `,

    state: {
        text: ""
    },

    controller({state, events}) {
        let timerId = null;
        let mounted = false;

        return {
            load() {
                // Subscribe to property changes.
                events.on(state, ["change:value", "change:format", "change:interval"], "restart");
            },

            mount() {
                // Start the count-up when mounted.
                mounted = true;
                this.restart();
            },

            unmount() {
                // Stop the count-up when unmounted.
                mounted = false;
                this.stop();
            },

            unload() {
                // Release timer resources when unloaded.
                mounted = false;
                this.stop();
            },

            stop() {
                // Stop the active timer.
                if (timerId !== null) clearInterval(timerId);
                timerId = null;
            },

            restart() {
                // Restart the timer after configuration changes.
                this.stop();
                if (!this.refresh() || !mounted) return;
                const interval = Number.isFinite(state.interval) && state.interval >= 100 ? state.interval : 1000;
                timerId = setInterval(() => this.refresh(), interval);
            },

            refresh() {
                // Resolve the configured start datetime.
                let start;
                try {
                    start = state.value == null || state.value === "" ? NaN : new Date(state.value).getTime();
                } catch {
                    start = NaN;
                }

                // Hide the value when no valid start datetime is available.
                if (!Number.isFinite(start)) {
                    state.text = "";
                    this.stop();
                    return false;
                }

                // Calculate elapsed whole seconds, clamping future dates to zero.
                const total = Math.max(0, Math.floor((Date.now() - start) / 1000));
                const days = Math.floor(total / 86400);
                const hours = Math.floor(total % 86400 / 3600);
                const minutes = Math.floor(total % 3600 / 60);
                const seconds = total % 60;

                // Format the elapsed duration.
                const values = {
                    d: days,
                    dd: String(days).padStart(2, "0"),
                    hh: String(hours).padStart(2, "0"),
                    mm: String(minutes).padStart(2, "0"),
                    ss: String(seconds).padStart(2, "0")
                };
                state.text = state.format.replace(/\{(d|dd|hh|mm|ss)\}/g, (_, key) => values[key]);
                return true;
            }
        };
    }
};
