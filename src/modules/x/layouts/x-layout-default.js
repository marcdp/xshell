import XElement from "../../x/ui/x-element.js";

// class
export default XElement.define("x-layout-default", {
    style:`
        :host {
            display:block;
            padding: var(--x-layout-default-page-padding-vertical) var(--x-layout-default-page-padding-horizontal) var(--x-layout-default-page-padding-vertical) var(--x-layout-default-page-padding-horizontal);
        }
    `,
    template: `
        <x-loading-bar x-if="state.status=='loading'"></x-loading-bar>
        <slot></slot>
    `,
    state: {
        status: ""
    },
    //settings: {
    //    observedAttributes: ["status"]
    //}
});
