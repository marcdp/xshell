import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-form-footer", {
    style: `
        :host {display:block; text-align:right; padding-top:1em;}
        ::slotted(x-button) {min-width: var(--x-button-width-wide);}
    `,
    template: `
        <slot></slot>
    `
});

