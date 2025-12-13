import XElement from "x-element";

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
    `,
    template: `
        <x-loading x-if="state.status=='loading'"></x-loading>
        <slot></slot>
    `,
    state: {
        status: ""
    }
});
