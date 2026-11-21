// component
export default {
    contract: {
        description: "Displays slotted content only on mobile-sized viewports.",
        tags: ["responsive", "mobile", "visibility"],
        events: {},
        properties: {},
        methods: {},
        slots: {
            "":{
                description: "Slot for providing content that will only be displayed on mobile-sized viewports."
            }
        },
        examples: [
            {
                name: "basic",
                description: "Show touch guidance on mobile-sized viewports.",
                template: `<x-mobile><p>Tap a project to view its details.</p></x-mobile>`
            }
        ]
    },
    style: `
        @media (min-width: 769px) {
            :host {display:none;}
        }        
    `,
    template: `<slot></slot>`
};

