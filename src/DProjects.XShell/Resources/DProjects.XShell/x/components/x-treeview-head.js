// contract
export const contract = {
    description: "Provides the header container for tree-view columns.",
    events: {},
    properties: {},
    methods: {},
    slots: {
        "": {
            description: "Default slot for tree-view columns."
        }
    }
};


// implementation
export default {
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

