// component
export default {
    contract: {
        description: "Displays the current local time.",
        events: {},
        properties: {},
        methods: {}
    },
    style: `
        :host {border:1px solid var(--x-clock-border-color); display:inline-block; padding:10px;}
    `,
    template: `
        {{ state.time }}
    `,
    state: {
        time: null
    },
    controller: ({ state, timer }) => {
        return {
            load() {
                //load
                this.refresh();
                timer.setInterval("refresh", 1000);
            },

            refresh() {
                //refresh
                state.time = new Date().toLocaleTimeString();
            }
        };
    }
};
