
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
        },
        examples: [
            {
                name: "basic",
                description: "Provide the content and label of a panel as a direct child of x-tabs.",
                template: `
                    <x-tabs>
                        <x-tab label="Details"><p>Project details go here.</p></x-tab>
                    </x-tabs>
                `
            }
        ]
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
