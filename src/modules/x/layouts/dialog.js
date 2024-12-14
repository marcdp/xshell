import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-layout-dialog", {
    template: `
        <style>
            dialog {
                min-width:20vw;
                min-height:7em;
                padding:0;
            }
            dialog > .body {padding:1em;}
        </style>
        <dialog x-on:cancel="query-close">
            <x-loading-bar x-if="state.status=='loading'"></x-loading-bar>
            <div class="header">
                <x-page-title></x-page-title>
            <div>
            <div class="body">                
                This is the dialog
                <div style="border:1px blue solid;">
                    <slot></slot>
                </div>
            </div>            
        </dialog>
    `,
    state: {
        status: ""
    },
    settings: {
        observedAttributes: ["status"],
        useLightDom: true
    },
    methods: {
        onCommand(command, args) {
            if (command == "load") {
                //load
                this.render();
                this.querySelector("DIALOG").showModal();

            } else if (command == "query-close") {
                //query close
                args.event.preventDefault();
                this.dispatchEvent(new CustomEvent("page:query-close", { composed: true }));
            }
        }

    }
});
