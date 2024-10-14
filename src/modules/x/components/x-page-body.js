import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-page-body", {
    style: `
        :host {display:block; padding:0 var(--page-padding-left) 0 var(--page-padding-right);}
    `,
    template: `
        <slot></slot>
    `
});
