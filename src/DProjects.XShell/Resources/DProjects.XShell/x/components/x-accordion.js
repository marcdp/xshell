

// component
export default {
    contract: {
        description: "Groups accordion panels and keeps only the expanded panel active.",
        events: {},
        properties: {
            selectedIndex: {type:"number", default:0, attribute:true, state:true, description:"Index of the currently selected accordion panel"},
            multiple: {type:"boolean", default:false, attribute:true, state:true, description:"Allow multiple accordion panels to be expanded simultaneously"}
        },
        methods: {},
        slots: {
            "": {
                description: "The default slot for accordion panels."
            }
        },
        examples: [
            {
                name: "basic",
                description: "Group collapsible panels so opening another panel closes the current one.",
                template: `
                    <x-accordion>
                        <x-accordion-panel label="Overview" expanded><p>Project summary</p></x-accordion-panel>
                        <x-accordion-panel label="Activity"><p>Recent changes</p></x-accordion-panel>
                    </x-accordion>
                `
            }
        ]
    },
    style: `
        :host {
            display:block; 
            border:var(--x-accordion-border); 
            border-radius:var(--x-accordion-border-radius); 
            box-shadow:var(--x-accordion-shadow); 
        }
    `,
    state: {
        tabs: []
    },
    template: `
        <slot></slot>
    `,
    controller({ state, host }) {
        return {
            load(params) {
                //load
                host.addEventListener("toggle", (event) => {
                    let target = event.target;
                    if (target.expanded) {
                        host.querySelectorAll(":scope > x-accordion-panel").forEach((panel) => {
                            if (!state.multiple) {
                                if (panel != target) {
                                    panel.expanded = false;
                                    panel.dispatchEvent(new CustomEvent("toggle", {bubbles: true, composed: false}));
                                }
                            }
                        });
                    }
                    event.stopPropagation();
                    event.preventDefault();
                    return false;
                });
            }
        }
    }
}

