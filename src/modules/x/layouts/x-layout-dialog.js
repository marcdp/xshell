import XElement from "../../x/ui/x-element.js";

// class
export default XElement.define("x-layout-dialog", {
    style:`
        dialog {
            max-width:90vw;
            min-width:25vw;
            min-height:7em;
            padding:var(--x-layout-dialog-page-padding-vertical) var(--x-layout-dialog-page-padding-horizontal) var(--x-layout-dialog-page-padding-vertical) var(--x-layout-dialog-page-padding-horizontal);
            border:var(--x-layout-dialog-border);
            border-radius:var(--x-layout-dialog-border-radius);
            box-shadow:var(--x-layout-dialog-shadow);
            box-sizing:border-box;
        }
        x-loading {position:absolute; width:100%; margin-top:-0.5em;}
        .container { position:relative;}
        .header {display:flex; align-items:baseline; padding-bottom:1em;}
        .header h2 {margin:0; flex:1; font-size: var(--x-font-size-subtitle); margin-right:1em}
        .header x-button {transform:translateY(-0.2em);}

        /* responsive */
        @media (max-width: 768px) {
            dialog {
                min-width:50vw;                
            }
        }

        /* show horizontal bar in x-form footer*/
        ::slotted(x-form) {
            --x-form-footer-hr-display: block;
            --x-form-footer-hr-margin-left: calc( var(--x-layout-dialog-page-padding-horizontal) * -1);
            --x-form-footer-hr-margin-right: calc( var(--x-layout-dialog-page-padding-horizontal) * -1);
        }
        
    `,
    template: `
        <dialog x-on:cancel="query-close">
            <div class="container">
                <x-loading x-if="state.status=='loading'"></x-loading>
                <div class="header">
                    <h2>{{ state.label }}&nbsp;</h2>
                    <x-button class="anchor" icon="x-close" x-on:click="query-close"></x-button>
                </div>
                <div class="body">
                    <slot></slot>
                </div>            
            </div>
        </dialog>

    `,
    state: {
        label: "",
        status: ""
    },
    //settings: {
    //    observedAttributes: ["status"]
    //},
    methods: {
        onCommand(command, args) {
            if (command == "load") {
                //load
                this.render();
                this.shadowRoot.querySelector("DIALOG").showModal();
                this.bindEvent(this.page, "load", "refresh");
                this.onCommand("refresh");
                
            } else if (command == "refresh") {
                //refresh
                this.label = this.page.label;

            } else if (command == "query-close") {
                //query close
                args.event.preventDefault();
                this.dispatchEvent(new CustomEvent("query-close", { composed: true }));
            }
        }

    }
});
