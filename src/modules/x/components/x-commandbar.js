import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-commandbar", {
    style: `
        :host {display:flex;}
        :host > span {flex:1;}
    `,
    state: {
    },
    template: `
        <slot></slot>
        <span></span>
        <slot name="toolbar"></slot>
    `
});

