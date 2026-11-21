
// component
export default {
    contract: {
        description: "Displays the current page title.",
        tags: ["content", "pages"],
        events: {},
        properties: {},
        methods: {},
        examples: [
            {
                name: "basic",
                description: "Use the current Page label as the heading.",
                template: `<h1><x-page-title></x-page-title></h1>`
            }
        ]
    },
    style: ``,
    template: `{{ state.label }}`,
    state: {
        label: ""
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
                state.label = page?.label || "";
            }
        }
    }
};

