import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-accordion", {
    style: `
        :host {
            display:block; 
            border:var(--x-accordion-border); 
            border-radius:var(--x-accordion-border-radius); 
            box-shadow:var(--x-accordion-shadow); 
        }
    `,
    state: {
        selectedIndex: 0,
        tabs: []
    },
    template: `
        <slot></slot>
    `,
    methods:{
        onCommand(command) {
            if (command == "load") {
                //load
                this.addEventListener("toggle", (event) => {
                    let target = event.target;
                    if (target.expanded) {
                        this.querySelectorAll(":scope > x-accordion-panel").forEach((panel) => {
                            if (panel != target) {
                                panel.onCommand("collapse");
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
});

