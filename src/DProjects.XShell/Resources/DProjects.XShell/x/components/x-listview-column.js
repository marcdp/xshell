// component
export default {
    contract: {
        description: "Defines a labeled column in an x-listview details header.",
        events: {},
        properties: {
            label: {type:"string", default:"", attribute:true, state:true, description:"Fallback header label."},
            width: {type:"string", default:"minmax(0, 1fr)", attribute:true, state:true, description:"CSS Grid track size shared by the header and item rows."}
        },
        methods: {},
        slots: {
            "": {description:"Custom column header content. Overrides the fallback label when provided."}
        },
        examples: [
            {
                name: "column-width",
                description: "Set a fixed width for the secondary details column.",
                template: `
                    <x-listview view="details">
                        <x-listview-head>
                            <x-listview-column label="Name"></x-listview-column>
                            <x-listview-column label="Type" width="8rem"></x-listview-column>
                        </x-listview-head>
                        <x-listview-body>
                            <x-listview-item label="Notes.txt"><span>Text</span></x-listview-item>
                        </x-listview-body>
                    </x-listview>
                `
            }
        ]
    },
    style: `
        :host {display: block; box-sizing: border-box; min-width: 0; }
        .content { display: block; min-width: 0; height: 100%; overflow: hidden; padding-right:.15em; box-sizing: border-box; }
        
        :host(:first-child) .content span {padding-left:.3em;}

        ::slotted(*) {min-width:0; line-height:var(--x-datafield-line-height);;}
        ::slotted(x-datafield:first-child:last-child) {width:100%;}
    `,
    template: `
        <div class="content">
            <slot>
                <span x-text="state.label"></span>
            </slot>
        </div>
    `
};
