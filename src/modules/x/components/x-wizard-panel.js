import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-wizard-panel", {
    style: `
        :host {display:block;}
    `,
    template: `
        <slot></slot>
    `
});

