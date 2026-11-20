// component
export default {
    contract: {
        description: "Provides the header container for tree-view columns.",
        events: {},
        properties: {},
        methods: {},
        slots: {
            "": {
                description: "Default slot for tree-view columns."
            }
        },
        examples: [
            {
                name: "columns",
                description: "Place the header and body as siblings.",
                template: `
                    <x-treeview>
                        <x-treeview-head>
                            <x-treeview-column label="Name"></x-treeview-column>
                            <x-treeview-column label="Status" width="8rem"></x-treeview-column>
                        </x-treeview-head>
                        <x-treeview-body>
                            <x-treeview-item label="Reports" path="/reports"><span slot="column">Ready</span></x-treeview-item>
                        </x-treeview-body>
                    </x-treeview>
                `
            }
        ]
    },
    style: `
        :host {
            display:grid; 
            grid-template-columns: var(--x-treeview-grid-template-columns);
            line-height: 1.8em;
            padding-right: .1em;
            box-sizing: border-box;
        }
        
    `,
    template: `<slot></slot>`,    
};

