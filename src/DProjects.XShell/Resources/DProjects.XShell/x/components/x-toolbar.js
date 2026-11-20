// component
export default {
    contract: {
        description: "Provides a flexible toolbar container.",
        events: {},
        properties: {},
        methods: {},
        slots: {
            "": {
                description: "Default slot for the toolbar content."
            }
        },
        examples: [
            {
                name: "basic",
                description: "Align a small group of actions in a toolbar.",
                template: `
                    <x-toolbar>
                        <x-button label="Save" icon="x-save"></x-button>
                        <x-button label="Cancel"></x-button>
                    </x-toolbar>
                `
            }
        ]
    },
    style: `
        :host {display:flex; align-items:center; gap:.2em; position:relative; flex-wrap:wrap; }
    `,
    template: `
        <slot></slot>
    `,
    state: {
    }
};

