import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-layout-embed", {
    template: `
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
