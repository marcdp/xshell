// component
export default {
    contract: {
        description: "Provides a panel container for a wizard.",
        tags: ["forms", "wizard", "containers"],
        events: {},
        properties: {},
        methods: {},
        slots: {
            "":{
                description: "Slot for providing the content of the wizard panel."
            }
        },
        examples: [
            {
                name: "basic",
                description: "Wrap step content in a panel. The parent wizard reads its label attribute.",
                template: `
                    <x-wizard>
                        <x-wizard-panel label="Review"><p>Confirm the project details.</p></x-wizard-panel>
                    </x-wizard>
                `
            }
        ]
    },
    style: `
        :host {display:block;}
    `,
    template: `
        <slot></slot>
    `
};
