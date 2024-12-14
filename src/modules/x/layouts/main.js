import shell from "shell";
import XElement from "../ui/x-element.js";


// class
export default XElement.define("x-layout-main", {
    template: `
        <style>
            x-loading-bar {position:fixed; top:0; left:0; right:0; }
        </style>
        <x-loading-bar x-if="state.status=='loading'"></x-loading-bar>

        LOGO + TITLE + Menuitem 1 + Menuitem 2 + ... (this is the main layout) <slot name="header"></slot>
        <x-button label="xxxxxx1" x-on:click="something"></x-button>
        <x-button label="xxxxxx2" x-on:click="something2"></x-button>
        <x-button label="xxxxxx3" x-on:click="something3"></x-button>

        <x-page-breadcrumb></x-page-breadcrumb>

        <div style="border:1px red solid; padding:1em;" >

            <slot></slot>
        </div>
    `,
    state: {
        status: ""
    },
    settings: {
        observedAttributes: ["status"],
        useLightDom: true
    },
    methods: {
        onCommand(command) {
            if (command == "load") {
                //load

            } else if (command == "something") {
                //something
                shell.showPage({
                    src: "/module1/pages/page6.html",
                    target: "#stack"
                });

            } else if (command == "something2") {
                //something2
                shell.showPage({
                    src: "/module1/pages/page6.html?aaaaa=123",
                    target: "#dialog"
                });

            } else if (command == "something3") {
                //something2
                shell.showPage({
                    src: "/x/pages/search.html",
                    target: "#dialog"
                });
            }
        }

    }
});
