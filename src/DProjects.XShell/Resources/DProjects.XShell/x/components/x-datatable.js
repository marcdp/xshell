
// component
export default {
    contract: {
        description: "Provides a container for data table content.",
        events: {},
        properties: {},
        methods: {},
        slots: {
            "": {
                description: "Default slot for data table content."
            }
        }
    },
    style: `
        :host { display:block; }        
    `,
    template: `
        <slot></slot>
    `,
    state: {
    }
};

