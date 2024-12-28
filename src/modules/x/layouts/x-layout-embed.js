import XElement from "../../x/ui/x-element.js";

// class
export default XElement.define("x-layout-embed", {
    style: `
        :host {
            display:block;
            padding: var(--x-layout-embed-page-padding-vertical) var(--x-layout-embed-page-padding-horizontal) var(--x-layout-embed-page-padding-vertical) var(--x-layout-embed-page-padding-horizontal);
        }
        ::slotted(p:first-child) {
            margin-top:0;
        }
        ::slotted(p:last-child) {
            margin-bottom:0;
        }

        /* show horizontal bar in x-form footer*/
        ::slotted(x-form) {
            --x-form-footer-hr-display: block;
            --x-form-footer-hr-margin-left: calc( var(--x-layout-embed-page-padding-horizontal) * -1);
            --x-form-footer-hr-margin-right: calc( var(--x-layout-embed-page-padding-horizontal) * -1);
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
