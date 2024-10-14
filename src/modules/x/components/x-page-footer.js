import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-page-footer", {
    style: `
        :host {display:flex; justify-content:end; padding-bottom:var(--page-padding-bottom); padding-left:var(--page-padding-left); padding-right:var(--page-padding-right); }
    `,
    template: `
        <slot></slot>
    `
});

