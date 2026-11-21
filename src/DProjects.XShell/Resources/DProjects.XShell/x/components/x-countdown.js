
export default {
    contract: {
        description: "Displays the remaining time until a target date.",
        tags: ["time", "countdown", "formatting"],
        properties: {
            value:        {type:"any", default:null, attribute:true, state:true, description:"Target datetime (ISO string or Date)."},
            format:       {type:"string", default:"{d}d {hh}h {mm}m {ss}s", attribute:true, state:true},
            expiredLabel: {type:"string", default:"Expired", attribute:true, state:true},
            interval:     {type:"number", default:1000, attribute:true, state:true}
        },
        methods: {},
        examples: [
            {
                name: "basic",
                description: "Count down from five minutes and show a label when the timer expires.",
                language: "javascript",
                template: `<x-countdown id="break-timer" format="{mm}:{ss}" expired-label="Break finished"></x-countdown>`,
                code: `document.querySelector("#break-timer").value = new Date(Date.now() + 5 * 60 * 1000);`
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
            // Subscribe to property changes
            load() {
                events.on(state, ["change:value", "change:format", "change:expiredLabel", "change:interval"], "restart");
            },

            // Start the countdown when mounted
            mount() {
                mounted = true;
                this.restart();
            },

            // Stop the countdown when unmounted
            unmount() {
                mounted = false;
                this.stop();
            },

            // Release resources when unloaded
            unload() {
                mounted = false;
                this.stop();
            },

            // Stop the active timer
            stop() {
                if (timerId !== null) clearInterval(timerId);
                timerId = null;
            },

            // Restart the timer after configuration changes
            restart() {
                this.stop();
                if (!this.refresh() || !mounted) return;
                const interval = Number.isFinite(state.interval) && state.interval >= 100 ? state.interval : 1000;
                timerId = setInterval(() => this.refresh(), interval);
            },

            // Calculate the remaining time using the current clock
            refresh() {
                let target;
                try {
                    target = state.value == null || state.value === "" ? NaN : new Date(state.value).getTime();
                } catch {
                    target = NaN;
                }

                // Handle missing or invalid dates
                if (!Number.isFinite(target)) {
                    state.text = "";
                    this.stop();
                    return false;
                }

                // Stop the countdown when the target is reached
                const total = Math.max(0, Math.ceil((target - Date.now()) / 1000));
                if (total === 0) {
                    state.text = state.expiredLabel;
                    this.stop();
                    return false;
                }

                // Calculate days, hours, minutes and seconds
                const days = Math.floor(total / 86400);
                const hours = Math.floor(total % 86400 / 3600);
                const minutes = Math.floor(total % 3600 / 60);
                const seconds = total % 60;

                // Format the remaining duration
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
