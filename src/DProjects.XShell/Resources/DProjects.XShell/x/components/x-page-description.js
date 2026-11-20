
// component
export default {
    contract: {
        description: "Displays the current page description.",
        events: {},
        properties: {},
        methods: {},
        examples: [
            {
                name: "basic",
                description: "Display the current Page description below its heading.",
                template: `
                    <h1><x-page-title></x-page-title></h1>
                    <p><x-page-description></x-page-description></p>
                `
            }
        ]
    },
    style: `
        :host {display:block; }
    `,
    template: `{{ state.description }}`,
    state: {
        description: ""
    },
    controller({ events, bus, state, getPage }) {
        return {
            load(...args) {
                // load
                events.on(bus, ["xshell:page:load", "xshell:page:change"], (event)=>{
                    if (event.detail.id == getPage()?.id) {
                        this.refresh();
                    }
                });
            },

            mount(...args) {
                // mount
                this.refresh();
            },

            refresh(...args) {
                //refresh
                const page  = getPage();
                state.description = page?.description || "";
            }
        }
    }
};

