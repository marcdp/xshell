import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-listview", {
    style: `
        :host {display:block; }

        /* list */
        .list {
            display:block;
        }

        /* icons */
        .icons {
            display:flex;
            gap:.4em;
            flex-wrap:wrap;
        }
    `,
    template: `
        <div x-attr:class="state.view">
            <slot x-on:slotchange="refresh"></slot>
        </div>        
    `,
    state: {
        view: "list",
    },
    //settings: {
    //    observedAttributes: ["view"]
    //},
    methods: {
        async onCommand(command) {
            if (command == "load") {
                //load               
                this.bindEvent(this.state, "change:view", "refresh");

            } else if (command == "refresh") {
                //slotchange
                let view = this.state.view;
                this.shadowRoot.querySelector("slot").assignedElements().forEach((item) => {
                    item.view = view;
                });
            }
        }
    }
});

