import shell from "shell";
import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-layout-stack", {
    template: `
        <style>
            div.backdrop {
                background:var(--x-page-backdrop);
                position:fixed; 
                top:0;
                left:0;
                right: 0;
                bottom:0;
            }
            div.panel {
                background:white;
                position:fixed;
                top:0;
                bottom:0;
                right: 0;
                width:80vw;
                width:var(--x-page-stack-width);
                height: unset;
                margin-right:0;
                border:none; outline:none; border:none; max-height:unset; padding:0;
                border-radius:var(--x-page-stack-border-radius);
                box-shadow: var(--x-page-stack-shadow);
                opacity:1;
                transform:translateX(100%);
                transition:transform var(--x-transition-duration) ease-out, opacity var(--x-transition-duration) ease-out;
            }
            div.panel.visible {
                transform:translateX(0);
                opacity:1;
                transition:transform var(--x-transition-duration) ease, opacity var(--x-transition-duration) ease;
            }
            div.panel .body {
                padding:0 var(--x-page-padding-left) 0 var(--x-page-padding-right);
            }
        </style>
        <div class="backdrop" x-on:click="query-close"></div>
        <div class="panel visible">
            <x-loading-bar x-if="state.status=='loading'"></x-loading-bar>
            <div class="header">
                <x-page-title></x-page-title>
            <div>
            <div class="body">
                <slot></slot>
            <div>
        </div>
    `,
    state: {
        status: "",
    },
    settings: {
        observedAttributes: ["status"],
        useLightDom: true
    },
    methods: {
        onCommand(command) {
            if (command == "load") {
                //load

            } else if (command == "query-close") {
                //query close
                this.dispatchEvent(new CustomEvent("page:query-close", { composed: true }));
            }
        }

    }
});
