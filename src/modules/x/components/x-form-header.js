import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-form-header", {
    style: `
        :host {display:block;}

        ::slotted(*:first-child) {margin-top: 0em;}
    `,
    state: {
    },
    template: `
        <slot></slot>
    `
});

