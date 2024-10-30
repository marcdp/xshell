import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-toolbar", {
    style: `
        :host {display:flex; align-items:center; gap:.2em}
    `,
    template: `
        <slot></slot>
    `,
    state: {
    }
});

