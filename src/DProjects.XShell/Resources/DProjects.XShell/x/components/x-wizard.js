// component
export default {
    contract: {
        description: "Displays wizard panels with previous and next navigation controls.",
        tags: ["forms", "wizard", "navigation"],
        events: {},
        properties: {
            index:  {type:"number", default:0, attribute:true, state:true, description:""},
            panels: {type:"array", default:[], state:true, description:""}
        },
        methods: {},
        slots: {
            "":{
                description: "Slot for providing wizard panels."
            },
            "buttons":{
                description: "Slot for providing buttons."
            }
        },
        examples: [
            {
                name: "basic",
                description: "Navigate through two labeled panels with the built-in controls.",
                template: `
                    <x-wizard>
                        <x-wizard-panel label="Plan"><p>Review the project plan.</p></x-wizard-panel>
                        <x-wizard-panel label="Review"><p>Review the final details.</p></x-wizard-panel>
                    </x-wizard>
                `
            },
            {
                name: "final-action",
                description: "Provide a final-panel action through the buttons slot.",
                template: `
                    <x-wizard>
                        <x-wizard-panel label="Plan"><p>Check the project details.</p></x-wizard-panel>
                        <x-wizard-panel label="Complete"><p>The plan is ready.</p></x-wizard-panel>
                        <x-anchor slot="buttons" href="page:x:/pages/areas.js">Back to Areas</x-anchor>
                    </x-wizard>
                `
            }
        ]
    },
    style: `
        :host {display:block;}

        :host .body {}
        :host .footer {text-align:right;}
        :host .footer x-button {
            min-width: var(--x-button-width-wide);
        }

        ::slotted(x-wizard-panel) {
            display:none;
        }
        ::slotted(x-button) {
            min-width: var(--x-button-width-wide);
        }

    `,
    state: {
    },
    template: `        
        <x-wizard-header x-attr:index="state.index" x-prop:panels="state.panels" x-on:indexset="set"></x-wizard-header>
 
        <div class="body">
            <slot x-on:slotchange="refresh"></slot>
        </div>

        <div class="footer">
            <x-button x-if="state.index > 0" x-on:click="prev" label="Previous"></x-button>
            <x-button x-if="state.index < state.panels.length - 1" x-on:click="next" label="Next"></x-button>
            <slot name="buttons" x-if="state.index == state.panels.length - 1"></slot>
        </div>
    `,
    controller({ state, host }) {
        let styleSheet = new CSSStyleSheet();
        return {
            load() {
                //load
                this.refresh();
            },
            mount() {
                //mounted
                host.shadowRoot.adoptedStyleSheets = [...host.shadowRoot.adoptedStyleSheets, styleSheet];
            },

            set(args) {
                //set
                let index = args.event.detail.index;
                state.index = index;
                this.refresh();
            },

            prev() {
                //prev
                state.index--;
                this.refresh();
            },

            next() {
                //next
                state.index++;
                this.refresh();
            },

            refresh() {
                //refresh
                let panels = [];
                host.querySelectorAll(":scope > x-wizard-panel").forEach((panel, index) => {
                    panels.push({
                        label: panel.getAttribute("label"),
                        message: panel.getAttribute("message"),
                        icon: panel.getAttribute("icon") || "",
                        index: index + 1
                    });
                });
                state.panels = panels;
                styleSheet.replaceSync(`::slotted(x-wizard-panel:nth-child(${parseInt(state.index) + 1})) {display:block;}`);
            }
        };
    }
};

