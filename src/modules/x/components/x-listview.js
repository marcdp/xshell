import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-listview", {
    style: `
        :host {display:block;}

        /* list */
        .list > div {display:block;}
        .list > div .columns {display:none;}

        /* icons */
        .icons > div {display:flex;gap:.4em;flex-wrap:wrap;}
        .icons > div .columns {display:none;}

        /* details */
        .details {overflow-x:auto; }
        .details > div {display:table; width:100%; white-space: nowrap}
        .details > div ::slotted(*) {display:table-row;}
        .details > div ::slotted(*:not([name]):nth-child(odd)) {background: var(--x-color-background-alt)} 
        .details > div .columns {display:table-row; }
        .details > div .columns ::slotted(*) {display:table-cell; background: none!important;}

    `,
    template: `
        <div x-attr:class="state.view">
            <div>
                <div class="columns">
                    <slot name="column"></slot>
                </div>
                <slot x-on:slotchange="refresh"></slot>
            </div>
        </div>        
    `,
    state: {
        view: "list",
    },
    methods: {
        async onCommand(command) {
            if (command == "load") {
                //load               
                this.bindEvent(this.state, "change:view", "refresh");

            } else if (command == "refresh") {
                //slotchange
                let view = this.state.view;
                this.shadowRoot.querySelector("slot:not([name])").assignedElements().forEach((item) => {
                    item.view = view;
                });
            }
        }
    }
});

