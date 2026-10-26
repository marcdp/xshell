// contract
export const contract = {
    description: "Defines a labeled column in a tree view.",
    events: {},
    properties: {
        label: {type:"string", default:"", attribute:true, state:true, description:""},
        width: {type:"string", default:"minmax(0, 1fr)", attribute:true, state:true, description:""},
    },
    methods: {},
    slots: {
        "": {description: "Custom column header content. Overrides the default label if provided."}
    }
};


// implementation
export default {
    style: `
        :host {
            display: block;
            box-sizing: border-box;
            min-width: 0;
        }

        .content {
            display: flex;
            align-items: center;
            gap: .25em;
            min-width: 0;
            height: 100%;
        }

        :host(:first-child) span {
            padding-left:.25em;
        }

        ::slotted(*) {
            min-width: 0;
        }
    `,
    template: `       
        <div class="content">
            <slot>
                <span x-text="state.label"></span>
            </slot>
        </div>
    `,
    state: {
    }
};

