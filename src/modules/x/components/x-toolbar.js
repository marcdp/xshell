import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-toolbar", {
    style: `
        :host {display:flex; align-items:center; gap:.2em; position:relative; flex-wrap:wrap;}
    `,
    template: `
        <slot></slot>
    `,
    state: {
    }
});

