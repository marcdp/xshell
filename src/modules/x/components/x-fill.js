import XElement from "../ui/x-element.js";

// definition
export default await XElement.define("x-fill", {
    style: `
        :host {
            display:flex; 
            flex-direction:column;
            position:absolute;
            left:0;
            top:0;
            right:0;
            bottom:0;
            z-index:0;
            height:var(--x-fill-height, unset);
        }
    `,
    template: `
        <slot></slot>
    `,
});
