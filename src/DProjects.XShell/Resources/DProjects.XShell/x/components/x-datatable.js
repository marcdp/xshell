
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
        },
        examples: [
            {
                name: "basic",
                description: "Provide a native table as the default content.",
                template: `
                    <x-datatable>
                        <table class="datatable">
                            <thead><tr><th>Project</th><th>Status</th></tr></thead>
                            <tbody><tr><td>Launch</td><td>Ready</td></tr></tbody>
                        </table>
                    </x-datatable>
                `
            }
        ]
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

