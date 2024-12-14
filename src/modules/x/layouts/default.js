import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-layout-default", {
    template: `
        <style>
            :host {padding:1em}
        </style>
        <x-loading-bar x-if="state.status=='loading'"></x-loading-bar>
        <slot></slot>
    `,
    state: {
        status: ""
    },
    settings: {
        observedAttributes: ["status"],
        useLightDom: true
    }
});
