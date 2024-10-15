import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-page-footer", {
    style: `
        :host {display:flex; justify-content:end; padding-bottom:var(--x-page-padding-bottom); padding-left:var(--x-page-padding-left); padding-right:var(--x-page-padding-right); }
    `,
    template: `
        <slot></slot>
    `
});

