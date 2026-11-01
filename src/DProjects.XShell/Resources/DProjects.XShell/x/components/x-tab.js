
// component
export default {
    contract: {
        description: "Defines one tab panel for an x-tabs component.",
        events: {},
        properties: {
            label: {type:"string", default:"", attribute:true, state:true, description:"Label for the tab."},
            hash:  {type:"string", default:"", attribute:true, state:true, description:"Hash for the tab, to be used with x-tabs component that supports hash navigation."}
        },
        methods: {},
        slots: {
            "":{
                description: "Content for the tab panel"
            }
        }
    },
    style: `
        :host {display:block;}
    `,
    template: `
        <slot></slot>
    `,
    state: {
    }
};
