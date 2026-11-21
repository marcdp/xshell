// component
export default {
    contract: {
        description: "Provides a container for tree-view item content.",
        tags: ["data", "hierarchies", "containers"],
        events: {},
        properties: {},
        methods: {},
        slots: {
            "": {
                description: "Default slot."
            }
        },
        examples: [
            {
                name: "hierarchy",
                description: "Provide top-level items in the body, with descendants nested in items.",
                template: `
                    <x-treeview>
                        <x-treeview-body>
                            <x-treeview-item label="Projects" icon="x-folder" path="/projects" expanded>
                                <x-treeview-item label="Notes" icon="x-file" path="/projects/notes"></x-treeview-item>
                            </x-treeview-item>
                        </x-treeview-body>
                    </x-treeview>
                `
            }
        ]
    },
    style: `
        :host {
            display:block;
        }        
    `,
    template: `<slot></slot>`,    
};
