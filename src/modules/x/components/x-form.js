import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-form", {
    style: `
        :host {display:block;}
    `,
    state: {
    },
    template: `
        <slot></slot>
    `
});

