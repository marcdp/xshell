
// component
export default {
    contract: {
        description: "Provides a flexible element that fills available layout space.",
        events: {},
        properties: {},
        methods: {},
        slots: {
            "": {
                description: "Content for the fill element"
            }
        },
        examples: [
            {
                name: "basic",
                description: "Fill the space between a leading label and a trailing action in a flex toolbar.",
                template: `
                    <x-toolbar>
                        <strong>Project</strong>
                        <x-fill></x-fill>
                        <x-button label="Refresh" command="refresh"></x-button>
                    </x-toolbar>
                `
            }
        ]
    },
    style: `
        :host {
            display:flex; 
            flex-direction:column;
            position:absolute;
            left:0;
            top:var(--x-fill-top, 0);
            right:0;
            bottom:0;
            z-index:0;
            height:var(--x-fill-height, unset);
        }
    `,
    template: `
        <slot></slot>
    `,
};
