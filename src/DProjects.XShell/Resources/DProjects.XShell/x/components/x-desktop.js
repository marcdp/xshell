
// component
export default {
    contract: {
        description: "Displays slotted content only on desktop-sized viewports.",
        tags: ["responsive", "desktop", "visibility"],
        events: {},
        properties: {},
        methods: {},
        slots: {
            "":{
                description: "Slot for providing content that will only be displayed on desktop-sized viewports."
            }
        },
        examples: [
            {
                name: "basic",
                description: "Show supplemental information on desktop-sized viewports.",
                template: `<x-desktop><p>Keyboard shortcut: press Enter to open the selected item.</p></x-desktop>`
            }
        ]
    },
    style: `
        @media (max-width: 768px) {
            :host {display:none;}
        }        
    `,
    template: `<slot></slot>`
};

