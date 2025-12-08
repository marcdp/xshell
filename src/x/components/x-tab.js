import XElement from "x-element";

// class
export default XElement.define("x-tab", {
    style: `
        :host {display:block;}
    `,
    template: `
        <slot></slot>
    `,
    state: {
        label:"",
        hash:""
    }
});

