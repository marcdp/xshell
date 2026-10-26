// contract
export const contract = {
    description: "Defines a labeled column in an x-listview2 details header.",
    events: {},
    properties: {
        label: {type:"string", default:"", attribute:true, state:true, description:"Fallback header label."},
        width: {type:"string", default:"minmax(0, 1fr)", attribute:true, state:true, description:"CSS Grid track size shared by the header and item rows."}
    },
    methods: {},
    slots: {
        "": {description:"Custom column header content. Overrides the fallback label when provided."}
    }
};


// implementation
export default {
    style: `
        :host {display: block; box-sizing: border-box; min-width: 0;}
        .content { display: flex; align-items: center; gap: .25em; min-width: 0; height: 100%; overflow: hidden; }
        ::slotted(*) {min-width:0;}
    `,
    template: `
        <div class="content">
            <slot>
                <span x-text="state.label"></span>
            </slot>
        </div>
    `
};
