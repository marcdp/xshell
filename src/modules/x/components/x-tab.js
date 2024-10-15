import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-tab", {
    style: `
        :host {display:block;}
    `,
    state: {
    },
    template: `
        <slot></slot>
    `
});

